import { type ExtensionMessage, LonLat } from './types';
import { type GeoProjection } from 'd3-geo';
import { ReprojectableImageManager } from './ReprojectableImageManager';
import { assert } from './util';
import { projectionConfigs } from './projections';
import { reproject } from './reproject';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

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

chrome.runtime.onMessage.addListener(async (message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    const { createGeoProjection, boundsSamplingPoints } = projectionConfigs[message.projection];
    await reprojectIncrementally(
      lastContextMenuTarget,
      createGeoProjection(),
      boundsSamplingPoints,
    );
  }
});
