export const _projections = [
  // https://xkcd.com/977/
  'Dymaxion',
  'Gall-Peters',
  'Goode Homolosine',
  'Hobo-Dyer',
  'Peirce Quincuncial',
  'Plate Carrée (Equirectangular)',
  'Robinson',
  'Van der Grinten',
  'Waterman Butterfly',
  'Winkel-Tripel',
] as const;
export const PROJECTIONS = _projections as readonly Projection[];
export type Projection = (typeof _projections)[number];

export interface ExtensionMessage {
  projection: Projection;
}

export type LonLat = [lon: number, lat: number] & { __lonLat: unknown };
export const LonLat = {
  of: (lon: number, lat: number) => [lon, lat] as LonLat,
};

export type PixelCoordinates = [x: number, y: number] & { __pixelCoordinates: unknown };
export const PixelCoordinates = {
  of: (x: number, y: number) => [x, y] as PixelCoordinates,
};
