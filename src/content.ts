import { type ExtensionMessage, Projection } from './types';
import { ReprojectableImageManager } from './ReprojectableImageManager';
import { assert } from './util';
import { projectionConfigs } from './projections';
import { CanvasFactory, reproject } from './reproject';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

const domCanvasFactory: CanvasFactory = {
  createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  loadImage(src: string, crossOrigin?: string | null): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (crossOrigin != null) {
        img.crossOrigin = crossOrigin;
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('failed to load original image'));
      img.src = src;
    });
  },
};

const managers = new WeakMap<HTMLImageElement, ReprojectableImageManager>();

async function reprojectIncrementally(
  image: HTMLImageElement,
  projection: Projection,
): Promise<void> {
  if (!managers.has(image)) {
    managers.set(image, new ReprojectableImageManager(image));
  }

  const manager = managers.get(image);
  assert(manager != null, 'original image source must be stored');

  const abortController = new AbortController();
  const operation = manager.startReprojectionOperation(abortController.abort.bind(abortController));

  try {
    const transientSourceImage = new Image();
    transientSourceImage.crossOrigin = image.crossOrigin;

    await new Promise<void>((resolve, reject) => {
      transientSourceImage.onload = () => resolve();
      transientSourceImage.onerror = () => reject(new Error('failed to load original image'));
      transientSourceImage.src = manager.originalImageSrc;
    });

    const startTime = performance.now();

    for await (const { canvas, pixelsCalculated, totalPixels } of reproject(
      transientSourceImage,
      projectionConfigs[projection],
      domCanvasFactory,
      abortController.signal.throwIfAborted.bind(abortController.signal),
    )) {
      operation.updateProgress(pixelsCalculated / totalPixels);
      image.src = canvas.toDataURL();
      // release to the event loop to prevent the browser from completely locking up and to permit
      // the user to hit the cancel button
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    console.log(`reprojected image in ${performance.now() - startTime}ms`);

    operation.onComplete();
  } catch (e) {
    if (abortController.signal.aborted) {
      operation.onAborted();
    } else {
      console.error('error while trying to reproject image', e);
      operation.onFailed();
    }
  }
}

chrome.runtime.onMessage.addListener(async (message: ExtensionMessage) => {
  if (lastContextMenuTarget != null) {
    await reprojectIncrementally(lastContextMenuTarget, message.projection);
  }
});
