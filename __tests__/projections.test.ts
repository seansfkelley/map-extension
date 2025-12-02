import { reproject } from '../src/reproject';
import { projectionConfigs } from '../src/projections';
import { Projection } from '../src/types';
import { nodeCanvasFactory } from './canvasMock';
import * as path from 'path';
import { Canvas } from 'canvas';

type FixtureSize = 'small' | 'medium' | 'large';

function getFixturePath(size: FixtureSize): string {
  return path.join(__dirname, 'fixtures', `mercator-${size}.png`);
}

// Use the largest that isn't unreasonably slow to be able to test interpolation fidelity too.
const FIXTURE_SIZES: Record<Projection, FixtureSize> = {
  'Dymaxion': 'small',
  'Gall-Peters': 'large',
  'Goode Homolosine': 'large',
  'Hobo-Dyer': 'large',
  'Peirce Quincuncial': 'large',
  'Plate Carrée (Equirectangular)': 'large',
  'Robinson': 'large',
  'Van der Grinten': 'large',
  'Waterman Butterfly': 'medium',
  'Winkel-Tripel': 'large',
};

it.each(Object.keys(FIXTURE_SIZES) as Projection[])(
  'should reproject %s to match the snapshot',
  async (projection) => {
    const config = projectionConfigs[projection];
    const sourceImage = await nodeCanvasFactory.loadImage(
      getFixturePath(FIXTURE_SIZES[projection]),
    );

    let finalCanvas: HTMLCanvasElement | undefined;

    for await (const { canvas } of reproject(
      sourceImage,
      config.createGeoProjection(),
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
      customSnapshotIdentifier: projection.replace(/[^a-zA-Z0-9]/g, '-'),
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  },
);
