export const _projections = [
  'Robinson',
  'Gall-Peters',
  'Goode Homolosine',
  'Equirectangular',
  'Waterman Butterfly',
  'Dymaxion',
] as const;
export const PROJECTIONS = _projections as readonly Projection[];
export type Projection = (typeof _projections)[number];

export interface ExtensionMessage {
  projection: Projection;
}
