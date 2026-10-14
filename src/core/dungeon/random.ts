/**
 * Zufall mit speicherbarem Zustand (mulberry32): Der Zustand ist eine einzige Zahl,
 * die im Spielstand liegt. So läuft ein gespeicherter Dungeon genauso weiter.
 */
export interface Random {
  next(): number;
  /** Ganzzahl in [min, max] */
  int(min: number, max: number): number;
  chance(percent: number): boolean;
  pick<T>(list: readonly T[]): T;
  weighted<T>(list: readonly T[], weight: (item: T) => number): T;
  /** Aktueller Zustand zum Speichern */
  readonly state: number;
}

export function createRandom(state: number): Random {
  let a = state >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (percent) => next() * 100 < percent,
    pick: (list) => list[Math.floor(next() * list.length)],
    weighted: (list, weight) => {
      const total = list.reduce((sum, item) => sum + weight(item), 0);
      let roll = next() * total;
      for (const item of list) {
        roll -= weight(item);
        if (roll < 0) return item;
      }
      return list[list.length - 1];
    },
    get state() {
      return a;
    },
  };
  return r;
}
