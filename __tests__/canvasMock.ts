import { createCanvas, loadImage } from 'canvas';
import type { CanvasFactory } from '../src/reproject';

export const nodeCanvasFactory: CanvasFactory = {
  createCanvas(width: number, height: number) {
    return createCanvas(width, height) as unknown as HTMLCanvasElement;
  },
  async loadImage(src: string): Promise<HTMLImageElement> {
    const img = await loadImage(src);
    return img as unknown as HTMLImageElement;
  },
};
