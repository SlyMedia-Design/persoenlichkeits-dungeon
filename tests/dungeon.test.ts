import { describe, expect, it } from 'vitest';
import battleJson from '../data/battle.json';
import bonusesJson from '../data/bonuses.json';
import dungeonJson from '../data/dungeon.json';
import de from '../data/i18n/de.json';
import movesJson from '../data/moves.json';
import elementsJson from '../data/elements.json';
import { createTranslator, type Dictionary } from '../src/core/i18n';
import { findPath, type Pos } from '../src/core/grid';
import { act, startRun, stoneCount, unitById, type RunOptions } from '../src/core/dungeon/engine';
import { generateLayout, isFloorTile } from '../src/core/dungeon/generate';
import { createRandom } from '../src/core/dungeon/random';
import { settleRun } from '../src/core/dungeon/settle';
import { computeBonuses, gainXp, learnMove, levelDamage, makeUnit, movesAt, parseBagEntry, statsAt, teachableMoves, xpToNext, xpYield, type BonusDef } from '../src/core/dungeon/stats';
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


/** Ersetzt die Etage durch Wände, nur die angegebenen Felder sind begehbar (ohne Gegner, Gegenstände, Fallen) */
function carve(s: DungeonState, cells: Pos[]) {
  const f = s.floor;
  f.tiles = f.tiles.map((row, y) => [...row].map((_, x) => (cells.some((c) => c.x === x && c.y === y) ? '.' : '#')).join(''));
  f.items = [];
  f.traps = [];
  s.units = s.units.filter((u) => u.side !== 'enemy');
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

  it('jedes Betreten (neuer Startwert) ergibt ein anderes Layout', () => {
    const layouts = new Set([1, 2, 3, 4, 5].map((seed) => run({ seed }).floor.tiles.join('')));
    expect(layouts.size).toBe(5);
  });

  it('Gegner-Stufen steigen von Etage zu Etage', () => {
    const floors = content.dungeon.floors;
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i].enemyLevel[0]).toBeGreaterThanOrEqual(floors[i - 1].enemyLevel[0]);
      expect(floors[i].enemyLevel[1]).toBeGreaterThan(floors[i - 1].enemyLevel[1]);
    }
    for (let seed = 1; seed <= 10; seed++) {
      const s = run({ seed });
      const [min, max] = floors[0].enemyLevel;
      for (const u of s.units.filter((u) => u.side === 'enemy')) {
        expect(u.level).toBeGreaterThanOrEqual(min);
        expect(u.level).toBeLessThanOrEqual(max);
      }
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

  it('die Erfahrungskurve wird immer steiler, starke Gegner bringen mehr', () => {
    for (let level = 1; level < 20; level++) {
      expect(xpToNext(content, level + 1) - xpToNext(content, level)).toBeGreaterThan(0);
    }
    const larve = battleJson.enemies.larve;
    expect(xpYield(content, larve, 6)).toBeGreaterThan(xpYield(content, larve, 3));
    // Auf Startstufe braucht es mehrere Gegner der ersten Etage für eine Stufe
    expect(xpToNext(content, battleJson.startLevel) / xpYield(content, larve, content.dungeon.floors[0].enemyLevel[1])).toBeGreaterThan(5);
  });

  it('der Schaden wächst mit der Stufe des Angreifers', () => {
    expect(levelDamage(content, 1)).toBe(1);
    expect(levelDamage(content, 10)).toBeGreaterThan(levelDamage(content, 5));
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

  it('Rundum-Angriffe treffen auch schräg um eine Ecke herum', () => {
    const s = run();
    const player = unitById(s, 'player')!;
    const partner = unitById(s, 'partner')!;
    // Spieler (5,5), Wand rechts (6,5) und oben (5,4), Gegner schräg rechts oben (6,4)
    carve(s, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 6, y: 4 }, { x: 7, y: 4 }]);
    player.pos = { x: 5, y: 5 };
    partner.pos = { x: 4, y: 5 };
    const enemy = makeUnit(content, { id: 'e1', side: 'enemy', species: 'schleim', level: 5, xp: 0, pos: { x: 6, y: 4 } });
    Object.assign(enemy, { hp: 999, maxHp: 999 });
    s.units.push(enemy);
    player.moves = [{ id: 'glutstoss', pp: 10, maxPp: 10 }];
    let hit = false;
    for (let i = 0; i < 5 && !hit; i++) hit = act(content, s, { type: 'skill', index: 0 }).some((e) => e.type === 'hit' && e.id === 'e1');
    expect(hit).toBe(true);
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

describe('Fähigkeiten und Fähigkeitssteine', () => {
  const stonesOf = (s: DungeonState) => s.floor.items.filter((it) => parseBagEntry(it.item).move);

  it('im Flüsterwald (3 Etagen) liegt genau ein Stein, auf einer zufälligen Etage', () => {
    const floorsWithStone = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = run({ seed });
      expect(s.stonePlan).toHaveLength(1);
      floorsWithStone.add(s.stonePlan![0]);
      expect(stonesOf(s)).toHaveLength(s.stonePlan!.filter((f) => f === 1).length);
    }
    expect(floorsWithStone.size).toBe(content.dungeon.floors.length);
  });

  it('erst Dungeons mit mehr als 3 Etagen haben zufällig 1 bis 3 Steine', () => {
    const longer = { ...content, dungeon: { ...content.dungeon, floors: [...content.dungeon.floors, content.dungeon.floors[2]] } };
    const counts = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) counts.add(stoneCount(longer, createRandom(seed)));
    expect([...counts].sort()).toEqual([1, 2, 3]);
    for (let seed = 1; seed <= 20; seed++) expect(stoneCount(content, createRandom(seed))).toBe(1);
  });

  it('ein Stein lehrt eine Fähigkeit seines Elements (kein Ranke-Stein)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const stone of stonesOf(run({ seed }))) {
        const { item, move } = parseBagEntry(stone.item);
        const element = content.dungeon.items[item].element!;
        expect(element).not.toBe('ranke');
        expect(teachableMoves(content, element)).toContain(move);
      }
    }
  });

  it('lernen: freier Platz wird belegt, bei 4 aktiven nur mit gewähltem Platz, Bekanntes nie doppelt', () => {
    const u = makeUnit(content, { id: 'player', side: 'team', species: 'dachs', level: 5, pos: { x: 0, y: 0 } });
    expect(u.moves).toHaveLength(3);
    expect(learnMove(content, u, 'wasserblase', undefined, 0)).toEqual({});
    expect(u.moves).toHaveLength(4);
    expect(learnMove(content, u, 'federsturm', undefined, 0)).toBeNull();
    expect(learnMove(content, u, 'kratzer', 0, 0)).toBeNull();
    expect(learnMove(content, u, 'federsturm', 1, 0)).toEqual({ forgot: 'glutkralle' });
    expect(u.moves.map((m) => m.id)).toEqual(['kratzer', 'federsturm', 'glutpanzer', 'wasserblase']);
  });

  it('ein Stein kann dem Partner gegeben werden und verbraucht sich', () => {
    const s = run({ bag: ['flutstein:planschwelle'] });
    act(content, s, { type: 'item', index: 0, target: 'partner' });
    expect(s.bag).toEqual([]);
    expect(unitById(s, 'partner')!.moves.map((m) => m.id)).toContain('planschwelle');
  });

  it('bei 4 aktiven Fähigkeiten braucht der Stein einen gewählten Platz, sonst bleibt er im Beutel', () => {
    const s = run({ player: { species: 'dachs', level: 8, xp: 0 }, bag: ['windstein:federsturm'] });
    expect(act(content, s, { type: 'item', index: 0, target: 'player' })).toEqual([]);
    expect(s.bag).toHaveLength(1);
    act(content, s, { type: 'item', index: 0, target: 'player', forget: 2 });
    expect(s.bag).toHaveLength(0);
    expect(unitById(s, 'player')!.moves[2].id).toBe('federsturm');
  });

  it('Stufenaufstieg bei 4 aktiven: die neue Fähigkeit wartet auf die Wahl des Spielers', () => {
    const s = run({ player: { species: 'dachs', level: 7, xp: 0, moves: ['kratzer', 'glutkralle', 'glutpanzer', 'wasserblase'] } });
    const player = unitById(s, 'player')!;
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    s.units = s.units.filter((u) => u.side !== 'enemy' || u === enemy);
    Object.assign(enemy, { hp: 1, level: 80, pos: { x: player.pos.x + 1, y: player.pos.y } });
    const partner = unitById(s, 'partner')!;
    if (partner.pos.x === enemy.pos.x && partner.pos.y === enemy.pos.y) partner.pos = { x: player.pos.x - 1, y: player.pos.y };
    s.floor.tiles = s.floor.tiles.map((row, y) => (y === player.pos.y ? row.slice(0, player.pos.x - 1) + '...' + row.slice(player.pos.x + 2) : row));
    player.facing = 'right';
    for (let i = 0; i < 10 && enemy.hp > 0; i++) act(content, s, { type: 'attack' });
    expect(player.level).toBeGreaterThanOrEqual(8);
    expect(s.pendingLearn?.[0]).toEqual({ id: 'player', move: 'glutstoss' });
    // Solange die Wahl offen ist, geht nichts anderes
    expect(act(content, s, { type: 'wait' })).toEqual([]);
    const events = act(content, s, { type: 'learn', forget: 3 });
    expect(events).toContainEqual({ type: 'learned', id: 'player', move: 'glutstoss', forgot: 'wasserblase' });
    expect(s.pendingLearn).toHaveLength(0);
  });

  it('nach dem Ende (z. B. Aufstieg beim Boss) lässt sich die offene Fähigkeit noch lernen', () => {
    const s = run();
    s.outcome = 'cleared';
    s.pendingLearn = [{ id: 'player', move: 'wasserblase' }];
    expect(act(content, s, { type: 'wait' })).toEqual([]);
    expect(act(content, s, { type: 'learn', forget: null })).toHaveLength(1);
    expect(s.pendingLearn).toHaveLength(0);
  });

  it('die neue Fähigkeit kann auch ausgelassen werden', () => {
    const s = run();
    s.pendingLearn = [{ id: 'partner', move: 'planschwelle' }];
    expect(act(content, s, { type: 'learn', forget: null })).toEqual([{ type: 'learnSkipped', id: 'partner', move: 'planschwelle' }]);
    expect(unitById(s, 'partner')!.moves.map((m) => m.id)).not.toContain('planschwelle');
  });
});

