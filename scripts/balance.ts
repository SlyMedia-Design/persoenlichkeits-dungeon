/**
 * Schwierigkeits-Check: Bots spielen den Flüsterwald viele Male durch.
 *
 *   npm run balance
 *
 * Zwei Spielweisen:
 * - einfach: greift benachbarte Gegner an (manchmal mit Fähigkeit), isst bei wenig KP eine Heilbeere
 *   und läuft sonst zur Treppe bzw. zum Boss.
 * - geübt: spielt eher wie ein Mensch: kämpft gegen Gegner in der Nähe (Erfahrung), sammelt gesehene
 *   Gegenstände ein, wählt immer den stärksten Treffer (mit Element-Vorteil und Rundum-Angriffen),
 *   heilt rechtzeitig auch den Partner und nutzt Sternbeeren, wenn die Energie ausgeht.
 *
 * Danach die ganze Kampagne: Ein neues Team (Startstufe) zieht immer wieder los, Stufen, Fähigkeiten
 * und Beutel bleiben wie im Spiel erhalten, bis der Waldgeist besänftigt ist.
 */
import battleJson from '../data/battle.json';
import bonusesJson from '../data/bonuses.json';
import dungeonJson from '../data/dungeon.json';
import elementsJson from '../data/elements.json';
import movesJson from '../data/moves.json';
import { act, canStrike, startRun, unitById } from '../src/core/dungeon/engine';
import { isFloorTile } from '../src/core/dungeon/generate';
import { createRandom, type Random } from '../src/core/dungeon/random';
import { settleRun } from '../src/core/dungeon/settle';
import type { BonusDef } from '../src/core/dungeon/stats';
import type { Action, Content, DungeonState, Unit } from '../src/core/dungeon/types';
import { elementFactor } from '../src/core/elements';
import { findPath, type Pos } from '../src/core/grid';
import { DIMENSIONS } from '../src/core/types';

const content = { dungeon: dungeonJson, battle: battleJson, moves: movesJson, elements: elementsJson } as unknown as Content;
const species = ['otter', 'eule', 'dachs', 'capybara'];
const RUNS = 200;
const CAMPAIGNS = 200;
/** Nach so vielen erfolglosen Ausflügen gibt der Bot die Kampagne auf */
const MAX_TRIPS = 10;

type Style = 'einfach' | 'geübt';

const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function adjacentFoes(s: DungeonState, u: Unit): Unit[] {
  return s.units.filter((e) => e.side === 'enemy' && e.hp > 0 && chebyshev(e.pos, u.pos) === 1 && canStrike(s, u.pos, e.pos));
}

/** Erwarteter Schaden eines Zugs gegen die benachbarten Gegner (grob, für die Auswahl) */
function score(player: Unit, moveId: string | null, foes: Unit[]): number {
  const def = moveId ? content.moves.moves[moveId] : content.moves.attack;
  if (def.power <= 0) return 0;
  const element = def.element;
  const factor = (foe: Unit) => elementFactor(content.elements, element, (content.battle.enemies[foe.species] ?? content.battle.boss[foe.species])?.element);
  const hits = def.target === 'around' ? foes : [foes[0]];
  return hits.reduce((sum, foe) => sum + (player.atk + def.power) * factor(foe) * (def.accuracy / 100), 0);
}

