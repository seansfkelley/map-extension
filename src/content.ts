import type { ExtensionMessage, Projection } from './types';
import { geoMercator } from 'd3-geo';
import { geoRobinson } from 'd3-geo-projection';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

function reprojectToRobinson(sourceImage: HTMLImageElement): HTMLCanvasElement {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  const mercator = geoMercator()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);

  const robinson = geoRobinson()
    .scale(width / 5.332539516)
    .translate([width / 2, height / 2]);

  const sourceCanvas = document.createElement('canvas');
  const destCanvas = document.createElement('canvas');
  sourceCanvas.width = destCanvas.width = width;
  sourceCanvas.height = destCanvas.height = height;

  const sourceCtx = sourceCanvas.getContext('2d');
  const destCtx = destCanvas.getContext('2d');

  if (sourceCtx == null || destCtx == null) {
    throw new Error('Failed to get canvas context');
  }

  sourceCtx.drawImage(sourceImage, 0, 0, width, height);
  const sourceData = sourceCtx.getImageData(0, 0, width, height);
  const destData = destCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lonLat = robinson.invert([x, y]);

      if (lonLat != null) {
        const sourcePixel = mercator(lonLat);

        if (sourcePixel != null) {
          const sx = Math.round(sourcePixel[0]);
          const sy = Math.round(sourcePixel[1]);

          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const sourceIdx = (sy * width + sx) * 4;
            const destIdx = (y * width + x) * 4;

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
    const canvas = reprojectToRobinson(image);
    image.src = canvas.toDataURL();
  },
  'Gall-Peters': (image) => {
    console.log('Converting to Gall-Peters projection:', image);
  },
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    callbacks[message.projection]?.(lastContextMenuTarget);
  }
});
