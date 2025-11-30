import type { ExtensionMessage, Projection } from './types';

let lastContextMenuTarget: HTMLImageElement | undefined;

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    lastContextMenuTarget = event.target;
  }
});

const callbacks: Record<Projection, (image: HTMLImageElement) => void> = {
  Robinson: (image) => {
    console.log('Converting to Robinson projection:', image);
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
