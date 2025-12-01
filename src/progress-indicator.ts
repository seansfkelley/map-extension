export class ProgressIndicator {
  private overlay: HTMLDivElement | null = null;
  private progressBox: HTMLDivElement | null = null;
  private spinner: HTMLDivElement | null = null;
  private progressText: HTMLDivElement | null = null;
  private targetImage: HTMLImageElement | null = null;
  private originalImageSrc: string | null = null;
  private updateInterval: number | null = null;

  private ensureOverlay(): HTMLDivElement {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'mercator-shmercator-indicator-overlay';
      document.body.appendChild(this.overlay);
    }
    return this.overlay;
  }

  show(image: HTMLImageElement): void {
    this.targetImage = image;
    this.originalImageSrc = image.src;

    const overlay = this.ensureOverlay();

    this.progressBox = document.createElement('div');
    this.progressBox.className = 'mercator-shmercator-progress-box';

    this.spinner = document.createElement('div');
    this.spinner.className = 'mercator-shmercator-spinner';

    this.progressText = document.createElement('div');
    this.progressText.className = 'mercator-shmercator-progress-text';
    this.progressText.textContent = '0%';

    this.progressBox.appendChild(this.spinner);
    this.progressBox.appendChild(this.progressText);
    overlay.appendChild(this.progressBox);

    this.updatePosition();
    this.updateInterval = window.setInterval(() => this.updatePosition(), 100);
  }

  updateProgress(percentage: number): void {
    if (this.progressText) {
      this.progressText.textContent = `${Math.round(percentage)}%`;
    }
  }

  complete(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (!this.progressBox || !this.spinner || !this.progressText) {
      return;
    }

    this.spinner.remove();

    const revertIcon = document.createElement('div');
    revertIcon.className = 'mercator-shmercator-revert-icon';
    revertIcon.title = 'Revert to original';

    this.progressBox.insertBefore(revertIcon, this.progressText);
    this.progressText.textContent = 'Revert';
    this.progressBox.classList.add('mercator-shmercator-completed');

    const handleRevert = () => {
      if (this.targetImage && this.originalImageSrc) {
        this.targetImage.src = this.originalImageSrc;
      }
      this.hide();
    };

    this.progressBox.addEventListener('click', handleRevert);
  }

  hide(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.progressBox) {
      this.progressBox.remove();
      this.progressBox = null;
    }

    this.spinner = null;
    this.progressText = null;
    this.targetImage = null;
    this.originalImageSrc = null;
  }

  private updatePosition(): void {
    if (!this.progressBox || !this.targetImage) {
      return;
    }

    const rect = this.targetImage.getBoundingClientRect();

    // Position in top-right corner with some padding
    const right = window.innerWidth - rect.right + 8;
    const top = rect.top + 8;

    this.progressBox.style.right = `${right}px`;
    this.progressBox.style.top = `${top}px`;
  }
}