describe('Stups', () => {
  it('folgt im engen Gang auch dann, wenn der Partner zwischen ihm und dem Spieler läuft', () => {
    const s = run({ escort: true });
    const player = unitById(s, 'player')!;
    player.pos = { ...s.floor.stairs! };
    act(content, s, { type: 'stairs' });
    const stups = unitById(s, 'stups')!;
    const partner = unitById(s, 'partner')!;
    carve(s, Array.from({ length: 30 }, (_, i) => ({ x: i + 2, y: 5 })));
    s.units = s.units.filter((u) => u.side !== 'enemy');
    player.pos = { x: 10, y: 5 };
    partner.pos = { x: 9, y: 5 };
    stups.pos = { x: 8, y: 5 };
    s.escort = 'following';
    for (let i = 0; i < 12; i++) act(content, s, { type: 'move', dir: 'right' });
    expect(player.pos.x).toBe(22);
    expect(player.pos.x - stups.pos.x).toBeLessThanOrEqual(3);
  });

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
    // Die Boss-Stufe ist fest vorgegeben und hängt nicht vom Team ab
    expect(boss.level).toBe(content.dungeon.boss.level);
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
    expect(settleRun(content, s, {}).team.player).toMatchObject({ level: 7, xp: 12 });
  });

  it('gelernte Fähigkeiten bleiben über den Ausflug hinaus erhalten', () => {
    const s = run();
    const player = unitById(s, 'player')!;
    learnMove(content, player, 'wasserblase', undefined, 0);
    const moves = settleRun(content, s, {}).team.player.moves!;
    expect(moves).toContain('wasserblase');
    const next = run({ player: { species: 'dachs', level: 5, xp: 0, moves } });
    expect(unitById(next, 'player')!.moves.map((m) => m.id)).toEqual(moves);
  });

  it('gerettetes Stups macht den Auftrag erfüllt', () => {
    const s = run({ escort: true });
    s.escort = 'rescued';
    expect(settleRun(content, s, { verirrt: 'accepted' }).quests.verirrt).toBe('ready');
  });

  it('drei Leuchtmoose erfüllen den Auftrag und werden abgegeben, weniger bleiben in der Quest-Tasche', () => {
    const s = run({ moss: true });
    s.bag = ['heilbeere'];
    s.questBag = ['leuchtmoos', 'leuchtmoos', 'leuchtmoos', 'leuchtmoos'];
    const done = settleRun(content, s, { leuchtmoos: 'accepted' });
    expect(done.quests.leuchtmoos).toBe('ready');
    expect(done.bag).toEqual(['heilbeere']);
    expect(done.questBag).toEqual(['leuchtmoos']);
    s.questBag = ['leuchtmoos', 'leuchtmoos'];
    const partial = settleRun(content, s, { leuchtmoos: 'accepted' });
    expect(partial.quests.leuchtmoos).toBe('accepted');
    expect(partial.moss).toBe(2);
  });
});

