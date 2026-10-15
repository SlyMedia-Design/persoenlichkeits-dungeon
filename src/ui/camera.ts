import { TILE } from './tiles';

/** Mindestens so viele Felder sollen in Breite und Höhe sichtbar sein */
const MIN_TILES_X = 11;
const MIN_TILES_Y = 14;

/**
 * Ganzzahliger Zoom, damit die Pixel scharf bleiben:
 * am Handy ca. 12, am Desktop ca. 20 Felder breit.
 */
export function pixelZoom(width: number, height: number): number {
  return Math.max(2, Math.round(Math.min(width / (MIN_TILES_X * TILE), height / (MIN_TILES_Y * TILE))));
}
