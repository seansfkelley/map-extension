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

export class ReprojectionOperation {
  public readonly abortController = new AbortController();
  private completed = false;

  constructor(
    private subtitle: HTMLDivElement,
    public readonly originalImageSrc: string,
    private onComplete: () => void,
  ) {
    this.subtitle.textContent = '0%';
  }

  public updateProgress(fraction: number): void {
    this.subtitle.textContent = `${Math.round(fraction * 100)}%`;
  }

  public tryComplete(): void {
    if (!this.completed && !this.abortController.signal.aborted) {
      this.onComplete();
      this.completed = false;
    }
  }
}

export class ConversionStateManager {
  private originalImageSrc: string;
  private imageElement: HTMLImageElement;
  private previousImageSrc: string;
  private isInitialized = false;

  private currentOperation: ReprojectionOperation | undefined;
  private updateInterval: number | undefined;

  private container: HTMLDivElement | undefined;
  private spinner: HTMLDivElement | undefined;
  private cancelIcon: HTMLDivElement | undefined;
  private revertIcon: HTMLDivElement | undefined;
  private subtitle: HTMLDivElement | undefined;

  constructor(image: HTMLImageElement) {
    this.imageElement = image;
    this.originalImageSrc = this.imageElement.src;
    this.previousImageSrc = this.imageElement.src;
  }

  public startReprojection(): ReprojectionOperation {
    assert(this.currentOperation == null, 'cannot start an operation if one is in progress');

    this.maybeInitialize();
    this.assertInitialized();
    this.showIndicator();

    this.previousImageSrc = this.imageElement.src;

    this.currentOperation = new ReprojectionOperation(this.subtitle!, this.originalImageSrc, () => {
      this.assertInitialized();
      this.currentOperation = undefined;

      this.spinner!.remove();
      this.cancelIcon!.remove();
      this.container!.insertBefore(this.revertIcon!, this.subtitle!);
      this.subtitle!.textContent = 'Revert';
    });

    this.revertIcon!.remove();
    this.container!.insertBefore(this.spinner!, this.subtitle!);
    this.container!.insertBefore(this.cancelIcon!, this.subtitle!);

    return this.currentOperation;
  }

  private assertInitialized() {
    assert(this.isInitialized, 'indicator must be initialized before being interacted with');
  }

  private maybeInitialize() {
    if (this.isInitialized) {
      return;
    }

    const overlay = getOverlaySingleton();

    this.container = document.createElement('div');
    this.container.className = 'mercator-shmercator-container';

    this.spinner = document.createElement('div');
    this.spinner.className = 'mercator-shmercator-spinner';

    this.cancelIcon = document.createElement('div');
    this.cancelIcon.className = 'mercator-shmercator-cancel-icon';
    this.cancelIcon.addEventListener('click', () => {
      assert(this.currentOperation != null, 'cannot cancel if no operation is in progress');
      this.currentOperation.abortController.abort();
      this.imageElement.src = this.previousImageSrc;
      if (this.previousImageSrc === this.originalImageSrc) {
        this.hideIndicator();
      }
    });

    this.subtitle = document.createElement('div');
    this.subtitle.className = 'mercator-shmercator-subtitle';

    this.container.appendChild(this.spinner);
    this.container.appendChild(this.cancelIcon);
    this.container.appendChild(this.subtitle);
    overlay.appendChild(this.container);

    this.revertIcon = document.createElement('div');
    this.revertIcon.className = 'mercator-shmercator-revert-icon';
    this.revertIcon.title = 'Revert to original';
    this.revertIcon.addEventListener('click', () => {
      assert(this.currentOperation == null, 'cannot revert if an operation is in progress');
      this.imageElement.src = this.originalImageSrc;
      this.hideIndicator();
    });

    this.isInitialized = true;
  }

  private showIndicator(): void {
    this.assertInitialized();

    assert(this.container != null, 'container must exist');
    this.container.style.display = ''; // empty string = do whatever the CSS says

    clearInterval(this.updateInterval);
    this.updatePosition();
    this.updateInterval = window.setInterval(() => this.updatePosition(), 100);
  }

  private hideIndicator(): void {
    this.assertInitialized();

    assert(this.container != null, 'container must exist');
    this.container.style.display = 'none';

    clearInterval(this.updateInterval);
  }

  private updatePosition(): void {
    this.assertInitialized();
    assert(this.container != null, 'container must exist if not destroyed');

    const rect = this.imageElement.getBoundingClientRect();

    const left = window.pageXOffset + rect.right - this.container.offsetWidth - 8;
    const top = window.pageYOffset + rect.top + 8;

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }
}
