/** Zufällige Auftragsbelohnungen mit Mindestwert (Daten in data/rewards.json). */
import type { Random } from './dungeon/random';

export type RewardOption =
  | { kind: 'money'; min: number; max: number; weight: number }
  | { kind: 'item'; item: string; count: [number, number]; value: number; weight: number }
  | { kind: 'stone'; value: number; weight: number };

export interface RewardTable {
  picks: [number, number];
  options: RewardOption[];
}

export interface Reward {
  money: number;
  /** Beutel-Einträge (Fähigkeitssteine als „flutstein:wasserblase“) */
  items: string[];
}

/**
 * Würfelt eine Belohnung aus. Liegt ihr Wert unter minValue, wird mit Münzen aufgefüllt,
 * damit sich jeder Auftrag lohnt. randomStone liefert einen zufälligen Fähigkeitsstein.
 */
export function rollReward(table: RewardTable, minValue: number, rng: Random, randomStone: (rng: Random) => string): Reward {
  const reward: Reward = { money: 0, items: [] };
  let value = 0;
  const picks = rng.int(table.picks[0], table.picks[1]);
  for (let i = 0; i < picks; i++) {
    const option = rng.weighted(table.options, (o) => o.weight);
    if (option.kind === 'money') {
      const amount = rng.int(option.min, option.max);
      reward.money += amount;
      value += amount;
    } else if (option.kind === 'item') {
      const count = rng.int(option.count[0], option.count[1]);
      for (let k = 0; k < count; k++) reward.items.push(option.item);
      value += option.value * count;
    } else {
      reward.items.push(randomStone(rng));
      value += option.value;
    }
  }
  if (value < minValue) reward.money += minValue - value;
  return reward;
}

/** Wert eines Beutel-Eintrags in Münzen (für volle Beutel) */
export function itemValue(table: RewardTable, entry: string): number {
  const stone = table.options.find((o) => o.kind === 'stone');
  if (entry.includes(':')) return stone?.value ?? 0;
  const option = table.options.find((o) => o.kind === 'item' && o.item === entry);
  return option && option.kind === 'item' ? option.value : 0;
}

/**
 * Belohnung in Beutel und Geldbörse legen. Was nicht mehr in den Beutel passt,
 * gibt es als Münzen (converted = umgetauschte Gegenstände).
 */
export function grantReward(
  table: RewardTable,
  reward: Reward,
  bag: string[],
  money: number,
  bagSize: number,
): { bag: string[]; money: number; converted: string[] } {
  const next = [...bag];
  const converted: string[] = [];
  let total = money + reward.money;
  for (const item of reward.items) {
    if (next.length < bagSize) next.push(item);
    else {
      converted.push(item);
      total += itemValue(table, item);
    }
  }
  return { bag: next, money: total, converted };
}
