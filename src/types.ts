export const _projections = [
  // https://xkcd.com/977/
  'Van der Grinten',
  'Robinson',
  'Dymaxion',
  'Winkel-Tripel',
  'Goode Homolosine',
  'Hobo-Dyer',
  'Plate Carrée (Equirectangular)',
  'Waterman Butterfly',
  'Gall-Peters',
  'Peirce Quincuncial',
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
