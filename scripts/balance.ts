/**
 * Schwierigkeits-Check: Ein einfacher Bot spielt den Flüsterwald viele Male durch.
 *
 *   npm run balance
 *
 * Der Bot greift benachbarte Gegner an (manchmal mit Fähigkeit), isst bei wenig KP eine Heilbeere
 * und läuft sonst zur Treppe bzw. zum Boss. Echte Spieler spielen klüger; das Ergebnis zeigt,
 * ob der Dungeon grob machbar und nicht zu leicht ist.
 */
import battleJson from '../data/battle.json';
import bonusesJson from '../data/bonuses.json';
import dungeonJson from '../data/dungeon.json';
import movesJson from '../data/moves.json';
import elementsJson from '../data/elements.json';
import { DIMENSIONS } from '../src/core/types';
import { findPath, type Pos } from '../src/core/grid';
import { act, canStrike, startRun, unitById } from '../src/core/dungeon/engine';
import { isFloorTile } from '../src/core/dungeon/generate';
import { createRandom } from '../src/core/dungeon/random';
import type { BonusDef } from '../src/core/dungeon/stats';
import type { Action, Content, DungeonState } from '../src/core/dungeon/types';

const content = { dungeon: dungeonJson, battle: battleJson, moves: movesJson, elements: elementsJson } as unknown as Content;
const species = ['otter', 'eule', 'dachs', 'capybara'];
const RUNS = 200;

function chooseAction(s: DungeonState, rng: ReturnType<typeof createRandom>): Action {
  // Neue Fähigkeit bei vollen Plätzen: der Bot ersetzt die älteste
  if (s.pendingLearn?.length) return { type: 'learn', forget: 0 };
  const player = unitById(s, 'player')!;
  const adjacent = s.units.find((u) => u.side === 'enemy' && u.hp > 0 && Math.max(Math.abs(u.pos.x - player.pos.x), Math.abs(u.pos.y - player.pos.y)) === 1 && canStrike(s, player.pos, u.pos));
  const berry = s.bag.indexOf('heilbeere');
  if (player.hp < player.maxHp * 0.4 && berry >= 0) return { type: 'item', index: berry, target: 'player' };
  const partner = unitById(s, 'partner')!;
  if (partner.hp < partner.maxHp * 0.3 && berry >= 0) return { type: 'item', index: berry, target: 'partner' };
  if (adjacent) {
    const usable = player.moves.findIndex((m, i) => i > 0 && m.pp > 0 && content.moves.moves[m.id].power > 0);
    if (usable >= 0 && rng.chance(40)) return { type: 'skill', index: usable };
    return { type: 'attack' };
  }
  if (s.floor.stairs && player.pos.x === s.floor.stairs.x && player.pos.y === s.floor.stairs.y) return { type: 'stairs' };
  const boss = unitById(s, 'boss');
  const goal: Pos = boss ? boss.pos : s.floor.stairs!;
  const walk = (p: Pos) => isFloorTile(s.floor, p) && !s.units.some((u) => u.hp > 0 && u.side === 'enemy' && u.pos.x === p.x && u.pos.y === p.y);
  const targets = boss ? [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: goal.x + dx, y: goal.y + dy }))) : [goal];
  const path = findPath(player.pos, targets, walk, 5000);
  if (path && path.length > 0) return { type: 'move', dir: path[0] };
  return { type: 'wait' };
}

/** Viele Durchgänge mit einem Team der Stufe level (erster Ausflug = Startstufe, spätere mit mehr Erfahrung) */
function simulate(level: number) {
  let cleared = 0;
  const reached = [0, 0, 0, 0, 0];
  let turns = 0;
  let levels = 0;
  for (let i = 0; i < RUNS; i++) {
    const rng = createRandom(1000 + i);
    const z = Object.fromEntries(DIMENSIONS.map((d) => [d, rng.next() * 2 - 1])) as Record<(typeof DIMENSIONS)[number], number>;
    const s = startRun(content, {
      seed: 5000 + i,
      player: { species: species[i % 4], level, xp: 0 },
      partner: { species: species[(i + 1 + (i >> 2)) % 4], level, xp: 0 },
      z,
      bonusDefs: bonusesJson as unknown as Record<string, BonusDef>,
      bag: ['heilbeere', 'heilbeere'],
      escort: true,
      moss: true,
    });
    let guard = 0;
    while (!s.outcome && guard++ < 3000) act(content, s, chooseAction(s, rng));
    reached[s.floor.number - 1]++;
    if (s.outcome === 'cleared') cleared++;
    turns += s.turn;
    levels += unitById(s, 'player')!.level;
  }
  console.log(`
Team auf Stufe ${level} (Dungeon-Stufe ${content.dungeon.level}, Boss Stufe ${content.dungeon.boss.level}), ${RUNS} Durchgänge`);
  console.log(`Boss besänftigt: ${((cleared / RUNS) * 100).toFixed(0)} %`);
  console.log(`Letzte erreichte Etage: ${reached.map((n, i) => `${i < 3 ? 'E' + (i + 1) : 'Boss'} ${n}`).slice(0, 4).join(' · ')}`);
  console.log(`Ø Züge ${(turns / RUNS).toFixed(0)}, Ø Stufen-Gewinn Spieler ${(levels / RUNS - level).toFixed(1)}`);
}

for (const level of [battleJson.startLevel, battleJson.startLevel + 2, battleJson.startLevel + 4]) simulate(level);
