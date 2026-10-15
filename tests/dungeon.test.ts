import { describe, expect, it } from 'vitest';
import battleJson from '../data/battle.json';
import bonusesJson from '../data/bonuses.json';
import dungeonJson from '../data/dungeon.json';
import de from '../data/i18n/de.json';
import movesJson from '../data/moves.json';
import elementsJson from '../data/elements.json';
import { createTranslator, type Dictionary } from '../src/core/i18n';
import { findPath, type Pos } from '../src/core/grid';
import { act, startRun, unitById, type RunOptions } from '../src/core/dungeon/engine';
import { generateLayout, isFloorTile } from '../src/core/dungeon/generate';
import { createRandom } from '../src/core/dungeon/random';
import { settleRun } from '../src/core/dungeon/settle';
import { computeBonuses, gainXp, makeUnit, movesAt, statsAt, type BonusDef } from '../src/core/dungeon/stats';
import type { Action, Content, DungeonState } from '../src/core/dungeon/types';

const content = { dungeon: dungeonJson, battle: battleJson, moves: movesJson, elements: elementsJson } as unknown as Content;
const bonusDefs = bonusesJson as unknown as Record<string, BonusDef>;
const t = createTranslator(de as Dictionary);
const neutral = { O: 0, C: 0, E: 0, A: 0, N: 0 };

function run(overrides: Partial<RunOptions> = {}): DungeonState {
  return startRun(content, {
    seed: 42,
    player: { species: 'dachs', level: 5, xp: 0 },
    partner: { species: 'otter', level: 5, xp: 0 },
    z: neutral,
    bonusDefs,
    bag: [],
    escort: false,
    moss: false,
    ...overrides,
  });
}

describe('Etagen', () => {
  it('jede Etage ist zusammenhängend: alle Räume und die Treppe sind vom Start erreichbar', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { floor, start } = generateLayout(content, 1, createRandom(seed));
      const walk = (p: Pos) => isFloorTile(floor, p);
      expect(walk(start)).toBe(true);
      expect(findPath(start, [floor.stairs!], walk, 5000), `Seed ${seed}`).not.toBeNull();
      for (const room of floor.rooms) expect(findPath(start, [{ x: room.x, y: room.y }], walk, 5000), `Seed ${seed}`).not.toBeNull();
    }
  });

  it('gleicher Startwert ergibt dieselbe Etage', () => {
    expect(generateLayout(content, 1, createRandom(7)).floor.tiles).toEqual(generateLayout(content, 1, createRandom(7)).floor.tiles);
  });

  it('ein neuer Durchgang setzt Team, Gegner und Gegenstände auf Bodenfelder', () => {
    const s = run();
    for (const u of s.units) expect(isFloorTile(s.floor, u.pos), u.id).toBe(true);
    for (const it of s.floor.items) expect(isFloorTile(s.floor, it.pos)).toBe(true);
    expect(s.units.filter((u) => u.side === 'enemy').length).toBeGreaterThanOrEqual(3);
  });

  it('Leuchtmoos liegt nur aus, wenn der Auftrag angenommen ist', () => {
    expect(run().floor.items.some((i) => i.item === 'leuchtmoos')).toBe(false);
    expect(run({ moss: true }).floor.items.some((i) => i.item === 'leuchtmoos')).toBe(true);
  });
});

describe('Werte und Stufen', () => {
  it('Werte wachsen mit der Stufe', () => {
    const dachs = battleJson.team.dachs;
    expect(statsAt(dachs, 6).hp).toBeGreaterThan(statsAt(dachs, 5).hp);
  });

  it('auf Stufe 5 kennt man 3 Fähigkeiten, ab Stufe 8 vier', () => {
    expect(movesAt(content, battleJson.team.eule, 5)).toEqual(['schnabelhieb', 'leuchtfeder', 'eulenblick']);
    expect(movesAt(content, battleJson.team.eule, 8)).toHaveLength(4);
  });

  it('Stufenaufstieg lehrt neue Fähigkeiten', () => {
    const u = makeUnit(content, { id: 'player', side: 'team', species: 'otter', level: 7, pos: { x: 0, y: 0 } });
    const events = gainXp(content, u, 1000, 0);
    expect(u.level).toBeGreaterThan(8);
    expect(events.some((e) => e.type === 'levelUp' && e.learned === 'planschwelle')).toBe(true);
    expect(u.moves.length).toBeLessThanOrEqual(4);
  });

  it('jeder Pol einer Dimension bringt einen Bonus (kein Profil ist schwächer)', () => {
    const high = computeBonuses({ O: 1, C: 1, E: 1, A: 1, N: 1 }, bonusDefs);
    const low = computeBonuses({ O: -1, C: -1, E: -1, A: -1, N: -1 }, bonusDefs);
    expect(high.extraPp).toBeGreaterThan(0);
    expect(high.sense).toBeGreaterThan(0);
    expect(low.attackPower).toBeGreaterThan(0);
    expect(low.toughness).toBeGreaterThan(0);
    const count = (b: object) => Object.values(b).filter((v) => v > 0).length;
    expect(count(high)).toBe(5);
    expect(count(low)).toBe(5);
  });
});

