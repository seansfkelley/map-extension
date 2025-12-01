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

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

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
  boundsPoints: Array<[number, number]> = DEFAULT_BOUNDS,
): AsyncGenerator<{ canvas: HTMLCanvasElement; pixelsCalculated: number }> {
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

  console.log({ naturalWidth, naturalHeight, scale, destWidth, destHeight });

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
  const destCtx = destCanvas.getContext('2d');

  if (sourceCtx == null || destCtx == null) {
    throw new Error('Failed to get canvas context');
  }

  sourceCtx.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
  const sourceData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const destData = destCtx.createImageData(destWidth, destHeight);

  const startTime = performance.now();
  let lastYieldTime = startTime;
  let pixelsCalculated = 0;

  console.log('Starting reprojection loop...');
  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const destPixel: [number, number] = [x, y];
      const lonLat = destProjection.invert(destPixel);

      if (
        lonLat != null &&
        lonLat[0] >= -180 &&
        lonLat[0] <= 180 &&
        lonLat[1] >= -90 &&
        lonLat[1] <= 90
      ) {
        const verifyPixel = destProjection(lonLat);
        if (
          verifyPixel != null &&
          Math.abs(verifyPixel[0] - destPixel[0]) < 0.5 &&
          Math.abs(verifyPixel[1] - destPixel[1]) < 0.5
        ) {
          const sourcePixel = mercator(lonLat);

          if (sourcePixel != null) {
            const sx = sourcePixel[0];
            const sy = sourcePixel[1];

            if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
              const [r, g, b, a] = bilinearInterpolate(sourceData, sx, sy);

              const destIdx = (y * destWidth + x) * 4;
              destData.data[destIdx] = r;
              destData.data[destIdx + 1] = g;
              destData.data[destIdx + 2] = b;
              destData.data[destIdx + 3] = a;
            }
          }
        }
      }

      pixelsCalculated++;
    }

    // Yield after completing a row, but only if approximately 1 second has elapsed
    const currentTime = performance.now();
    if (currentTime - lastYieldTime >= 1000) {
      destCtx.putImageData(destData, 0, 0);
      const elapsed = currentTime - startTime;
      console.log(
        `Progress: ${y + 1}/${destHeight} rows, ${pixelsCalculated} pixels (${elapsed.toFixed(0)}ms elapsed)`,
      );
      yield { canvas: destCanvas, pixelsCalculated };
      lastYieldTime = currentTime;
    }
  }

  // Final yield with complete image
  destCtx.putImageData(destData, 0, 0);
  const endTime = performance.now();
  console.log(`Reprojection complete in ${(endTime - startTime).toFixed(0)}ms`);
  console.log(`Output canvas: ${destCanvas.width}x${destCanvas.height}`);
  yield { canvas: destCanvas, pixelsCalculated };
}

const callbacks: Record<Projection, (image: HTMLImageElement) => Promise<void>> = {
  Dymaxion: async (image) => {
    for await (const { canvas } of reproject(image, geoAirocean())) {
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },
  'Gall-Peters': async (image) => {
    for await (const { canvas } of reproject(image, geoCylindricalEqualArea().parallel(45))) {
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },
  'Goode Homolosine': async (image) => {
    for await (const { canvas } of reproject(image, geoInterruptedHomolosine())) {
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },
  'Hobo-Dyer': async (_image) => {
    console.warn('Hobo-Dyer projection not yet implemented');
  },
  'Peirce Quincuncial': async (_image) => {
    console.warn('Peirce Quincuncial projection not yet implemented');
  },
  'Plate Carrée (Equirectangular)': async (image) => {
    for await (const { canvas } of reproject(image, geoEquirectangular())) {
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },
  Robinson: async (image) => {
    console.log(
      `Input image: ${image.width}x${image.height}, natural: ${image.naturalWidth}x${image.naturalHeight}`,
    );
    for await (const { canvas } of reproject(image, geoRobinson())) {
      console.log(`Before setting src - image dimensions: ${image.width}x${image.height}`);
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
      console.log(`After setting src - image dimensions: ${image.width}x${image.height}`);
    }
  },
  'Van der Grinten': async (_image) => {
    console.warn('Van der Grinten projection not yet implemented');
  },
  'Waterman Butterfly': async (image) => {
    for await (const { canvas } of reproject(image, geoPolyhedralWaterman())) {
      image.src = canvas.toDataURL();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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
