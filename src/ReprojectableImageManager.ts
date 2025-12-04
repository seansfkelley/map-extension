import { assert, assertNever } from './util';

let overlaySingleton: HTMLDivElement | undefined;

function getOverlaySingleton(): HTMLDivElement {
  if (!overlaySingleton) {
    overlaySingleton = document.createElement('div');
    overlaySingleton.className = 'mercator-schmercator-indicator-overlay';
    document.documentElement.append(overlaySingleton);
  }
  return overlaySingleton;
}

export type OperationState = 'in-progress' | 'completed' | 'failed' | 'aborted';

class ReprojectionOperation {
  private _state: OperationState = 'in-progress';

  constructor(
    private subtitle: HTMLDivElement,
    public readonly abort: () => void,
    private onEnd: (state: Exclude<OperationState, 'in-progress'>) => void,
  ) {
    this.subtitle.textContent = '0%';
  }

  public get state() {
    return this._state;
  }

  public updateProgress(fraction: number): void {
    assert(this.state === 'in-progress', 'can only update operations that are in progress');
    this.subtitle.textContent = `${Math.round(fraction * 100)}%`;
  }

  public onAborted(): void {
    if (this.state === 'in-progress') {
      this._state = 'aborted';
      this.onEnd(this._state);
    }
  }

  public onFailed(): void {
    if (this.state === 'in-progress') {
      this._state = 'failed';
      this.onEnd(this._state);
    }
  }

  public onComplete(): void {
    if (this.state === 'in-progress') {
      this._state = 'completed';
      this.onEnd(this._state);
    }
  }
}

export class ReprojectableImageManager {
  public readonly originalImageSrc: string;
  private imageElement: HTMLImageElement;
  private isInitialized = false;

  private previousOperation: ReprojectionOperation | undefined;
  private updateInterval: number | undefined;

  private container: HTMLDivElement | undefined;
  private subtitle: HTMLDivElement | undefined;

  public constructor(image: HTMLImageElement) {
    this.imageElement = image;
    this.originalImageSrc = this.imageElement.src;
  }

  public startReprojectionOperation(abort: () => void): ReprojectionOperation {
    assert(
      this.previousOperation == null || this.previousOperation.state !== 'in-progress',
      'cannot start an operation if one is in progress',
    );

    this.maybeInitialize();
    this.assertInitialized();
    this.showSpinner();

    const previousImageSrc = this.imageElement.src;

    this.previousOperation = new ReprojectionOperation(this.subtitle!, abort, (result) => {
      if (result === 'completed') {
        this.showRevertButton();
      } else if (result === 'failed') {
        this.showError();
      } else if (result === 'aborted') {
        if (previousImageSrc === this.imageElement.src) {
          this.hide();
        } else {
          this.showRevertButton();
        }
      } else {
        assertNever(result);
      }
    });

    return this.previousOperation;
  }

  private assertInitialized() {
    assert(this.isInitialized, 'indicator must be initialized before being interacted with');
  }

  private maybeInitialize() {
    if (this.isInitialized) {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'mercator-schmercator-container';
    this.container.addEventListener('click', () => {
      assert(
        this.previousOperation != null,
        'should not be visible if an operation was never started',
      );

      if (this.previousOperation.state === 'in-progress') {
        this.previousOperation.abort();
      } else if (this.previousOperation.state === 'failed') {
        if (this.originalImageSrc === this.imageElement.src) {
          this.hide();
        } else {
          this.showRevertButton();
        }
      } else if (
        this.previousOperation.state === 'completed' ||
        this.previousOperation.state === 'aborted'
      ) {
        // Aborted is included here because if we abort an operation, we either hide ourselves (in
        // which case we cannot be interacted with) or we show the reversion button (in which case
        // we're here).
        this.imageElement.src = this.originalImageSrc;
        this.hide();
      } else {
        assertNever(this.previousOperation.state);
      }
    });

    const spinner = document.createElement('div');
    spinner.className = 'mercator-schmercator-spinner';

    const cancelIcon = document.createElement('div');
    cancelIcon.className = 'mercator-schmercator-icon cancel';
    cancelIcon.textContent = '✕';

    const errorIcon = document.createElement('div');
    errorIcon.className = 'mercator-schmercator-icon error';
    errorIcon.textContent = '⚠';

    const closeIcon = document.createElement('div');
    closeIcon.className = 'mercator-schmercator-icon close';
    closeIcon.textContent = '✕';

    const revertIcon = document.createElement('div');
    revertIcon.className = 'mercator-schmercator-icon revert';
    revertIcon.textContent = '↺';
    revertIcon.title = 'Revert to original';

    this.subtitle = document.createElement('div');
    this.subtitle.className = 'mercator-schmercator-subtitle';

    this.container.appendChild(spinner);
    this.container.appendChild(cancelIcon);
    this.container.appendChild(errorIcon);
    this.container.appendChild(closeIcon);
    this.container.appendChild(revertIcon);
    this.container.appendChild(this.subtitle);

    getOverlaySingleton().appendChild(this.container);

    this.isInitialized = true;
  }

  private showSpinner(): void {
    this.assertInitialized();

    this.container!.className = 'mercator-schmercator-container state-spinner';
    this.subtitle!.textContent = '0%';

    this.trackMovingTarget();
  }

  private showRevertButton() {
    this.assertInitialized();

    this.container!.className = 'mercator-schmercator-container state-revert';
    this.subtitle!.textContent = 'Revert';

    this.trackMovingTarget();
  }

  private showError(): void {
    this.assertInitialized();

    this.container!.className = 'mercator-schmercator-container state-error';
    this.subtitle!.textContent = 'Error';

    this.trackMovingTarget();
  }

  private hide(): void {
    this.assertInitialized();

    assert(this.container != null, 'container must exist');
    this.container.className = 'mercator-schmercator-container state-hidden';

    clearInterval(this.updateInterval);
  }

  private trackMovingTarget(): void {
    if (this.updateInterval == null) {
      const follow = () => {
        this.assertInitialized();
        assert(this.container != null, 'container must exist if not destroyed');

        const rect = this.imageElement.getBoundingClientRect();

        const left = window.pageXOffset + rect.right - this.container.offsetWidth - 8;
        const top = window.pageYOffset + rect.top + 8;

        this.container.style.left = `${left}px`;
        this.container.style.top = `${top}px`;
      };
      follow();
      this.updateInterval = window.setInterval(follow, 100);
    }
  }
}
