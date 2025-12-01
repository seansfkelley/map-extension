import type { ExtensionMessage, Projection } from './types';
import { geoMercator, geoEquirectangular, type GeoProjection } from 'd3-geo';
import {
  geoRobinson,
  geoCylindricalEqualArea,
  geoInterruptedHomolosine,
  geoPolyhedralWaterman,
} from 'd3-geo-projection';
import { geoAirocean } from 'd3-geo-polygon';
import { bilinearInterpolate } from './bilinear-interpolation';
import { ReprojectableImageManager } from './ReprojectableImageManager';
import { assert } from './util';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

// Key boundary points: [lon, lat] coordinates that define projection extremes
// Most projections: poles give vertical extremes, antimeridian gives horizontal extremes
const DEFAULT_BOUNDS: Array<[number, number]> = [
  [0, 90], // North pole (top)
  [0, -90], // South pole (bottom)
  [-180, 0], // West edge (left)
  [180, 0], // East edge (right)
];

async function* reproject(
  sourceImage: HTMLImageElement,
  destProjection: GeoProjection,
  abortSignal: AbortSignal,
  boundsPoints: Array<[number, number]> = DEFAULT_BOUNDS,
): AsyncGenerator<{
  canvas: HTMLCanvasElement;
  pixelsCalculated: number;
  totalPixels: number;
}> {
  assert(destProjection.invert != null, 'projection must support inversion');

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  // First, find the natural bounds of the projection with unit scale
  const unitProjection = destProjection.scale(1).translate([0, 0]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Check boundary points to find extremes
  for (const [lon, lat] of boundsPoints) {
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

  const sourceCanvas = document.createElement('canvas');
  const destCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  destCanvas.width = destWidth;
  destCanvas.height = destHeight;

  const sourceCtx = sourceCanvas.getContext('2d');
  assert(sourceCtx != null, 'source canvas must have 2d context');
  const destCtx = destCanvas.getContext('2d');
  assert(destCtx != null, 'destination canvas must have 2d context');

  sourceCtx.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
  const sourceData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const destData = destCtx.createImageData(destWidth, destHeight);

  const startTime = performance.now();
  let lastYieldTime = startTime;
  let pixelsCalculated = 0;
  const totalPixels = destWidth * destHeight;

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      if (abortSignal.aborted) {
        return;
      }

      const destinationCoordinates: [number, number] = [x, y];
      const lonLat = destProjection.invert(destinationCoordinates);

      if (lonLat == null) {
        continue;
      }

      const sourceCoordinates = mercator(lonLat);
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

      const reprojectedCoordinates = destProjection(lonLat);
      // If the reprojected pixel ends up more than a rounding error away from the desired location,
      // we are in a part of the image where the projection wraps around and would show duplicative
      // content, so leave it blank.
      //
      // TODO: Is there a way to do this more analytically, instead of doubling the amount of math
      // we have to perform and by going in both directions?
      if (
        reprojectedCoordinates == null ||
        Math.abs(reprojectedCoordinates[0] - destinationCoordinates[0]) > 1e-6 ||
        Math.abs(reprojectedCoordinates[1] - destinationCoordinates[1]) > 1e-6
      ) {
        continue;
      }

      if (sourceCoordinates != null) {
        const [r, g, b, a] = bilinearInterpolate(
          sourceData,
          sourceCoordinates[0],
          sourceCoordinates[1],
        );

        const destIdx = (y * destWidth + x) * 4;
        destData.data[destIdx] = r;
        destData.data[destIdx + 1] = g;
        destData.data[destIdx + 2] = b;
        destData.data[destIdx + 3] = a;
      }

      pixelsCalculated++;
    }

    const currentTime = performance.now();
    if (currentTime - lastYieldTime >= 1000) {
      destCtx.putImageData(destData, 0, 0);
      yield { canvas: destCanvas, pixelsCalculated, totalPixels };
      lastYieldTime = currentTime;
    }
  }

  destCtx.putImageData(destData, 0, 0);
  yield { canvas: destCanvas, pixelsCalculated, totalPixels };
}

const managers = new WeakMap<HTMLImageElement, ReprojectableImageManager>();

async function reprojectWithProgress(
  image: HTMLImageElement,
  projection: GeoProjection,
  boundsPoints?: Array<[number, number]>,
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
    boundsPoints,
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
    await reprojectWithProgress(image, geoAirocean());
  },
  'Gall-Peters': async (image) => {
    await reprojectWithProgress(image, geoCylindricalEqualArea().parallel(45));
  },
  'Goode Homolosine': async (image) => {
    await reprojectWithProgress(image, geoInterruptedHomolosine());
  },
  'Hobo-Dyer': async (_image) => {
    console.warn('Hobo-Dyer projection not yet implemented');
  },
  'Peirce Quincuncial': async (_image) => {
    console.warn('Peirce Quincuncial projection not yet implemented');
  },
  'Plate Carrée (Equirectangular)': async (image) => {
    await reprojectWithProgress(image, geoEquirectangular());
  },
  Robinson: async (image) => {
    await reprojectWithProgress(image, geoRobinson());
  },
  'Van der Grinten': async (_image) => {
    console.warn('Van der Grinten projection not yet implemented');
  },
  'Waterman Butterfly': async (image) => {
    await reprojectWithProgress(image, geoPolyhedralWaterman());
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
