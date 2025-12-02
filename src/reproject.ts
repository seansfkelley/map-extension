import { geoMercator, type GeoProjection } from 'd3-geo';
import { bilinearInterpolate } from './bilinearInterpolate';
import { LonLat, PixelCoordinates } from './types';
import { assert } from './util';

export interface CanvasFactory {
  createCanvas(width: number, height: number): HTMLCanvasElement;
  loadImage(src: string, crossOrigin?: string | null): Promise<HTMLImageElement>;
}

function newCanvasAndContext(width: number, height: number, canvasFactory: CanvasFactory) {
  const canvas = canvasFactory.createCanvas(width, height);
  const context = canvas.getContext('2d');
  assert(context != null, 'canvas must have 2d context');

  return [canvas, context] as const;
}

export async function* reproject(
  sourceImage: HTMLImageElement,
  destProjection: GeoProjection,
  boundsSamplingPoints: LonLat[],
  canvasFactory: CanvasFactory,
  abortSignal: AbortSignal,
  longitudeOffset: number,
): AsyncGenerator<{
  canvas: HTMLCanvasElement;
  pixelsCalculated: number;
  totalPixels: number;
}> {
  assert(destProjection.invert != null, 'projection must support inversion');

  const unitProjection = destProjection.scale(1).translate([0, 0]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [lon, lat] of boundsSamplingPoints) {
    const point = unitProjection([lon, lat]);
    if (point != null && isFinite(point[0]) && isFinite(point[1])) {
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }
  }

  assert(
    isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY),
    'could not determine valid projection bounds',
  );

  const naturalWidth = maxX - minX;
  const naturalHeight = maxY - minY;

  assert(naturalWidth > 0 && naturalHeight > 0, 'invalid natural dimensions', {
    naturalWidth,
    naturalHeight,
  });

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  const scale = sourceWidth / naturalWidth;
  const destWidth = sourceWidth;
  const destHeight = Math.ceil(naturalHeight * scale);

  destProjection
    .scale(scale)
    .translate([
      destWidth / 2 - scale * ((minX + maxX) / 2),
      destHeight / 2 - scale * ((minY + maxY) / 2),
    ]);

  // Apply longitude offset by shifting the Mercator translation.
  // D3 geo uses degrees for lon/lat, but scale is in terms of radians.
  // Mercator x = scale * lon_radians = (sourceWidth / (2π)) * lon_radians
  // For lon_degrees: x = (sourceWidth / (2π)) * (lon_degrees * π/180) = lon_degrees * sourceWidth / 360
  // Positive offset shifts the output eastward, so we subtract from translation to shift source sampling westward.
  const longitudePixelOffset = (longitudeOffset * sourceWidth) / 360;
  const mercator = geoMercator()
    .scale(sourceWidth / (2 * Math.PI))
    .translate([sourceWidth / 2 - longitudePixelOffset, sourceHeight / 2]);

  // ugh, just want blocks-as-values
  const sourceImageData = (() => {
    const [, sourceCtx] = newCanvasAndContext(sourceWidth, sourceHeight, canvasFactory);
    sourceCtx.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
    return sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  })();

  const [destCanvas, destCtx] = newCanvasAndContext(destWidth, destHeight, canvasFactory);
  const destImageData = destCtx.createImageData(destWidth, destHeight);

  let lastYieldTime = performance.now();
  let pixelsCalculated = 0;
  const totalPixels = destWidth * destHeight;

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      pixelsCalculated++;

      if (abortSignal.aborted) {
        return;
      }

      const destinationCoordinates = PixelCoordinates.of(x, y);
      const lonLat = destProjection.invert(destinationCoordinates) as LonLat | null;

      // The target projection doesn't have this point for one reason or another.
      if (lonLat == null) {
        continue;
      }

      const reprojectedCoordinates = destProjection(lonLat) as PixelCoordinates | null;
      // If the reprojected pixel ends up more than a rounding error away from the desired location,
      // we are in a part of the image where the projection wraps around and would show duplicative
      // content, so leave it blank.
      //
      // Epsilon is REALLY big here instead of a more normal 1e-9 or smaller because Dymaxion has
      // noisy calculations and would fail a tighter bound.
      //
      // TODO: Is there a way to do this more analytically, instead of doubling the amount of math
      // we have to perform and by going in both directions?
      if (
        reprojectedCoordinates == null ||
        Math.abs(reprojectedCoordinates[0] - destinationCoordinates[0]) > 1e-3 ||
        Math.abs(reprojectedCoordinates[1] - destinationCoordinates[1]) > 1e-3
      ) {
        continue;
      }

      const sourceCoordinates = mercator(lonLat) as PixelCoordinates | null;
      if (sourceCoordinates == null) {
        // The scale assumes that we're working with a cropped Mercator. Indeed, if you look at most
        // images, they either truncate Greenland or show very little ocean above it, meaning
        // they're dropping map near the poles where the Mercator projection gets _really_
        // extraordinarily degenerate. Since saner projections handle poles better, they may query
        // for lon/lat around there, but the Mercator projection has nothing to provide (it's out of
        // bounds of the original image).
        //
        // Note that we only check for nullity. We may be (initially) out of bounds due to the
        // longitude offset requiring us to wrap around (see below), or maybe the projection wants
        // something near the poles that cropped Mercator simply does not have. In the latter case,
        // we rely on the interpolation to clamp the sampling to the bounds of the image, and accept
        // that we'll be severely distorting whatever is on the edge onto the poles -- which should
        // be okay, being only blank ocean or Antarctica.
        continue;
      }

      // In the case of a longitude offset, we might have to wrap around. We assume at most one
      // wrapping in each direction.
      if (sourceCoordinates[0] < 0) {
        sourceCoordinates[0] += sourceWidth;
      } else if (sourceCoordinates[0] >= sourceWidth) {
        sourceCoordinates[0] -= sourceWidth;
      }

      const [r, g, b, a] = bilinearInterpolate(sourceImageData, sourceCoordinates);

      const destIdx = (y * destWidth + x) * 4;
      destImageData.data[destIdx] = r;
      destImageData.data[destIdx + 1] = g;
      destImageData.data[destIdx + 2] = b;
      destImageData.data[destIdx + 3] = a;
    }

    const currentTime = performance.now();
    if (currentTime - lastYieldTime >= 1000) {
      destCtx.putImageData(destImageData, 0, 0);
      yield { canvas: destCanvas, pixelsCalculated, totalPixels };
      lastYieldTime = currentTime;
    }
  }

  destCtx.putImageData(destImageData, 0, 0);
  yield { canvas: destCanvas, pixelsCalculated, totalPixels };
}
