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
  'Peirce Quincunial',
] as const;
export const PROJECTIONS = _projections as readonly Projection[];
export type Projection = (typeof _projections)[number];

export interface ExtensionMessage {
  projection: Projection;
}