function chooseAction(s: DungeonState, rng: Random, style: Style): Action {
  const player = unitById(s, 'player')!;
  const partner = unitById(s, 'partner')!;
  // Neue Fähigkeit bei vollen Plätzen: die schwächste ersetzen
  if (s.pendingLearn?.length) {
    const unit = unitById(s, s.pendingLearn[0].id)!;
    const weakest = unit.moves.reduce((best, m, i) => ((content.moves.moves[m.id]?.power ?? 0) < (content.moves.moves[unit.moves[best].id]?.power ?? 0) ? i : best), 0);
    return { type: 'learn', forget: style === 'geübt' ? weakest : 0 };
  }
  const berry = s.bag.indexOf('heilbeere');
  const healAt = style === 'geübt' ? 0.45 : 0.4;
  if (player.hp < player.maxHp * healAt && berry >= 0) return { type: 'item', index: berry, target: 'player' };
  if (partner.hp < partner.maxHp * (style === 'geübt' ? 0.35 : 0.3) && berry >= 0) return { type: 'item', index: berry, target: 'partner' };
  const foes = adjacentFoes(s, player);
  if (foes.length > 0) {
    if (style === 'einfach') {
      const usable = player.moves.findIndex((m, i) => i > 0 && m.pp > 0 && content.moves.moves[m.id].power > 0);
      if (usable >= 0 && rng.chance(40)) return { type: 'skill', index: usable };
      return { type: 'attack' };
    }
    // Ohne Energie: Sternbeere essen, wenn vorhanden und ein Kampf läuft
    const star = s.bag.indexOf('sternbeere');
    if (star >= 0 && player.moves.every((m) => m.pp === 0 || content.moves.moves[m.id].power === 0)) return { type: 'item', index: star, target: 'player' };
    let best: Action = { type: 'attack' };
    let bestScore = score(player, null, foes);
    player.moves.forEach((m, i) => {
      if (m.pp <= 0) return;
      const value = score(player, m.id, foes);
      if (value > bestScore) {
        bestScore = value;
        best = { type: 'skill', index: i };
      }
    });
    return best;
  }
  const walkable = (p: Pos) => isFloorTile(s.floor, p) && !s.units.some((u) => u.hp > 0 && u.side !== 'team' && u.pos.x === p.x && u.pos.y === p.y);
  if (style === 'geübt' && !unitById(s, 'boss')) {
    // Wie ein Mensch: gesehene Gegner bekämpfen (Erfahrung), solange es dem Team gut geht …
    const healthy = player.hp > player.maxHp * 0.6 && partner.hp > partner.maxHp * 0.4;
    const visible = s.units.filter((e) => e.side === 'enemy' && e.hp > 0 && chebyshev(e.pos, player.pos) <= 5);
    if (healthy && visible.length > 0) {
      const spots = visible.flatMap((e) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: e.pos.x + dx, y: e.pos.y + dy }))));
      const path = findPath(player.pos, spots, walkable, 2000);
      if (path && path.length > 0) return { type: 'move', dir: path[0] };
    }
    // … und erkundete Gegenstände einsammeln, wenn noch Platz im Beutel ist
    const items = s.floor.items.filter((it) => s.floor.explored[it.pos.y][it.pos.x] === '1').map((it) => it.pos);
    if (items.length > 0 && s.bag.length < content.dungeon.bag.size) {
      const path = findPath(player.pos, items, walkable, 3000);
      if (path && path.length > 0 && path.length <= 20) return { type: 'move', dir: path[0] };
    }
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

interface Trip {
  player: { level: number; xp: number; moves?: string[] };
  partner: { level: number; xp: number; moves?: string[] };
  bag: string[];
}

/** Zustand des Teams beim Betreten der Boss-Lichtung */
interface BossEntry {
  hp: number;
  berries: number;
}

/** Ein Ausflug; gibt den Endstand zurück (und onBoss beim Betreten der Boss-Lichtung) */
function playTrip(i: number, trip: Trip, style: Style, z: Record<string, number>, onBoss?: (entry: BossEntry) => void): DungeonState {
  const rng = createRandom(9000 + i);
  const s = startRun(content, {
    seed: 5000 + i,
    player: { species: species[i % 4], ...trip.player },
    partner: { species: species[(i + 1 + (i >> 2)) % 4], ...trip.partner },
    z: z as never,
    bonusDefs: bonusesJson as unknown as Record<string, BonusDef>,
    bag: trip.bag,
    escort: true,
    moss: true,
  });
  let guard = 0;
  let atBoss = false;
  while (!s.outcome && guard++ < 3000) {
    act(content, s, chooseAction(s, rng, style));
    if (!atBoss && s.floor.boss) {
      atBoss = true;
      const team = s.units.filter((u) => u.side === 'team');
      onBoss?.({ hp: team.reduce((a, u) => a + u.hp / u.maxHp, 0) / team.length, berries: s.bag.filter((b) => b === 'heilbeere').length });
    }
  }
  return s;
}

function randomProfile(seed: number) {
  const rng = createRandom(seed);
  return Object.fromEntries(DIMENSIONS.map((d) => [d, rng.next() * 2 - 1]));
}

const percent = (n: number, of: number) => `${((n / of) * 100).toFixed(0)} %`;

/** Viele einzelne Ausflüge mit einem Team der Stufe level */
function simulate(level: number, style: Style) {
  let cleared = 0;
  const reached = [0, 0, 0, 0];
  for (let i = 0; i < RUNS; i++) {
    const start = { level, xp: 0 };
    const s = playTrip(i, { player: start, partner: start, bag: ['heilbeere', 'heilbeere'] }, style, randomProfile(1000 + i));
    reached[Math.min(3, s.floor.number - 1)]++;
    if (s.outcome === 'cleared') cleared++;
  }
  console.log(`  Stufe ${level}: Boss besänftigt ${percent(cleared, RUNS)} · gescheitert auf E1 ${reached[0]}, E2 ${reached[1]}, E3 ${reached[2]}, beim Boss ${reached[3] - cleared}`);
}

