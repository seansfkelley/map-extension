import { reproject } from '../src/reproject';
import { projectionConfigs } from '../src/projections';
import { PROJECTIONS } from '../src/types';
import { nodeCanvasFactory } from './canvasMock';
import * as path from 'path';

const fixturePath = path.join(__dirname, 'fixtures', 'mercator.png');

for (const projectionName of PROJECTIONS) {
  if (projectionName === 'Dymaxion') {
    continue;
  }
  it(`should correctly reproject to ${projectionName}`, async () => {
    const config = projectionConfigs[projectionName];
    const sourceImage = await nodeCanvasFactory.loadImage(fixturePath);

    const abortController = new AbortController();
    const projection = config.createGeoProjection();

    let finalCanvas: HTMLCanvasElement | undefined;

    for await (const { canvas } of reproject(
      sourceImage,
      projection,
      abortController.signal,
      config.boundsSamplingPoints,
      nodeCanvasFactory,
    )) {
      finalCanvas = canvas;
    }

    expect(finalCanvas).toBeDefined();
    // FIXME
    const buffer = (finalCanvas as any).toBuffer('image/png');
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: projectionName.replace(/[^a-zA-Z0-9]/g, '-'),
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  });
}
