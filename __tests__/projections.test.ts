import { reproject } from '../src/reproject';
import { projectionConfigs } from '../src/projections';
import { Projection, PROJECTIONS } from '../src/types';
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
  'Peirce Quincuncial': 'medium',
  'Plate Carrée (Equirectangular)': 'large',
  'Robinson': 'large',
  'Van der Grinten': 'large',
  'Waterman Butterfly': 'medium',
  'Winkel-Tripel': 'large',
};

// Jest timeouts are apparently not the right tool for this job -- they are only for catching hangs,
// rather than enforcing a specific time bound. Implement time bounds ourselves.
const DEFAULT_MAX_DURATION = 2500;
const MAX_DURATION_OVERRIDES: Partial<Record<Projection, number>> = {
  Dymaxion: 7500,
};

it.each([...PROJECTIONS].sort())(
  `should reproject %s to match the snapshot`,
  async (projection) => {
    const config = projectionConfigs[projection];
    const sourceImage = await nodeCanvasFactory.loadImage(
      getFixturePath(FIXTURE_SIZES[projection]),
    );

    let finalCanvas: HTMLCanvasElement | undefined;
    const startTime = performance.now();

    for await (const { canvas } of reproject(sourceImage, config, nodeCanvasFactory, () => {})) {
      finalCanvas = canvas;

      expect(performance.now() - startTime).toBeLessThan(
        MAX_DURATION_OVERRIDES[projection] || DEFAULT_MAX_DURATION,
      );
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
