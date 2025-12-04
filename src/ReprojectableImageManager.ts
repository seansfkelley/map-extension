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

/** Visible for testing. */
export class ReprojectionOperation {
  private _state: OperationState = 'in-progress';

  constructor(
    private onUpdate: (fraction: number) => void,
    public readonly abort: () => void,
    private onEnd: (state: Exclude<OperationState, 'in-progress'>) => void,
  ) {
    this.onUpdate(0);
  }

  public get state() {
    return this._state;
  }

  public updateProgress(fraction: number): void {
    assert(this.state === 'in-progress', 'can only update operations that are in progress');
    this.onUpdate(fraction);
  }

  public onAborted(): void {
    assert(this.state === 'in-progress', 'can only abort operations that are in-progress');
    this._state = 'aborted';
    this.onEnd(this._state);
  }

  public onFailed(): void {
    assert(this.state === 'in-progress', 'can only fail operations that are in-progress');
    this._state = 'failed';
    this.onEnd(this._state);
  }

  public onComplete(): void {
    assert(this.state === 'in-progress', 'can only complete operations that are in-progress');
    this._state = 'completed';
    this.onEnd(this._state);
  }
}

export class ReprojectableImageManager {
  public readonly originalImageSrc: string;
  private imageElement: HTMLImageElement;
  private isInitialized = false;

  private operations: ReprojectionOperation[] = [];
  private updateInterval: number | undefined;

  private container: HTMLDivElement | undefined;
  private subtitle: HTMLDivElement | undefined;

  public constructor(image: HTMLImageElement) {
    this.imageElement = image;
    this.originalImageSrc = this.imageElement.src;
  }

  public startReprojectionOperation(abort: () => void): ReprojectionOperation {
    assert(
      this.operations.length === 0 || this.operations.at(-1)!.state !== 'in-progress',
      'cannot start an operation if one is in progress',
    );

    this.maybeInitialize();
    this.assertInitialized();
    this.showSpinner();

    const previousImageSrc = this.imageElement.src;

    this.operations.push(
      new ReprojectionOperation(
        (fraction) => {
          this.subtitle!.textContent = `${Math.round(fraction * 100)}%`;
        },
        abort,
        (result) => {
          if (result === 'completed') {
            // nop!
          } else if (result === 'failed') {
            this.imageElement.src = previousImageSrc;
          } else if (result === 'aborted') {
            this.imageElement.src = previousImageSrc;
            this.operations.pop();
          } else {
            assertNever(result);
          }
          this.updateView();
        },
      ),
    );

    return this.operations.at(-1)!;
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
      const currentOperation = this.operations.at(-1);
      assert(currentOperation != null, 'should not be visible if an operation was never started');
      assert(
        currentOperation.state !== 'aborted',
        'aborted operations should not be present to click on',
      );

      if (currentOperation.state === 'in-progress') {
        currentOperation.abort();
      } else if (currentOperation.state === 'failed') {
        this.operations.pop();
      } else if (currentOperation.state === 'completed') {
        this.imageElement.src = this.originalImageSrc;
        this.operations = [];
      } else {
        assertNever(currentOperation.state);
      }

      this.updateView();
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

  private updateView(): void {
    const currentOperation = this.operations.at(-1);
    if (currentOperation == null) {
      this.hide();
    } else if (currentOperation.state === 'completed') {
      this.showRevertButton();
    } else if (currentOperation.state === 'failed') {
      this.showError();
    } else if (currentOperation.state === 'in-progress') {
      this.showSpinner();
    } else if (currentOperation.state === 'aborted') {
      throw new Error('should never be asked to render when the current operation is aborted');
    } else {
      assertNever(currentOperation.state);
    }
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
    this.updateInterval = undefined;
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
