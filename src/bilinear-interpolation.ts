export type Rgba = [number, number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// see https://en.wikipedia.org/wiki/Bilinear_interpolation
export function bilinearInterpolate(
  imageData: Pick<ImageData, 'data'>,
  width: number,
  height: number,
  x: number,
  y: number,
): Rgba {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = x - x0;
  const ty = y - y0;

  // Clamp coordinates to image bounds
  const clampX0 = clamp(x0, 0, width - 1);
  const clampY0 = clamp(y0, 0, height - 1);
  const clampX1 = clamp(x1, 0, width - 1);
  const clampY1 = clamp(y1, 0, height - 1);

  // Calculate byte indices for the four corner pixels
  // ImageData stores pixels as [R, G, B, A, R, G, B, A, ...]
  const idx00 = (clampY0 * width + clampX0) * 4; // top-left
  const idx10 = (clampY0 * width + clampX1) * 4; // top-right
  const idx01 = (clampY1 * width + clampX0) * 4; // bottom-left
  const idx11 = (clampY1 * width + clampX1) * 4; // bottom-right

  const result: Rgba = [0, 0, 0, 0];

  // Interpolate each color channel (R, G, B, A) independently
  for (let channel = 0; channel < 4; channel++) {
    const c00 = imageData.data[idx00 + channel]; // top-left
    const c10 = imageData.data[idx10 + channel]; // top-right
    const c01 = imageData.data[idx01 + channel]; // bottom-left
    const c11 = imageData.data[idx11 + channel]; // bottom-right

    // Interpolate horizontally along top and bottom edges
    const top = c00 * (1 - tx) + c10 * tx;
    const bottom = c01 * (1 - tx) + c11 * tx;

    // Interpolate vertically between the two horizontal results
    result[channel] = Math.round(top * (1 - ty) + bottom * ty);
  }

  return result;
}