describe('Beutel', () => {
  const size = content.dungeon.bag.size;

  it('hat eine feste Grenze: Ist er voll, bleibt ein Fund liegen', () => {
    const s = run({ bag: Array(size).fill('heilbeere') });
    const player = unitById(s, 'player')!;
    s.units = s.units.filter((u) => u.side === 'team');
    s.floor.tiles = s.floor.tiles.map((row, y) => (y === player.pos.y ? row.slice(0, player.pos.x - 1) + '...' + row.slice(player.pos.x + 2) : row));
    unitById(s, 'partner')!.pos = { x: player.pos.x - 1, y: player.pos.y };
    s.floor.items = [{ pos: { x: player.pos.x + 1, y: player.pos.y }, item: 'wurfstein' }];
    const events = act(content, s, { type: 'move', dir: 'right' });
    expect(events).toContainEqual({ type: 'bagFull', item: 'wurfstein' });
    expect(s.bag).toHaveLength(size);
    expect(s.floor.items).toHaveLength(1);
  });

  it('Ablegen schafft Platz, auf einem belegten Feld wird getauscht', () => {
    const s = run({ bag: ['heilbeere', 'sternbeere'] });
    const player = unitById(s, 'player')!;
    s.floor.items = [];
    act(content, s, { type: 'drop', index: 0 });
    expect(s.bag).toEqual(['sternbeere']);
    expect(s.floor.items).toEqual([{ pos: player.pos, item: 'heilbeere' }]);
    const events = act(content, s, { type: 'drop', index: 0 });
    expect(events).toContainEqual({ type: 'drop', id: 'player', item: 'sternbeere', picked: 'heilbeere' });
    expect(s.bag).toEqual(['heilbeere']);
    expect(s.floor.items.map((i) => i.item)).toEqual(['sternbeere']);
  });

  it('ein zu voller Beutel aus einem alten Spielstand wird beim Aufbruch gekürzt', () => {
    expect(run({ bag: Array(size + 3).fill('heilbeere') }).bag).toHaveLength(size);
  });
});

