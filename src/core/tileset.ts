/** Beschreibung der Grafikkacheln (data/tileset.json) und die Baumplanung – ohne Phaser. */
import type { Pos } from './grid';

export interface TileRef {
  sheet: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface TilesetDef {
  sheets: Record<string, string>;
  grass: { base: TileRef; variants: TileRef[]; details: TileRef[] };
  autotiles: Record<string, TileRef & { innerCorners: boolean }>;
  objects: Record<string, TileRef[]>;
  trees: TileRef[];
  buildings: Record<string, TileRef & { w: number; h: number; door: Pos }>;
  actors: Record<string, ActorDef>;
  items: Record<string, string>;
  fx: Record<string, FxDef>;
  dungeon: {
    grass: TileRef;
    grassVariants: TileRef[];
    path: TileRef & { innerCorners: boolean };
    trees: TileRef[];
    bush: TileRef[];
    stairs: TileRef;
  };
}

export interface ActorDef {
  sheet: string;
  face?: string;
  /** Nur bei Figuren, die nicht dem 16×16-Raster mit 4 Blickrichtungen folgen */
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
}

export interface FxDef {
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

/**
 * Verteilt große Bäume (2×2 Felder) auf zusammenhängende Baumflächen.
 * Ankerpunkte liegen auf ungeraden Koordinaten, damit einreihige Ränder der Karte
 * mit dem Wald außerhalb zu vollen Bäumen verschmelzen. Baumfelder ohne Platz für
 * einen großen Baum werden zu Büschen.
 */
export function planTrees(
  isTree: (p: Pos) => boolean,
  from: Pos,
  to: Pos,
): { big: Pos[]; small: Pos[] } {
  const big: Pos[] = [];
  const covered = new Set<string>();
  const odd = (n: number) => ((n % 2) + 2) % 2 === 1;
  for (let y = from.y - 1; y <= to.y; y++) {
    for (let x = from.x - 1; x <= to.x; x++) {
      if (!odd(x) || !odd(y)) continue;
      const cells = [
        { x, y },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ];
      if (!cells.every(isTree)) continue;
      big.push({ x, y });
      for (const c of cells) covered.add(`${c.x},${c.y}`);
    }
  }
  const small: Pos[] = [];
  for (let y = from.y; y <= to.y; y++) {
    for (let x = from.x; x <= to.x; x++) {
      if (isTree({ x, y }) && !covered.has(`${x},${y}`)) small.push({ x, y });
    }
  }
  return { big, small };
}