describe('Züge und Kampf', () => {
  it('Laufen gegen eine Wand verbraucht keinen Zug', () => {
    const s = run();
    const player = unitById(s, 'player')!;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const before = s.turn;
      const target = { x: player.pos.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0), y: player.pos.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0) };
      if (!isFloorTile(s.floor, target)) {
        expect(act(content, s, { type: 'move', dir })).toEqual([]);
        expect(s.turn).toBe(before);
      }
    }
  });

  it('ein Angriff auf einen benachbarten Gegner richtet Schaden an', () => {
    const s = run();
    const player = unitById(s, 'player')!;
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    enemy.pos = { x: player.pos.x + 1, y: player.pos.y };
    // Feld frei machen, falls dort der Partner stand
    const partner = unitById(s, 'partner')!;
    if (partner.pos.x === enemy.pos.x && partner.pos.y === enemy.pos.y) partner.pos = { x: player.pos.x - 1, y: player.pos.y };
    s.floor.tiles = s.floor.tiles.map((row, y) => (y === player.pos.y ? row.slice(0, player.pos.x - 1) + '...' + row.slice(player.pos.x + 2) : row));
    const hpBefore = enemy.hp;
    let events = act(content, s, { type: 'attack' });
    for (let i = 0; i < 5 && !events.some((e) => e.type === 'hit' && e.id === enemy.id); i++) events = act(content, s, { type: 'attack' });
    expect(enemy.hp).toBeLessThan(hpBefore);
  });

  it('das Element der Fähigkeit wirkt auf den Schaden (Glut stark gegen Ranke, schwach gegen Flut)', () => {
    /** Schaden des ersten Treffers der Glutkralle gegen einen Gegner der Art species (sonst gleiche Werte) */
    const firstHit = (seed: number, species: string) => {
      const s = run({ seed });
      const player = unitById(s, 'player')!;
      const enemy = s.units.find((u) => u.side === 'enemy')!;
      s.units = s.units.filter((u) => u.side !== 'enemy' || u === enemy);
      Object.assign(enemy, { species, hp: 999, maxHp: 999, def: 0, pos: { x: player.pos.x + 1, y: player.pos.y } });
      const partner = unitById(s, 'partner')!;
      if (partner.pos.x === enemy.pos.x && partner.pos.y === enemy.pos.y) partner.pos = { x: player.pos.x - 1, y: player.pos.y };
      s.floor.tiles = s.floor.tiles.map((row, y) => (y === player.pos.y ? row.slice(0, player.pos.x - 1) + '...' + row.slice(player.pos.x + 2) : row));
      player.facing = 'right';
      const index = player.moves.findIndex((m) => m.id === 'glutkralle');
      const hit = act(content, s, { type: 'skill', index }).find((e) => e.type === 'hit' && e.id === enemy.id);
      return hit && hit.type === 'hit' ? hit.amount : 0;
    };
    let strong = 0;
    let weak = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const vsRanke = firstHit(seed, 'bambus');
      const vsFlut = firstHit(seed, 'schleim');
      expect(vsRanke, `Seed ${seed}`).toBeGreaterThanOrEqual(vsFlut);
      strong += vsRanke;
      weak += vsFlut;
    }
    expect(weak).toBeGreaterThan(0);
    // 1,1 / 0,9 ≈ 1,22 (Rundung der einzelnen Treffer lässt etwas Spielraum)
    expect(strong / weak).toBeGreaterThan(1.15);
    expect(strong / weak).toBeLessThan(1.3);
  });

  it('Spielzüge sind reproduzierbar (gleicher Startwert, gleiche Eingaben)', () => {
    const actions: Action[] = ['up', 'left', 'down', 'right', 'up-left', 'down-right'].map((dir) => ({ type: 'move', dir }) as Action);
    const a = run();
    const b = run();
    for (const action of [...actions, ...actions, { type: 'wait' } as Action]) {
      act(content, a, action);
      act(content, b, action);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('eine Niederlage stellt den Beutel vom Anfang wieder her', () => {
    const s = run({ bag: ['heilbeere'] });
    s.bag.push('wurfstein');
    const events = act(content, s, { type: 'giveUp' });
    expect(events.some((e) => e.type === 'defeated')).toBe(true);
    expect(s.bag).toEqual(['heilbeere']);
    expect(s.outcome).toBe('defeated');
  });

  it('eine Heilbeere heilt und verschwindet aus dem Beutel', () => {
    const s = run({ bag: ['heilbeere'] });
    const player = unitById(s, 'player')!;
    player.hp = 5;
    act(content, s, { type: 'item', index: 0, target: 'player' });
    expect(player.hp).toBeGreaterThan(5);
    expect(s.bag).toEqual([]);
  });

  it('der Durchgang bleibt über viele zufällige Züge stabil (keine Abstürze, Werte im Rahmen)', () => {
    const rng = createRandom(99);
    const dirs = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'] as const;
    const s = run({ escort: true, moss: true, bag: ['heilbeere', 'wurfstein'] });
    for (let i = 0; i < 400 && !s.outcome; i++) {
      const r = rng.next();
      const action: Action = r < 0.7 ? { type: 'move', dir: rng.pick(dirs) } : r < 0.85 ? { type: 'skill', index: rng.int(0, 2) } : r < 0.95 ? { type: 'attack' } : { type: 'stairs' };
      act(content, s, action);
      for (const u of s.units) {
        expect(u.hp).toBeGreaterThanOrEqual(0);
        expect(u.hp).toBeLessThanOrEqual(u.maxHp);
        expect(isFloorTile(s.floor, u.pos), `${u.id} auf Wand`).toBe(true);
      }
      const spots = s.units.filter((u) => u.hp > 0).map((u) => `${u.pos.x},${u.pos.y}`);
      expect(new Set(spots).size).toBe(spots.length);
    }
  });
});

describe('Stups', () => {
  it('wartet unbehelligt und schließt sich an, wenn man zu ihm läuft', () => {
    const s = run({ escort: true });
    const player = unitById(s, 'player')!;
    player.pos = { ...s.floor.stairs! };
    act(content, s, { type: 'stairs' });
    const stups = unitById(s, 'stups')!;
    expect(stups).toBeDefined();
    // Ein Gegner direkt daneben greift ihn nicht an, solange er wartet
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: stups.pos.x + dx, y: stups.pos.y + dy })).find((p) => isFloorTile(s.floor, p) && !s.units.some((u) => u.pos.x === p.x && u.pos.y === p.y))!;
    enemy.pos = spot;
    enemy.aware = true;
    for (let i = 0; i < 5; i++) act(content, s, { type: 'wait' });
    expect(stups.hp).toBe(stups.maxHp);
  });
});

