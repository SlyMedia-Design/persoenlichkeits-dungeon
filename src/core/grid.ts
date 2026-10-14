/** Rasterbewegung ohne Phaser: Richtungen (auch schräg), Schritte und Wegsuche. */

export interface Pos {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

/** Gerade Richtungen zuerst, damit die Wegsuche gerade Wege bevorzugt */
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'] as const;

const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  'up-left': { x: -1, y: -1 },
  'up-right': { x: 1, y: -1 },
  'down-left': { x: -1, y: 1 },
  'down-right': { x: 1, y: 1 },
};

export function step(pos: Pos, dir: Dir): Pos {
  return { x: pos.x + DELTA[dir].x, y: pos.y + DELTA[dir].y };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Richtung aus senkrechtem und waagerechtem Anteil, z. B. ('up', 'left') → 'up-left' */
export function combineDirs(vertical?: 'up' | 'down', horizontal?: 'left' | 'right'): Dir | undefined {
  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  return vertical ?? horizontal;
}

/** Waagerechter Anteil einer Richtung (für Figuren, die nur nach links/rechts gespiegelt werden) */
export function horizontalOf(dir: Dir): 'left' | 'right' | undefined {
  if (dir.endsWith('left')) return 'left';
  if (dir.endsWith('right')) return 'right';
  return undefined;
}

/** Richtung von a zum direkt benachbarten Feld b, auch schräg (sonst undefined). */
export function dirTo(a: Pos, b: Pos): Dir | undefined {
  return DIRS.find((d) => samePos(step(a, d), b));
}

/** Darf man in diese Richtung gehen? Schräg nur, wenn keine Ecke im Weg ist. */
export function canStep(from: Pos, dir: Dir, walkable: (p: Pos) => boolean): boolean {
  const d = DELTA[dir];
  if (!walkable(step(from, dir))) return false;
  if (d.x === 0 || d.y === 0) return true;
  return walkable({ x: from.x + d.x, y: from.y }) && walkable({ x: from.x, y: from.y + d.y });
}

/**
 * Kürzester Weg (Breitensuche, 8 Richtungen ohne Eckenschneiden) von `from` zu einem der Zielfelder.
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
      if (seen.has(k) || !canStep(p, d, walkable)) continue;
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
