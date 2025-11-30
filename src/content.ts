import type { ExtensionMessage, Projection } from './types';
import { geoMercator, type GeoProjection } from 'd3-geo';
import { geoRobinson, geoCylindricalEqualArea } from 'd3-geo-projection';

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

function reproject(
  sourceImage: HTMLImageElement,
  destProjection: GeoProjection,
): HTMLCanvasElement {
  assert(destProjection.invert != null, 'projection must support inversion');

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

  // Calculate destination bounds from projection
  const westEdge = destProjection([-180, 0]);
  const eastEdge = destProjection([180, 0]);
  const northPole = destProjection([0, 90]);
  const southPole = destProjection([0, -90]);

  assert(westEdge != null && eastEdge != null && northPole != null && southPole != null);

  const destWidth = Math.ceil(eastEdge[0] - westEdge[0]);
  const destHeight = Math.ceil(southPole[1] - northPole[1]);

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

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const lonLat = destProjection.invert([x, y]);

      if (lonLat != null) {
        const sourcePixel = mercator(lonLat);

        if (sourcePixel != null) {
          const sx = Math.round(sourcePixel[0]);
          const sy = Math.round(sourcePixel[1]);

          if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
            const sourceIdx = (sy * sourceWidth + sx) * 4;
            const destIdx = (y * destWidth + x) * 4;

            destData.data[destIdx] = sourceData.data[sourceIdx];
            destData.data[destIdx + 1] = sourceData.data[sourceIdx + 1];
            destData.data[destIdx + 2] = sourceData.data[sourceIdx + 2];
            destData.data[destIdx + 3] = sourceData.data[sourceIdx + 3];
          }
        }
      }
    }
  }

  destCtx.putImageData(destData, 0, 0);
  return destCanvas;
}

const callbacks: Record<Projection, (image: HTMLImageElement) => void> = {
  Robinson: (image) => {
    image.src = reproject(
      image,
      geoRobinson()
        .scale(image.width / (2 * Math.PI))
        .translate([image.width / 2, image.height / 2]),
    ).toDataURL();
  },
  'Gall-Peters': (image) => {
    image.src = reproject(
      image,
      geoCylindricalEqualArea()
        .parallel(45)
        .scale(image.width / (2 * Math.PI))
        .translate([image.width / 2, image.height / 2]),
    ).toDataURL();
  },
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    callbacks[message.projection]?.(lastContextMenuTarget);
  }
});