describe('Boss', () => {
  it('nach der letzten Etage folgt die Lichtung mit dem Waldgeist; besiegt = geschafft', () => {
    const s = run();
    for (let i = 0; i < content.dungeon.floors.length; i++) {
      const player = unitById(s, 'player')!;
      player.pos = { ...s.floor.stairs! };
      act(content, s, { type: 'stairs' });
    }
    expect(s.floor.boss).toBe(true);
    const boss = unitById(s, 'boss')!;
    expect(boss).toBeDefined();
    boss.hp = 1;
    const player = unitById(s, 'player')!;
    boss.pos = { x: player.pos.x, y: player.pos.y - 1 };
    for (let i = 0; i < 10 && !s.outcome; i++) act(content, s, { type: 'move', dir: 'up' });
    expect(s.outcome).toBe('cleared');
  });
});

describe('Auswertung nach dem Ausflug', () => {
  it('Stufe und Erfahrung bleiben, auch nach einer Niederlage', () => {
    const s = run();
    unitById(s, 'player')!.level = 7;
    unitById(s, 'player')!.xp = 12;
    act(content, s, { type: 'giveUp' });
    expect(settleRun(content, s, {}).team.player).toEqual({ level: 7, xp: 12 });
  });

  it('gerettetes Stups macht den Auftrag erfüllt', () => {
    const s = run({ escort: true });
    s.escort = 'rescued';
    expect(settleRun(content, s, { verirrt: 'accepted' }).quests.verirrt).toBe('ready');
  });

  it('drei Leuchtmoose erfüllen den Auftrag und werden abgegeben, weniger bleiben im Beutel', () => {
    const s = run({ moss: true });
    s.bag = ['leuchtmoos', 'heilbeere', 'leuchtmoos', 'leuchtmoos', 'leuchtmoos'];
    const done = settleRun(content, s, { leuchtmoos: 'accepted' });
    expect(done.quests.leuchtmoos).toBe('ready');
    expect(done.bag).toEqual(['heilbeere', 'leuchtmoos']);
    s.bag = ['leuchtmoos', 'leuchtmoos'];
    const partial = settleRun(content, s, { leuchtmoos: 'accepted' });
    expect(partial.quests.leuchtmoos).toBe('accepted');
    expect(partial.moss).toBe(2);
  });
});

describe('Texte', () => {
  it('alle Fähigkeiten, Gegner und Gegenstände haben Namen in de.json', () => {
    const keys = [
      ...Object.keys(movesJson.moves).map((id) => `moves.${id}.name`),
      ...Object.keys(battleJson.enemies).map((id) => `dungeon.enemies.${id}`),
      ...Object.keys(battleJson.boss).map((id) => `dungeon.enemies.${id}`),
      ...Object.keys(dungeonJson.items).map((id) => `dungeon.items.${id}.name`),
      ...Object.keys(dungeonJson.items).map((id) => `dungeon.items.${id}.info`),
    ];
    for (const key of keys) expect(t(key), key).not.toBe(`[${key}]`);
  });
});
