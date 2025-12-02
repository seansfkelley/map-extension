import { geoEquirectangular, type GeoProjection } from 'd3-geo';
import {
  geoRobinson,
  geoCylindricalEqualArea,
  geoInterruptedHomolosine,
  geoPolyhedralWaterman,
  geoPeirceQuincuncial,
  geoVanDerGrinten,
  geoWinkel3,
} from 'd3-geo-projection';
import { geoAirocean } from 'd3-geo-polygon';
import { type Projection, LonLat } from './types';

const STANDARD_CRITICAL_POINTS: LonLat[] = [
  LonLat.of(0, 90), // north pole
  LonLat.of(0, -90), // south pole
  LonLat.of(-180, 0), // antimeridian (west)
  LonLat.of(180, 0), // antimerdian (east)
];

export interface ProjectionConfig {
  createGeoProjection: () => GeoProjection;
  boundsSamplingPoints: LonLat[];
}

export const projectionConfigs: Record<Projection, ProjectionConfig> = {
  Dymaxion: {
    createGeoProjection: () => geoAirocean(),
    boundsSamplingPoints: [
      // Calculated empirically, based on the particulars of the projection d3 provides, since there
      // are multiple layouts possible.
      LonLat.of(39, -51), // min X
      LonLat.of(132, -52), // max X
      LonLat.of(10, -24), // min Y
      LonLat.of(-179, -41), // max Y
    ],
  },
  'Gall-Peters': {
    createGeoProjection: () => geoCylindricalEqualArea().parallel(45),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  'Goode Homolosine': {
    createGeoProjection: () => geoInterruptedHomolosine(),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  'Hobo-Dyer': {
    createGeoProjection: () => geoCylindricalEqualArea().parallel(37.5),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  'Peirce Quincuncial': {
    createGeoProjection: () => geoPeirceQuincuncial(),
    boundsSamplingPoints: [
      // The four midpoints of the square's edges are at the equator on these meridians.
      LonLat.of(0, 0),
      LonLat.of(90, 0),
      LonLat.of(180, 0),
      LonLat.of(-90, 0),
    ],
  },
  'Plate Carrée (Equirectangular)': {
    createGeoProjection: () => geoEquirectangular(),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  Robinson: {
    createGeoProjection: () => geoRobinson(),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  'Van der Grinten': {
    createGeoProjection: () => geoVanDerGrinten(),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
  'Waterman Butterfly': {
    createGeoProjection: () => geoPolyhedralWaterman(),
    boundsSamplingPoints: [
      // There are variants of this projection, specifically around the south pole; these points are
      // chosen because the variation we use does not go all the way to the pole.
      //
      // South pole points, which dictate the left, right and bottom edges.
      LonLat.of(-180, -85),
      LonLat.of(-135, -85),
      LonLat.of(-90, -85),
      LonLat.of(-45, -85),
      LonLat.of(0, -85),
      LonLat.of(45, -85),
      LonLat.of(90, -85),
      LonLat.of(135, -85),
      LonLat.of(180, -85),
      // Antimeridian points near the equator, which dictate the top edge.
      LonLat.of(-180, 0),
      LonLat.of(180, 0),
    ],
  },
  'Winkel-Tripel': {
    createGeoProjection: () => geoWinkel3(),
    boundsSamplingPoints: STANDARD_CRITICAL_POINTS,
  },
};