describe('Quest-Tasche', () => {
  it('Auftragsgegenstände landen in der Quest-Tasche und belegen keinen Beutelplatz', () => {
    const s = run({ moss: true, bag: Array(content.dungeon.bag.size).fill('heilbeere') });
    const player = unitById(s, 'player')!;
    s.floor.items.push({ pos: { x: player.pos.x + 1, y: player.pos.y }, item: 'leuchtmoos' });
    s.floor.tiles = s.floor.tiles.map((row, y) => (y === player.pos.y ? row.slice(0, player.pos.x - 1) + '...' + row.slice(player.pos.x + 2) : row));
    s.units = s.units.filter((u) => u.side === 'team');
    unitById(s, 'partner')!.pos = { x: player.pos.x - 1, y: player.pos.y };
    act(content, s, { type: 'move', dir: 'right' });
    expect(s.questBag).toContain('leuchtmoos');
    expect(s.bag).toHaveLength(content.dungeon.bag.size);
  });

  it('alte Spielstände mit Moos im Beutel werden beim Aufbruch umsortiert', () => {
    const s = run({ bag: ['heilbeere', 'leuchtmoos'] });
    expect(s.bag).toEqual(['heilbeere']);
    expect(s.questBag).toEqual(['leuchtmoos']);
  });

  it('nach einer Niederlage ist die Quest-Tasche wie beim Aufbruch', () => {
    const s = run({ questBag: ['leuchtmoos'] });
    s.questBag!.push('leuchtmoos');
    act(content, s, { type: 'giveUp' });
    expect(s.questBag).toEqual(['leuchtmoos']);
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
