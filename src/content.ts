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

function reproject(
  sourceImage: HTMLImageElement,
  destProjection: GeoProjection,
  boundsPoints: Array<[number, number]> = DEFAULT_BOUNDS,
): HTMLCanvasElement {
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
  console.log('Starting reprojection loop...');
  for (let y = 0; y < destHeight; y++) {
    if (y % 100 === 0) {
      const elapsed = performance.now() - startTime;
      console.log(`Progress: ${y}/${destHeight} (${elapsed.toFixed(0)}ms elapsed)`);
    }
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
        // Verify this pixel is actually within the projection bounds
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

            // Check if the fractional coordinates are within bounds
            if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
              // Use bilinear interpolation to blend adjacent pixels
              const [r, g, b, a] = bilinearInterpolate(
                sourceData,
                sourceWidth,
                sourceHeight,
                sx,
                sy,
              );

              const destIdx = (y * destWidth + x) * 4;
              destData.data[destIdx] = r;
              destData.data[destIdx + 1] = g;
              destData.data[destIdx + 2] = b;
              destData.data[destIdx + 3] = a;
            }
          }
        }
      }
    }
  }

  destCtx.putImageData(destData, 0, 0);
  const endTime = performance.now();
  console.log(`Reprojection complete in ${(endTime - startTime).toFixed(0)}ms`);
  console.log(`Output canvas: ${destCanvas.width}x${destCanvas.height}`);
  return destCanvas;
}

const callbacks: Record<Projection, (image: HTMLImageElement) => void> = {
  Dymaxion: (image) => {
    image.src = reproject(image, geoAirocean()).toDataURL();
  },
  'Gall-Peters': (image) => {
    image.src = reproject(image, geoCylindricalEqualArea().parallel(45)).toDataURL();
  },
  'Goode Homolosine': (image) => {
    image.src = reproject(image, geoInterruptedHomolosine()).toDataURL();
  },
  'Hobo-Dyer': (_image) => {
    console.warn('Hobo-Dyer projection not yet implemented');
  },
  'Peirce Quincuncial': (_image) => {
    console.warn('Peirce Quincuncial projection not yet implemented');
  },
  'Plate Carrée (Equirectangular)': (image) => {
    image.src = reproject(image, geoEquirectangular()).toDataURL();
  },
  Robinson: (image) => {
    console.log(
      `Input image: ${image.width}x${image.height}, natural: ${image.naturalWidth}x${image.naturalHeight}`,
    );
    const canvas = reproject(image, geoRobinson());
    console.log(`Before setting src - image dimensions: ${image.width}x${image.height}`);
    image.src = canvas.toDataURL();
    console.log(`After setting src - image dimensions: ${image.width}x${image.height}`);
  },
  'Van der Grinten': (_image) => {
    console.warn('Van der Grinten projection not yet implemented');
  },
  'Waterman Butterfly': (image) => {
    image.src = reproject(image, geoPolyhedralWaterman()).toDataURL();
  },
  'Winkel-Tripel': (_image) => {
    console.warn('Winkel-Tripel projection not yet implemented');
  },
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    callbacks[message.projection]?.(lastContextMenuTarget);
  }
});
