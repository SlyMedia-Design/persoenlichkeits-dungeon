import { describe, expect, it } from 'vitest';
import battleJson from '../data/battle.json';
import dungeonJson from '../data/dungeon.json';
import elementsJson from '../data/elements.json';
import movesJson from '../data/moves.json';
import rewardsJson from '../data/rewards.json';
import villageJson from '../data/village.json';
import { randomStone } from '../src/core/dungeon/generate';
import { createRandom } from '../src/core/dungeon/random';
import { parseBagEntry } from '../src/core/dungeon/stats';
import type { Content } from '../src/core/dungeon/types';
import { grantReward, itemValue, rollReward, type RewardTable } from '../src/core/rewards';

const content = { dungeon: dungeonJson, battle: battleJson, moves: movesJson, elements: elementsJson } as unknown as Content;
const table = rewardsJson as unknown as RewardTable;
const stone = (rng: ReturnType<typeof createRandom>) => randomStone(content, rng)!;
const valueOf = (r: { money: number; items: string[] }) => r.money + r.items.reduce((sum, i) => sum + itemValue(table, i), 0);

describe('Auftragsbelohnungen', () => {
  it('jeder Auftrag hat einen Mindestwert', () => {
    for (const q of villageJson.quests) expect(q.reward.minValue).toBeGreaterThan(0);
  });

  it('enttäuscht nie: der Wert liegt immer mindestens beim Mindestwert', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const reward = rollReward(table, 80, createRandom(seed), stone);
      expect(valueOf(reward), `Seed ${seed}`).toBeGreaterThanOrEqual(80);
    }
  });

  it('ist zufällig: Steine, Münzen und Heilbeeren kommen alle vor', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const reward = rollReward(table, 0, createRandom(seed), stone);
      if (reward.money > 0) seen.add('money');
      for (const item of reward.items) seen.add(parseBagEntry(item).move ? 'stone' : item);
    }
    expect(seen).toEqual(new Set(['money', 'heilbeere', 'sternbeere', 'stone']));
  });

  it('Steine in Belohnungen sind gültige Fähigkeitssteine', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const item of rollReward(table, 0, createRandom(seed), stone).items) {
        const { item: id, move } = parseBagEntry(item);
        expect(content.dungeon.items[id]).toBeDefined();
        if (move) expect(content.moves.moves[move]).toBeDefined();
      }
    }
  });

  it('was nicht mehr in den Beutel passt, gibt es als Münzen', () => {
    const full = Array(12).fill('wurfstein');
    const result = grantReward(table, { money: 10, items: ['heilbeere', 'flutstein:wasserblase'] }, full.slice(0, 11), 5, 12);
    expect(result.bag).toHaveLength(12);
    expect(result.bag[11]).toBe('heilbeere');
    expect(result.converted).toEqual(['flutstein:wasserblase']);
    expect(result.money).toBe(5 + 10 + itemValue(table, 'flutstein:wasserblase'));
  });
});
