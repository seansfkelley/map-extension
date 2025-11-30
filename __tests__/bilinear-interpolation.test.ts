import { bilinearInterpolate } from '../src/bilinear-interpolation';

/**
 * Helper function to create a simple ImageData-like object for testing.
 */
function createTestImageData(width: number, height: number, data: number[]): ImageData {
  // Create a mock ImageData object since it's not available in Node.js
  const buffer = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    buffer[i] = data[i];
  }
  return {
    data: buffer,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('bilinearInterpolate', () => {
  describe('exact pixel positions', () => {
    it('should return exact pixel value when coordinates are integers', () => {
      // Create a 2x2 image with distinct colors
      const imageData = createTestImageData(2, 2, [
        255, 0, 0, 255, // (0,0) red
        0, 255, 0, 255, // (1,0) green
        0, 0, 255, 255, // (0,1) blue
        255, 255, 0, 255, // (1,1) yellow
      ]);

      // At exact pixel positions, should return the exact pixel value
      expect(bilinearInterpolate(imageData, 2, 2, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(bilinearInterpolate(imageData, 2, 2, 1, 0)).toEqual([0, 255, 0, 255]);
      expect(bilinearInterpolate(imageData, 2, 2, 0, 1)).toEqual([0, 0, 255, 255]);
      expect(bilinearInterpolate(imageData, 2, 2, 1, 1)).toEqual([255, 255, 0, 255]);
    });
  });

  describe('fractional positions', () => {
    it('should blend 50/50 horizontally at x.5 positions', () => {
      // Create a 2x1 image: black to white gradient
      const imageData = createTestImageData(2, 1, [
        0, 0, 0, 255, // (0,0) black
        255, 255, 255, 255, // (1,0) white
      ]);

      // At x=0.5, should be halfway between black and white (gray)
      const result = bilinearInterpolate(imageData, 2, 1, 0.5, 0);
      expect(result).toEqual([128, 128, 128, 255]);
    });

    it('should blend 50/50 vertically at y.5 positions', () => {
      // Create a 1x2 image: black to white gradient
      const imageData = createTestImageData(1, 2, [
        0, 0, 0, 255, // (0,0) black
        255, 255, 255, 255, // (0,1) white
      ]);

      // At y=0.5, should be halfway between black and white (gray)
      const result = bilinearInterpolate(imageData, 1, 2, 0, 0.5);
      expect(result).toEqual([128, 128, 128, 255]);
    });

    it('should blend all four corners at (0.5, 0.5)', () => {
      // Create a 2x2 image with four different corner values
      const imageData = createTestImageData(2, 2, [
        0, 0, 0, 255, // (0,0) black
        100, 100, 100, 255, // (1,0) dark gray
        200, 200, 200, 255, // (0,1) light gray
        255, 255, 255, 255, // (1,1) white
      ]);

      // At center (0.5, 0.5), should be average of all four corners
      // (0 + 100 + 200 + 255) / 4 = 138.75 ≈ 139
      const result = bilinearInterpolate(imageData, 2, 2, 0.5, 0.5);
      expect(result).toEqual([139, 139, 139, 255]);
    });

    it('should weight pixels according to distance (0.25, 0.75)', () => {
      // Create a 2x2 image where only top-left is white
      const imageData = createTestImageData(2, 2, [
        255, 255, 255, 255, // (0,0) white
        0, 0, 0, 255, // (1,0) black
        0, 0, 0, 255, // (0,1) black
        0, 0, 0, 255, // (1,1) black
      ]);

      // At (0.25, 0.75): close to top-left horizontally, far vertically
      // weight for (0,0) = (1-0.25) * (1-0.75) = 0.75 * 0.25 = 0.1875
      // All other corners are black, so result = 255 * 0.1875 ≈ 48
      const result = bilinearInterpolate(imageData, 2, 2, 0.25, 0.75);
      expect(result[0]).toBeCloseTo(48, 0);
    });
  });

  describe('edge cases and boundaries', () => {
    it('should clamp coordinates at left edge (negative x)', () => {
      const imageData = createTestImageData(2, 2, [
        255, 0, 0, 255, // (0,0) red
        0, 255, 0, 255, // (1,0) green
        0, 0, 255, 255, // (0,1) blue
        255, 255, 0, 255, // (1,1) yellow
      ]);

      // Negative x should clamp to 0
      const result = bilinearInterpolate(imageData, 2, 2, -0.5, 0);
      // Should interpolate as if x=0
      expect(result).toEqual([255, 0, 0, 255]);
    });

    it('should clamp coordinates at right edge (x >= width)', () => {
      const imageData = createTestImageData(2, 2, [
        255, 0, 0, 255, // (0,0) red
        0, 255, 0, 255, // (1,0) green
        0, 0, 255, 255, // (0,1) blue
        255, 255, 0, 255, // (1,1) yellow
      ]);

      // x >= width should clamp to width-1
      const result = bilinearInterpolate(imageData, 2, 2, 2.5, 0);
      expect(result).toEqual([0, 255, 0, 255]);
    });

    it('should clamp coordinates at top edge (negative y)', () => {
      const imageData = createTestImageData(2, 2, [
        255, 0, 0, 255, // (0,0) red
        0, 255, 0, 255, // (1,0) green
        0, 0, 255, 255, // (0,1) blue
        255, 255, 0, 255, // (1,1) yellow
      ]);

      const result = bilinearInterpolate(imageData, 2, 2, 0, -0.5);
      expect(result).toEqual([255, 0, 0, 255]);
    });

    it('should clamp coordinates at bottom edge (y >= height)', () => {
      const imageData = createTestImageData(2, 2, [
        255, 0, 0, 255, // (0,0) red
        0, 255, 0, 255, // (1,0) green
        0, 0, 255, 255, // (0,1) blue
        255, 255, 0, 255, // (1,1) yellow
      ]);

      const result = bilinearInterpolate(imageData, 2, 2, 0, 2.5);
      expect(result).toEqual([0, 0, 255, 255]);
    });
  });

  describe('alpha channel handling', () => {
    it('should interpolate alpha channel independently', () => {
      // Create a 2x1 image with varying alpha
      const imageData = createTestImageData(2, 1, [
        255, 0, 0, 0, // (0,0) red, fully transparent
        255, 0, 0, 255, // (1,0) red, fully opaque
      ]);

      // At x=0.5, color stays red but alpha blends
      const result = bilinearInterpolate(imageData, 2, 1, 0.5, 0);
      expect(result).toEqual([255, 0, 0, 128]);
    });
  });

  describe('real-world color blending', () => {
    it('should smoothly blend between red and blue', () => {
      const imageData = createTestImageData(2, 1, [
        255, 0, 0, 255, // red
        0, 0, 255, 255, // blue
      ]);

      // At 25% position, should be mostly red
      const result25 = bilinearInterpolate(imageData, 2, 1, 0.25, 0);
      expect(result25[0]).toBeGreaterThan(result25[2]); // More red than blue
      expect(result25[0]).toBe(191); // 255 * 0.75 + 0 * 0.25
      expect(result25[2]).toBe(64); // 0 * 0.75 + 255 * 0.25

      // At 75% position, should be mostly blue
      const result75 = bilinearInterpolate(imageData, 2, 1, 0.75, 0);
      expect(result75[2]).toBeGreaterThan(result75[0]); // More blue than red
      expect(result75[0]).toBe(64); // 255 * 0.25 + 0 * 0.75
      expect(result75[2]).toBe(191); // 0 * 0.25 + 255 * 0.75
    });
  });
});
