declare module 'd3-geo-projection' {
  import { GeoProjection } from 'd3-geo';

  export function geoRobinson(): GeoProjection;
  export function geoCylindricalEqualArea(): GeoProjection & {
    parallel(angle: number): GeoProjection;
  };
  export function geoInterruptedHomolosine(): GeoProjection;
  export function geoPolyhedralWaterman(): GeoProjection;
}
