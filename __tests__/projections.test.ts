import { reproject } from '../src/reproject';
import { projectionConfigs } from '../src/projections';
import { PROJECTIONS } from '../src/types';
import { nodeCanvasFactory } from './canvasMock';
import * as path from 'path';
import { Canvas } from 'canvas';

const fixturePath = path.join(__dirname, 'fixtures', 'mercator.png');

for (const projectionName of PROJECTIONS) {
  if (projectionName === 'Dymaxion') {
    continue;
  }
  it(`should correctly reproject to ${projectionName}`, async () => {
    const config = projectionConfigs[projectionName];
    const sourceImage = await nodeCanvasFactory.loadImage(fixturePath);

    const projection = config.createGeoProjection();

    let finalCanvas: HTMLCanvasElement | undefined;

    for await (const { canvas } of reproject(
      sourceImage,
      projection,
      config.boundsSamplingPoints,
      nodeCanvasFactory,
      new AbortController().signal,
      config.longitudeOffset ?? 0,
    )) {
      finalCanvas = canvas;
    }

    expect(finalCanvas).toBeDefined();
    const buffer = (finalCanvas as unknown as Canvas).toBuffer('image/png');
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: projectionName.replace(/[^a-zA-Z0-9]/g, '-'),
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  });
}
