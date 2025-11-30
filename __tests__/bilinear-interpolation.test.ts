import { bilinearInterpolate, clamp } from '../src/bilinear-interpolation';

type Rgba = [number, number, number, number];

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const YELLOW: Rgba = [255, 255, 0, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];

function makeImageData(
  width: number,
  height: number,
  orderedPixels: Rgba[],
): Pick<ImageData, 'data'> {
  const data = new Uint8ClampedArray(width * height * 4);
  let index = 0;
  for (const pixel of orderedPixels) {
    data[index++] = pixel[0];
    data[index++] = pixel[1];
    data[index++] = pixel[2];
    data[index++] = pixel[3];
  }
  return { data };
}

describe(clamp, () => {
  it.each([
    [5, 5],
    [0, 0],
    [10, 10],
    [-5, 0],
    [-100, 0],
    [15, 10],
    [100, 10],
    [0.5, 0.5],
    [Infinity, 10],
    [-Infinity, 0],
  ])('clamp(%d, 0, 10) === %d', (value, expected) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });

  it('should return NaN when value is NaN', () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });
});

describe(bilinearInterpolate, () => {
  describe('exact pixel positions', () => {
    it('should return exact pixel value when coordinates are integers', () => {
      // Create a 2x2 image with distinct colors
      const imageData = makeImageData(2, 2, [
        RED, // (0,0)
        GREEN, // (1,0)
        BLUE, // (0,1)
        YELLOW, // (1,1)
      ]);

      // At exact pixel positions, should return the exact pixel value
      expect(bilinearInterpolate(imageData, 2, 2, 0, 0)).toEqual(RED);
      expect(bilinearInterpolate(imageData, 2, 2, 1, 0)).toEqual(GREEN);
      expect(bilinearInterpolate(imageData, 2, 2, 0, 1)).toEqual(BLUE);
      expect(bilinearInterpolate(imageData, 2, 2, 1, 1)).toEqual(YELLOW);
    });
  });

  describe('fractional positions', () => {
    it('should blend 50/50 horizontally at x.5 positions', () => {
      // Create a 2x1 image: black to white gradient
      const imageData = makeImageData(2, 1, [BLACK, WHITE]);

      // At x=0.5, should be halfway between black and white (gray)
      const result = bilinearInterpolate(imageData, 2, 1, 0.5, 0);
      expect(result).toEqual([128, 128, 128, 255]);
    });

    it('should blend 50/50 vertically at y.5 positions', () => {
      // Create a 1x2 image: black to white gradient
      const imageData = makeImageData(1, 2, [BLACK, WHITE]);

      // At y=0.5, should be halfway between black and white (gray)
      const result = bilinearInterpolate(imageData, 1, 2, 0, 0.5);
      expect(result).toEqual([128, 128, 128, 255]);
    });

    it('should blend all four corners at (0.5, 0.5)', () => {
      // Create a 2x2 image with four different corner values
      const imageData = makeImageData(2, 2, [
        BLACK, // (0,0)
        [100, 100, 100, 255], // (1,0) dark gray
        [200, 200, 200, 255], // (0,1) light gray
        WHITE, // (1,1)
      ]);

      // At center (0.5, 0.5), should be average of all four corners
      // (0 + 100 + 200 + 255) / 4 = 138.75 ≈ 139
      const result = bilinearInterpolate(imageData, 2, 2, 0.5, 0.5);
      expect(result).toEqual([139, 139, 139, 255]);
    });

    it('should weight pixels according to distance (0.25, 0.75)', () => {
      // Create a 2x2 image where only top-left is white
      const imageData = makeImageData(2, 2, [WHITE, BLACK, BLACK, BLACK]);

      // At (0.25, 0.75): close to top-left horizontally, far vertically
      // weight for (0,0) = (1-0.25) * (1-0.75) = 0.75 * 0.25 = 0.1875
      // All other corners are black, so result = 255 * 0.1875 ≈ 48
      const result = bilinearInterpolate(imageData, 2, 2, 0.25, 0.75);
      expect(result[0]).toBeCloseTo(48, 0);
    });
  });

  describe('edge cases and boundaries', () => {
    it('should clamp coordinates at left edge (negative x)', () => {
      const imageData = makeImageData(2, 2, [RED, GREEN, BLUE, YELLOW]);

      // Negative x should clamp to 0
      const result = bilinearInterpolate(imageData, 2, 2, -0.5, 0);
      // Should interpolate as if x=0
      expect(result).toEqual(RED);
    });

    it('should clamp coordinates at right edge (x >= width)', () => {
      const imageData = makeImageData(2, 2, [RED, GREEN, BLUE, YELLOW]);

      // x >= width should clamp to width-1
      const result = bilinearInterpolate(imageData, 2, 2, 2.5, 0);
      expect(result).toEqual(GREEN);
    });

    it('should clamp coordinates at top edge (negative y)', () => {
      const imageData = makeImageData(2, 2, [RED, GREEN, BLUE, YELLOW]);

      const result = bilinearInterpolate(imageData, 2, 2, 0, -0.5);
      expect(result).toEqual(RED);
    });

    it('should clamp coordinates at bottom edge (y >= height)', () => {
      const imageData = makeImageData(2, 2, [RED, GREEN, BLUE, YELLOW]);

      const result = bilinearInterpolate(imageData, 2, 2, 0, 2.5);
      expect(result).toEqual(BLUE);
    });
  });

  describe('alpha channel handling', () => {
    it('should interpolate alpha channel independently', () => {
      // Create a 2x1 image with varying alpha
      const imageData = makeImageData(2, 1, [
        [255, 0, 0, 0], // red, fully transparent
        [255, 0, 0, 255], // red, fully opaque
      ]);

      // At x=0.5, color stays red but alpha blends
      const result = bilinearInterpolate(imageData, 2, 1, 0.5, 0);
      expect(result).toEqual([255, 0, 0, 128]);
    });
  });

  describe('real-world color blending', () => {
    it('should smoothly blend between red and blue', () => {
      const imageData = makeImageData(2, 1, [RED, BLUE]);

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
