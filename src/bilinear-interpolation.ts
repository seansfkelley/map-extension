/**
 * RGBA color value with each channel in 0-255 range.
 */
export type RGBAPixel = [number, number, number, number];

/**
 * Performs bilinear interpolation to blend pixel values at fractional coordinates.
 *
 * Bilinear interpolation smooths images by blending the four nearest pixels based
 * on fractional position within the pixel grid.
 *
 * @see https://en.wikipedia.org/wiki/Bilinear_interpolation
 *
 * @param imageData - The source image data containing pixel values
 * @param width - Width of the source image in pixels
 * @param height - Height of the source image in pixels
 * @param x - Fractional x-coordinate (e.g., 10.25 means 25% between pixels 10 and 11)
 * @param y - Fractional y-coordinate (e.g., 20.75 means 75% between pixels 20 and 21)
 * @returns RGBA pixel values for the interpolated pixel
 */
export function bilinearInterpolate(
  imageData: ImageData,
  width: number,
  height: number,
  x: number,
  y: number,
): RGBAPixel {
  // Get the integer coordinates of the top-left pixel in the 2x2 block
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  // Extract fractional parts - how far between pixels (0.0 to 1.0)
  const tx = x - x0;
  const ty = y - y0;

  // Clamp coordinates to image bounds
  const clampX0 = Math.max(0, Math.min(width - 1, x0));
  const clampY0 = Math.max(0, Math.min(height - 1, y0));
  const clampX1 = Math.max(0, Math.min(width - 1, x1));
  const clampY1 = Math.max(0, Math.min(height - 1, y1));

  // Calculate byte indices for the four corner pixels
  // ImageData stores pixels as [R, G, B, A, R, G, B, A, ...]
  const idx00 = (clampY0 * width + clampX0) * 4; // top-left
  const idx10 = (clampY0 * width + clampX1) * 4; // top-right
  const idx01 = (clampY1 * width + clampX0) * 4; // bottom-left
  const idx11 = (clampY1 * width + clampX1) * 4; // bottom-right

  const result: RGBAPixel = [0, 0, 0, 0];

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
