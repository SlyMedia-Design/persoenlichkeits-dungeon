/** Rasterbewegung ohne Phaser: Richtungen, Schritte und Wegsuche. */

export interface Pos {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'] as const;

const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function step(pos: Pos, dir: Dir): Pos {
  return { x: pos.x + DELTA[dir].x, y: pos.y + DELTA[dir].y };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Richtung von a zum direkt benachbarten Feld b (sonst undefined). */
export function dirTo(a: Pos, b: Pos): Dir | undefined {
  return DIRS.find((d) => samePos(step(a, d), b));
}

/**
 * Kürzester Weg (Breitensuche, 4 Richtungen) von `from` zu einem der Zielfelder.
 * Gibt die Richtungen der einzelnen Schritte zurück, [] wenn man schon dort ist,
 * und null, wenn kein Ziel erreichbar ist.
 */
export function findPath(from: Pos, targets: Pos[], walkable: (p: Pos) => boolean, maxNodes = 5000): Dir[] | null {
  const key = (p: Pos) => `${p.x},${p.y}`;
  const goal = new Set(targets.map(key));
  if (goal.has(key(from))) return [];
  const prev = new Map<string, { from: string; dir: Dir }>();
  const seen = new Set([key(from)]);
  const queue: Pos[] = [from];
  while (queue.length > 0 && seen.size <= maxNodes) {
    const p = queue.shift()!;
    for (const d of DIRS) {
      const n = step(p, d);
      const k = key(n);
      if (seen.has(k) || !walkable(n)) continue;
      seen.add(k);
      prev.set(k, { from: key(p), dir: d });
      if (goal.has(k)) {
        const path: Dir[] = [];
        let cur = k;
        while (cur !== key(from)) {
          const link = prev.get(cur)!;
          path.unshift(link.dir);
          cur = link.from;
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}