/** Ganze Kampagnen: neues Team, so viele Ausflüge wie nötig */
function campaigns(style: Style) {
  const tries: number[] = [];
  let gaveUp = 0;
  let defeats = 0;
  let bossDefeats = 0;
  let finalLevel = 0;
  /** Bei Niederlagen gegen den Boss: seine restlichen KP (Anteil), wer zuerst fiel, ob die Irrlichter schon da waren */
  let bossHpLeft = 0;
  let partnerFirst = 0;
  let summoned = 0;
  const bossBuckets = [0, 0, 0, 0];
  let arrivals = 0;
  let arrivalHp = 0;
  let arrivalBerries = 0;
  let noBerries = 0;
  for (let c = 0; c < CAMPAIGNS; c++) {
    const z = randomProfile(2000 + c);
    const start = { level: battleJson.startLevel, xp: 0 };
    let trip: Trip = { player: start, partner: start, bag: ['heilbeere', 'heilbeere'] };
    let done = false;
    for (let n = 1; n <= MAX_TRIPS; n++) {
      const s = playTrip(c * 31 + n, trip, style, z, (e) => {
        arrivals++;
        arrivalHp += e.hp;
        arrivalBerries += e.berries;
        if (e.berries === 0) noBerries++;
      });
      const result = settleRun(content, s, {});
      if (result.cleared) {
        tries.push(n);
        finalLevel += result.team.player.level;
        done = true;
        break;
      }
      defeats++;
      if (s.floor.boss) {
        bossDefeats++;
        const boss = unitById(s, 'boss');
        const left = boss ? boss.hp / boss.maxHp : 0;
        bossHpLeft += left;
        bossBuckets[Math.min(3, Math.floor(left * 4))]++;
        if (unitById(s, 'partner')!.hp <= 0 && unitById(s, 'player')!.hp > 0) partnerFirst++;
        if (s.bossSummoned) summoned++;
      }
      // Wie im Spiel: Stufen bleiben, der Beutel ist wieder wie vor dem Aufbruch; Oma Wurzel gibt nichts nach
      trip = { player: result.team.player, partner: result.team.partner, bag: result.bag.length > 0 ? result.bag : ['heilbeere'] };
    }
    if (!done) gaveUp++;
  }
  const won = tries.length;
  const first = tries.filter((n) => n === 1).length;
  const avg = won ? tries.reduce((a, b) => a + b, 0) / won : 0;
  const dist = [1, 2, 3, 4, 5].map((n) => `${n}. Versuch ${tries.filter((x) => x === n).length}`).join(' · ');
  console.log(`  ${CAMPAIGNS} Kampagnen: durchgespielt ${won} (${percent(won, CAMPAIGNS)}), aufgegeben nach ${MAX_TRIPS} Versuchen ${gaveUp}`);
  console.log(`  Beim 1. Ausflug geschafft: ${first} (${percent(first, CAMPAIGNS)}) · Ø Ausflüge bis zum Sieg ${avg.toFixed(1)}`);
  console.log(`  Verteilung: ${dist} · später ${tries.filter((x) => x > 5).length}`);
  console.log(`  Niederlagen insgesamt ${defeats}, davon beim Boss ${bossDefeats} · Ø Spielerstufe beim Sieg ${won ? (finalLevel / won).toFixed(1) : '-'}`);
  if (bossDefeats > 0) {
    console.log(`  Niederlagen beim Boss: Waldgeist hatte noch Ø ${percent(bossHpLeft, bossDefeats)} KP (unter 25 %: ${bossBuckets[0]}, 25–50 %: ${bossBuckets[1]}, 50–75 %: ${bossBuckets[2]}, über 75 %: ${bossBuckets[3]})`);
    console.log(`  Ankunft beim Boss (${arrivals}×): Team im Schnitt mit ${percent(arrivalHp, arrivals)} KP, ${(arrivalBerries / arrivals).toFixed(1)} Heilbeeren, ohne Heilbeere: ${percent(noBerries, arrivals)}`);
    console.log(`  Irrlichter schon gerufen: ${percent(summoned, bossDefeats)} · Partner fiel zuerst: ${percent(partnerFirst, bossDefeats)}`);
  }
}

console.log(`Flüsterwald: Dungeon-Stufe ${content.dungeon.level}, Boss Stufe ${content.dungeon.boss.level}, Startstufe ${battleJson.startLevel}`);
for (const style of ['einfach', 'geübt'] as Style[]) {
  console.log(`\nBot „${style}“, einzelne Ausflüge (${RUNS} je Stufe):`);
  for (const level of [battleJson.startLevel, battleJson.startLevel + 2, battleJson.startLevel + 4]) simulate(level, style);
  console.log(`Bot „${style}“, ganzes Spiel:`);
  campaigns(style);
}
