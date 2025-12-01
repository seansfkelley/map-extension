import { bilinearInterpolate, clamp } from '../src/bilinearInterpolate';
import { PixelCoordinates } from '../src/types';

type Rgba = [number, number, number, number];

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const YELLOW: Rgba = [255, 255, 0, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];

function makeImage(
  width: number,
  height: number,
  // in English reading order
  orderedPixels: Rgba[],
): Pick<ImageData, 'data' | 'width' | 'height'> {
  const data = new Uint8ClampedArray(width * height * 4);
  let index = 0;
  for (const pixel of orderedPixels) {
    data[index++] = pixel[0];
    data[index++] = pixel[1];
    data[index++] = pixel[2];
    data[index++] = pixel[3];
  }
  return { data, width, height };
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
  it('should return exact pixel value when coordinates are integers', () => {
    const imageData = makeImage(2, 2, [RED, GREEN, BLUE, YELLOW]);

    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0, 0))).toEqual(RED);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(1, 0))).toEqual(GREEN);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0, 1))).toEqual(BLUE);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(1, 1))).toEqual(YELLOW);
  });

  it('should clamp sampling coordinates to the nearest in-bounds coordinate', () => {
    const imageData = makeImage(2, 2, [RED, GREEN, BLUE, YELLOW]);

    expect(bilinearInterpolate(imageData, PixelCoordinates.of(-0.5, 0))).toEqual(RED);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(2.5, 0))).toEqual(GREEN);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0, -0.5))).toEqual(RED);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0, 2.5))).toEqual(BLUE);
  });

  it('should interpolate alpha channel independently', () => {
    const imageData = makeImage(2, 1, [
      [255, 0, 0, 0],
      [255, 0, 0, 255],
    ]);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0.5, 0))).toEqual([255, 0, 0, 128]);
  });

  it('should blend 50/50 horizontally at x.5 positions', () => {
    const imageData = makeImage(2, 1, [BLACK, WHITE]);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0.5, 0))).toEqual([
      128, 128, 128, 255,
    ]);
  });

  it('should blend 50/50 vertically at y.5 positions', () => {
    const imageData = makeImage(1, 2, [BLACK, WHITE]);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0, 0.5))).toEqual([
      128, 128, 128, 255,
    ]);
  });

  it('should blend all four corners at (0.5, 0.5)', () => {
    const imageData = makeImage(2, 2, [BLACK, [100, 100, 100, 255], [200, 200, 200, 255], WHITE]);

    // (0 + 100 + 200 + 255) / 4 = 138.75 ~= 139
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0.5, 0.5))).toEqual([
      139, 139, 139, 255,
    ]);
  });

  it('should weight pixels according to distance at (0.25, 0.75)', () => {
    const imageData = makeImage(2, 2, [WHITE, BLACK, BLACK, BLACK]);

    // At (0.25, 0.75): close to top-left horizontally, far vertically
    // weight for (0,0) = (1-0.25) * (1-0.75) = 0.75 * 0.25 = 0.1875
    // All other corners are black, so result = 255 * 0.1875 ~= 48
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0.25, 0.75))).toEqual([
      48, 48, 48, 255,
    ]);
  });

  it('should blend arbitrary colors channel-independently', () => {
    const imageData = makeImage(2, 2, [WHITE, RED, YELLOW, BLACK]);
    expect(bilinearInterpolate(imageData, PixelCoordinates.of(0.5, 0.5))).toEqual([
      191, 128, 64, 255,
    ]);
  });
});
