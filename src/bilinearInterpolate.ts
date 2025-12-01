import { PixelCoordinates } from './types';

export type Rgba = [number, number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// see https://en.wikipedia.org/wiki/Bilinear_interpolation
//
// n.b. This uses graphics coordinate systems, where (0, 0) is the top left.
export function bilinearInterpolate(
  { data, width, height }: Pick<ImageData, 'data' | 'width' | 'height'>,
  [x, y]: PixelCoordinates,
): Rgba {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;

  const tx = x - x0;
  const ty = y - y0;

  const clampX0 = clamp(x0, 0, width - 1);
  const clampY0 = clamp(y0, 0, height - 1);
  const clampX1 = clamp(x1, 0, width - 1);
  const clampY1 = clamp(y1, 0, height - 1);

  const idx00 = (clampY0 * width + clampX0) * 4;
  const idx10 = (clampY0 * width + clampX1) * 4;
  const idx01 = (clampY1 * width + clampX0) * 4;
  const idx11 = (clampY1 * width + clampX1) * 4;

  const interpolated: Rgba = [0, 0, 0, 0];

  for (let channel = 0; channel < 4; channel++) {
    const c00 = data[idx00 + channel];
    const c10 = data[idx10 + channel];
    const c01 = data[idx01 + channel];
    const c11 = data[idx11 + channel];

    // Interpolate horizontally along top and bottom edges
    const top = c00 * (1 - tx) + c10 * tx;
    const bottom = c01 * (1 - tx) + c11 * tx;

    // Interpolate vertically between the two horizontal results
    interpolated[channel] = Math.round(top * (1 - ty) + bottom * ty);
  }

  return interpolated;
}
