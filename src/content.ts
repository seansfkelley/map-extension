import { type ExtensionMessage, LonLat, PixelCoordinates, type Projection } from './types';
import { geoMercator, geoEquirectangular, type GeoProjection } from 'd3-geo';
import {
  geoRobinson,
  geoCylindricalEqualArea,
  geoInterruptedHomolosine,
  geoPolyhedralWaterman,
} from 'd3-geo-projection';
import { geoAirocean } from 'd3-geo-polygon';
import { bilinearInterpolate } from './bilinearInterpolate';
import { ReprojectableImageManager } from './ReprojectableImageManager';
import { assert } from './util';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

const CYLINDRICAL_CRITICAL_POINTS: LonLat[] = [
  LonLat.of(0, 90), // north pole
  LonLat.of(0, -90), // south pole
  LonLat.of(-180, 0), // antimeridian (west)
  LonLat.of(180, 0), // antimerdian (east)
];

function newCanvasAndContext(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  assert(context != null, 'canvas must have 2d context');

  return [canvas, context] as const;
}

async function* reproject(
  sourceImage: HTMLImageElement,
  destProjection: GeoProjection,
  abortSignal: AbortSignal,
  boundsSamplingPoints: LonLat[],
): AsyncGenerator<{
  canvas: HTMLCanvasElement;
  pixelsCalculated: number;
  totalPixels: number;
}> {
  assert(destProjection.invert != null, 'projection must support inversion');

  // First, find the natural bounds of the projection with unit scale
  const unitProjection = destProjection.scale(1).translate([0, 0]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Check boundary points to find extremes
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

  assert(naturalWidth > 0 && naturalHeight > 0, 'invalid natural dimensions');

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  // Calculate scale to fit the output within the source image width
  const scale = sourceWidth / naturalWidth;
  const destWidth = sourceWidth;
  const destHeight = Math.ceil(naturalHeight * scale);

  // Reconfigure projection with proper scale and translate
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  destProjection
    .scale(scale)
    .translate([destWidth / 2 - centerX * scale, destHeight / 2 - centerY * scale]);

  const mercator = geoMercator()
    .scale(sourceWidth / (2 * Math.PI))
    .translate([sourceWidth / 2, sourceHeight / 2]);

  // ugh, just want blocks-as-values
  const sourceImageData = (() => {
    const [, sourceCtx] = newCanvasAndContext(sourceWidth, sourceHeight);
    sourceCtx.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
    return sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  })();

  const [destCanvas, destCtx] = newCanvasAndContext(destWidth, destHeight);
  const destImageData = destCtx.createImageData(destWidth, destHeight);

  let lastYieldTime = performance.now();
  let pixelsCalculated = 0;
  const totalPixels = destWidth * destHeight;

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      if (abortSignal.aborted) {
        return;
      }

      const destinationCoordinates = PixelCoordinates.of(x, y);
      const lonLat = destProjection.invert(destinationCoordinates) as LonLat | null;

      if (lonLat == null) {
        continue;
      }

      const sourceCoordinates = mercator(lonLat) as PixelCoordinates | null;
      if (
        sourceCoordinates == null ||
        sourceCoordinates[0] < 0 ||
        sourceCoordinates[1] >= sourceWidth ||
        sourceCoordinates[1] < 0 ||
        sourceCoordinates[1] >= sourceHeight
      ) {
        // The scale seems to assume that we're working with a cropped Mercator. Indeed, if you look
        // at most images, they either truncate Greenland or show very little ocean above it,
        // meaning they're dropping map near the poles where the Mercator projection gets _really_
        // extraordinarily degenerate. Since saner projections handle poles better, they may query
        // for lon/lat around there, but the Mercator projection has nothing to provide (it's out of
        // bounds of the original image).
        //
        // TODO: Is this actually the reason? It's a bit hard to tell.
        //
        // TODO: Is there a way we can do this more analytically, say by just looking at the lon/lat
        // directly or by calling a function on the scale to ask if it's in bounds?
        continue;
      }

      const reprojectedCoordinates = destProjection(lonLat) as PixelCoordinates | null;
      // If the reprojected pixel ends up more than a rounding error away from the desired location,
      // we are in a part of the image where the projection wraps around and would show duplicative
      // content, so leave it blank.
      //
      // Epsilon is REALLY big here instead of a more normal 1e-9 or smaller because Dymaxion is
      // super noisy and would fail a tighter bound.
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

      if (sourceCoordinates != null) {
        const [r, g, b, a] = bilinearInterpolate(sourceImageData, sourceCoordinates);

        const destIdx = (y * destWidth + x) * 4;
        destImageData.data[destIdx] = r;
        destImageData.data[destIdx + 1] = g;
        destImageData.data[destIdx + 2] = b;
        destImageData.data[destIdx + 3] = a;
      }

      pixelsCalculated++;
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

const managers = new WeakMap<HTMLImageElement, ReprojectableImageManager>();

async function reprojectIncrementally(
  image: HTMLImageElement,
  projection: GeoProjection,
  boundsSamplingPoints: LonLat[],
): Promise<void> {
  if (!managers.has(image)) {
    managers.set(image, new ReprojectableImageManager(image));
  }

  const manager = managers.get(image);
  assert(manager != null, 'original image source must be stored');

  const transientSourceImage = new Image();
  transientSourceImage.crossOrigin = image.crossOrigin;

  const operation = manager.startReprojectionOperation();

  await new Promise<void>((resolve, reject) => {
    transientSourceImage.onload = () => resolve();
    transientSourceImage.onerror = () => reject(new Error('failed to load original image'));
    transientSourceImage.src = operation.originalImageSrc;
  });

  for await (const { canvas, pixelsCalculated, totalPixels } of reproject(
    transientSourceImage,
    projection,
    operation.abortController.signal,
    boundsSamplingPoints,
  )) {
    operation.updateProgress(pixelsCalculated / totalPixels);
    image.src = canvas.toDataURL();
    // release to the event loop to prevent the browser from completely locking up and to permit
    // the user to hit the cancel button
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  operation.completeIfNotAborted();
}

const callbacks: Record<Projection, (image: HTMLImageElement) => Promise<void>> = {
  Dymaxion: async (image) => {
    await reprojectIncrementally(image, geoAirocean(), [
      // Calculated empirically, based on the particulars of the projection d3 provides, since there
      // are multiple layouts possible.
      LonLat.of(39, -51), // min X
      LonLat.of(132, -52), // max X
      LonLat.of(10, -24), // min Y
      LonLat.of(-179, -41), // max Y
    ]);
  },
  'Gall-Peters': async (image) => {
    await reprojectIncrementally(
      image,
      geoCylindricalEqualArea().parallel(45),
      CYLINDRICAL_CRITICAL_POINTS,
    );
  },
  'Goode Homolosine': async (image) => {
    await reprojectIncrementally(image, geoInterruptedHomolosine(), CYLINDRICAL_CRITICAL_POINTS);
  },
  'Hobo-Dyer': async (_image) => {
    console.warn('Hobo-Dyer projection not yet implemented');
  },
  'Peirce Quincuncial': async (_image) => {
    console.warn('Peirce Quincuncial projection not yet implemented');
  },
  'Plate Carrée (Equirectangular)': async (image) => {
    await reprojectIncrementally(image, geoEquirectangular(), CYLINDRICAL_CRITICAL_POINTS);
  },
  Robinson: async (image) => {
    await reprojectIncrementally(image, geoRobinson(), CYLINDRICAL_CRITICAL_POINTS);
  },
  'Van der Grinten': async (_image) => {
    console.warn('Van der Grinten projection not yet implemented');
  },
  'Waterman Butterfly': async (image) => {
    await reprojectIncrementally(image, geoPolyhedralWaterman(), [
      // There are variants of this projection, specifically around the south pole; these points are
      // chosen because the variation we use does not go all the way to the pole.
      //
      // South pole points, which dictate the left, right and bottom edges.
      LonLat.of(-180, -85),
      LonLat.of(-135, -85),
      LonLat.of(-90, -85),
      LonLat.of(-45, -85),
      LonLat.of(0, -85),
      LonLat.of(45, -85),
      LonLat.of(90, -85),
      LonLat.of(135, -85),
      LonLat.of(180, -85),
      // Antimeridian points near the equator, which dictate the top edge.
      LonLat.of(-180, 0),
      LonLat.of(180, 0),
    ]);
  },
  'Winkel-Tripel': async (_image) => {
    console.warn('Winkel-Tripel projection not yet implemented');
  },
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    callbacks[message.projection]?.(lastContextMenuTarget);
  }
});
