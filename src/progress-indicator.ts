import { assert } from './util';

let overlaySingleton: HTMLDivElement | undefined;

function getOverlaySingleton(): HTMLDivElement {
  if (!overlaySingleton) {
    overlaySingleton = document.createElement('div');
    overlaySingleton.className = 'mercator-shmercator-indicator-overlay';
    document.documentElement.append(overlaySingleton);
  }
  return overlaySingleton;
}

type InitializationState = 'uninitialized' | 'initialized' | 'destroyed';

export class ProgressIndicator {
  private targetImage: HTMLImageElement;
  private originalImageSrc: string;
  private abortController: AbortController = new AbortController();
  private state: InitializationState = 'uninitialized';

  private container: HTMLDivElement | undefined;
  private spinner: HTMLDivElement | undefined;
  private progressText: HTMLDivElement | undefined;
  private updateInterval: number | undefined;

  constructor(image: HTMLImageElement) {
    this.targetImage = image;
    this.originalImageSrc = image.src;
  }

  private assertNotDestroyed() {
    assert(this.state !== 'destroyed', 'cannot modify a destroyed progress indicator');
  }

  private maybeInitialize() {
    this.assertNotDestroyed();
    if (this.state === 'initialized') {
      return;
    }

    const overlay = getOverlaySingleton();

    this.container = document.createElement('div');
    this.container.className = 'mercator-shmercator-progress-box';

    this.spinner = document.createElement('div');
    this.spinner.className = 'mercator-shmercator-spinner';

    this.progressText = document.createElement('div');
    this.progressText.className = 'mercator-shmercator-progress-text';
    this.progressText.textContent = '0%';

    this.container.appendChild(this.spinner);
    this.container.appendChild(this.progressText);
    overlay.appendChild(this.container);

    this.spinner.addEventListener('click', () => {
      this.abortController.abort();

      if (this.targetImage && this.originalImageSrc) {
        this.targetImage.src = this.originalImageSrc;
      }

      this.destroy();
    });

    this.state = 'initialized';
  }

  show(): void {
    this.assertNotDestroyed();
    this.maybeInitialize();

    this.updatePosition();
    this.updateInterval = window.setInterval(() => this.updatePosition(), 100);

    assert(this.container != null, 'container must exist after being initialized');
    // empty string = do whatever the CSS says
    this.container.style.display = '';
  }

  hide(): void {
    this.assertNotDestroyed();
    assert(this.container != null, 'container must exist after being initialized');
    this.container.style.display = 'none';
  }

  getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  updateProgress(percentage: number): void {
    this.assertNotDestroyed();

    if (this.progressText) {
      this.progressText.textContent = `${Math.round(percentage)}%`;
    }
  }

  complete(): void {
    this.assertNotDestroyed();

    if (this.updateInterval != null) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    if (!this.container || !this.spinner || !this.progressText) {
      return;
    }

    this.spinner.remove();

    const revertIcon = document.createElement('div');
    revertIcon.className = 'mercator-shmercator-revert-icon';
    revertIcon.title = 'Revert to original';

    this.container.insertBefore(revertIcon, this.progressText);
    this.progressText.textContent = 'Revert';
    this.container.classList.add('mercator-shmercator-completed');

    const handleRevert = () => {
      if (this.targetImage && this.originalImageSrc) {
        this.targetImage.src = this.originalImageSrc;
      }
      this.destroy();
    };

    this.container.addEventListener('click', handleRevert);
  }

  public destroy(): void {
    if (this.state === 'destroyed') {
      return;
    }
    this.state = 'destroyed';

    if (this.updateInterval != null) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.container?.remove();
  }

  private updatePosition(): void {
    this.assertNotDestroyed();

    if (!this.container || !this.targetImage) {
      return;
    }

    const rect = this.targetImage.getBoundingClientRect();

    const left = window.pageXOffset + rect.right - this.container.offsetWidth - 8;
    const top = window.pageYOffset + rect.top + 8;

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }
}
