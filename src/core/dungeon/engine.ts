/**
 * Die Regeln des Dungeons, ohne Phaser: Ein Zug des Spielers löst Züge von Partner,
 * Begleiter und Gegnern aus. act() verändert den Zustand und liefert Ereignisse,
 * die die Darstellung nacheinander abspielt.
 */
import { elementFactor } from '../elements';
import { DIRS, canStep, dirTo, findPath, samePos, step, type Dir, type Pos } from '../grid';
import type { Profile } from '../types';
import { enterBossFloor, enterFloor, isFloorTile, newId, rollEnemy } from './generate';
import { createRandom, type Random } from './random';
import { computeBonuses, gainXp, levelDamage, makeUnit, speciesDef, xpYield, type BonusDef } from './stats';
import type { Action, Content, DungeonState, GameEvent, MoveDef, Unit } from './types';

const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export interface TeamMember {
  species: string;
  level: number;
  xp: number;
}

export interface RunOptions {
  seed: number;
  player: TeamMember;
  partner: TeamMember;
  z: Profile;
  bonusDefs: Record<string, BonusDef>;
  bag: string[];
  /** Quest „verirrt“ ist angenommen: Stups wartet auf seiner Etage */
  escort: boolean;
  /** Quest „leuchtmoos“ ist angenommen: Moos liegt auf jeder Etage */
  moss: boolean;
}

/** Neuer Durchgang: Team auf Etage 1, volle Energie und Lebenspunkte. */
export function startRun(content: Content, opts: RunOptions): DungeonState {
  const bonuses = computeBonuses(opts.z, opts.bonusDefs);
  const origin = { x: 0, y: 0 };
  const player = makeUnit(content, { id: 'player', side: 'team', species: opts.player.species, level: opts.player.level, xp: opts.player.xp, pos: origin, extraPp: bonuses.extraPp });
  const partner = makeUnit(content, { id: 'partner', side: 'team', species: opts.partner.species, level: opts.partner.level, xp: opts.partner.xp, pos: origin });
  const state: DungeonState = {
    version: 1,
    dungeonId: content.dungeon.id,
    rng: opts.seed >>> 0,
    floor: undefined as unknown as DungeonState['floor'],
    units: [player, partner],
    bag: [...opts.bag],
    bagAtStart: [...opts.bag],
    turn: 0,
    bonuses,
    escort: opts.escort ? 'waiting' : 'none',
    mossActive: opts.moss,
    bossSummoned: false,
    nextId: 1,
  };
  withRandom(state, (rng) => enterFloor(content, state, 1, rng));
  updateExplored(content, state);
  return state;
}

function withRandom<T>(state: DungeonState, fn: (rng: Random) => T): T {
  const rng = createRandom(state.rng);
  const result = fn(rng);
  state.rng = rng.state;
  return result;
}

export const unitById = (state: DungeonState, id: string) => state.units.find((u) => u.id === id);
export const unitAt = (state: DungeonState, p: Pos) => state.units.find((u) => u.hp > 0 && samePos(u.pos, p));
const hasStatus = (u: Unit, kind: string) => u.status.some((s) => s.kind === kind);
/** Feinde? Ein wartender Begleiter (noch nicht gefunden) wird von Gegnern in Ruhe gelassen. */
const isFoe = (a: Unit, b: Unit) => (a.side === 'enemy') !== (b.side === 'enemy') && !isHiding(a) && !isHiding(b);
const isHiding = (u: Unit) => u.side === 'escort' && !u.aware;

// ---------- Sicht ----------

/** Raum, in dem ein Feld liegt (Index) oder -1 im Gang */
export function roomIndex(state: DungeonState, p: Pos): number {
  return state.floor.rooms.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
}

/** Sieht man von `from` aus das Feld `p`? Im Raum: der ganze Raum samt Rand, im Gang: ein kleiner Umkreis. */
export function canSee(content: Content, state: DungeonState, from: Pos, p: Pos): boolean {
  const room = roomIndex(state, from);
  if (room >= 0) {
    const r = state.floor.rooms[room];
    if (p.x >= r.x - 1 && p.x <= r.x + r.w && p.y >= r.y - 1 && p.y <= r.y + r.h) return true;
  }
  return chebyshev(from, p) <= content.dungeon.sight.corridor;
}

/** Ist ein Feld für das Team gerade sichtbar (Spieler oder Partner sieht es)? */
export function teamSees(content: Content, state: DungeonState, p: Pos): boolean {
  return state.units.some((u) => u.side === 'team' && u.hp > 0 && canSee(content, state, u.pos, p));
}

/** Gegner und Fallen, die das Feingefühl (hoher Pol) erspürt, auch ohne Sicht */
export function senses(state: DungeonState, p: Pos): boolean {
  const player = unitById(state, 'player');
  return !!player && state.bonuses.sense > 0 && chebyshev(player.pos, p) <= state.bonuses.sense;
}

function updateExplored(content: Content, state: DungeonState) {
  const f = state.floor;
  f.explored = f.explored.map((row, y) =>
    [...row].map((c, x) => (c === '1' || teamSees(content, state, { x, y }) ? '1' : '0')).join(''),
  );
  for (const t of f.traps) if (!t.revealed && senses(state, t.pos)) t.revealed = true;
}

// ---------- Bewegung ----------

const tileFree = (state: DungeonState) => (p: Pos) => isFloorTile(state.floor, p);
const freeOfUnits = (state: DungeonState, except?: Unit) => (p: Pos) =>
  isFloorTile(state.floor, p) && !state.units.some((u) => u !== except && u.hp > 0 && samePos(u.pos, p));

/** Darf von a nach b (Nachbarfeld) gegangen/angegriffen werden? Schräg nicht um Ecken. */
function reachable(state: DungeonState, a: Pos, b: Pos): boolean {
  const dir = dirTo(a, b);
  return !!dir && canStep(a, dir, tileFree(state));
}

function moveUnit(unit: Unit, to: Pos, events: GameEvent[]) {
  const dir = dirTo(unit.pos, to);
  if (dir) unit.facing = dir;
  unit.pos = { ...to };
  events.push({ type: 'move', id: unit.id, to: { ...to } });
}

/** Ein Schritt in Richtung eines Ziels (oder eines Nachbarfelds davon) */
function stepToward(state: DungeonState, unit: Unit, targets: Pos[], events: GameEvent[]): boolean {
  if (hasStatus(unit, 'root')) return false;
  const path = findPath(unit.pos, targets, freeOfUnits(state, unit), 2500);
  if (!path || path.length === 0) return false;
  moveUnit(unit, step(unit.pos, path[0]), events);
  return true;
}

function neighbors(p: Pos): Pos[] {
  return DIRS.map((d) => step(p, d));
}

/** Kann a das Nachbarfeld b angreifen? (Schräg nicht um Ecken herum) */
export function canStrike(state: DungeonState, a: Pos, b: Pos): boolean {
  return reachable(state, a, b);
}

/** Felder, von denen aus man ein Ziel wirklich angreifen kann */
function attackSpots(state: DungeonState, target: Pos): Pos[] {
  return neighbors(target).filter((p) => isFloorTile(state.floor, p) && reachable(state, p, target));
}

// ---------- Kampf ----------

function moveDef(content: Content, id: string): MoveDef {
  return id === 'attack' ? content.moves.attack : content.moves.moves[id];
}

/** Ziele einer Fähigkeit in Blickrichtung */
function targetsOf(state: DungeonState, user: Unit, def: MoveDef, dir: Dir): { units: Unit[]; end: Pos } {
  if (def.target === 'self') return { units: [user], end: user.pos };
  if (def.target === 'team') {
    return { units: state.units.filter((u) => u.hp > 0 && !isFoe(u, user) && chebyshev(u.pos, user.pos) <= 1), end: user.pos };
  }
  if (def.target === 'around') {
    return { units: neighbors(user.pos).map((p) => unitAt(state, p)).filter((u): u is Unit => !!u && isFoe(u, user) && reachable(state, user.pos, u.pos)), end: user.pos };
  }
  if (def.target === 'front') {
    const p = step(user.pos, dir);
    const u = unitAt(state, p);
    return { units: u && isFoe(u, user) && reachable(state, user.pos, p) ? [u] : [], end: p };
  }
  // line: Geschoss fliegt bis zum ersten Wesen oder zur Wand
  let p = user.pos;
  for (let i = 0; i < (def.range ?? 6); i++) {
    if (!canStep(p, dir, tileFree(state))) break;
    p = step(p, dir);
    const u = unitAt(state, p);
    if (u) return { units: isFoe(u, user) ? [u] : [], end: p };
  }
  return { units: [], end: p };
}

/** Automatisches Zielen: Richtung, in der die Fähigkeit einen Gegner trifft (Blickrichtung zuerst). */
export function aim(content: Content, state: DungeonState, user: Unit, moveId: string): Dir {
  return aimWith(state, user, moveDef(content, moveId));
}

function aimWith(state: DungeonState, user: Unit, def: MoveDef): Dir {
  if (def.target === 'self' || def.target === 'team' || def.target === 'around') return user.facing;
  const order = [user.facing, ...DIRS.filter((d) => d !== user.facing)];
  return order.find((d) => targetsOf(state, user, def, d).units.length > 0) ?? user.facing;
}

function addStatus(unit: Unit, kind: Unit['status'][number]['kind'], turns: number, events: GameEvent[]) {
  const existing = unit.status.find((s) => s.kind === kind);
  if (existing) existing.turns = Math.max(existing.turns, turns);
  else unit.status.push({ kind, turns });
  events.push({ type: 'status', id: unit.id, status: kind });
}

/** Element eines Wesens; Begleiter wie Stups kämpfen nicht und haben keins */
function elementOf(content: Content, unit: Unit): string | undefined {
  return unit.side === 'escort' ? undefined : speciesDef(content, unit.side, unit.species).element;
}

function damageTo(content: Content, state: DungeonState, user: Unit, target: Unit, def: MoveDef, isAttack: boolean, rng: Random) {
  const b = state.bonuses;
  let power = def.power;
  if (isAttack && user.id === 'player') power += b.attackPower;
  let dmg = ((user.atk + power) * (0.85 + rng.next() * 0.15) - target.def * 0.6) * levelDamage(content, user.level);
  if (user.id === 'partner') {
    const player = unitById(state, 'player');
    if (player && chebyshev(player.pos, user.pos) <= 1) dmg *= 1 + b.teamPower;
  }
  dmg *= elementFactor(content.elements, def.element, elementOf(content, target));
  if (hasStatus(target, 'guard')) dmg *= 0.6;
  if (target.id === 'player') dmg *= 1 - b.toughness;
  const crit = rng.chance(5 + (hasStatus(user, 'focus') ? 15 : 0) + (user.id === 'player' ? b.crit : 0));
  if (crit) dmg *= 1.5;
  return { amount: Math.max(1, Math.round(dmg)), crit };
}

function hitChance(state: DungeonState, user: Unit, def: MoveDef): number {
  let acc = def.accuracy;
  if (user.id === 'player') acc += state.bonuses.accuracy;
  if (hasStatus(user, 'blind')) acc -= 30;
  if (hasStatus(user, 'focus')) acc += 10;
  return Math.max(5, Math.min(100, acc));
}

/** Setzt eine Fähigkeit (oder den Normalangriff 'attack') in Richtung dir ein. */
function useMove(content: Content, state: DungeonState, user: Unit, moveId: string, dir: Dir, rng: Random, events: GameEvent[]) {
  const def = moveDef(content, moveId);
  user.facing = dir;
  events.push({ type: 'face', id: user.id, dir });
  events.push({ type: 'use', id: user.id, move: moveId });
  const { units, end } = targetsOf(state, user, def, dir);
  if (def.target === 'line') events.push({ type: 'projectile', from: { ...user.pos }, to: end, fx: def.fx });
  if (units.length === 0 && def.target !== 'self' && def.target !== 'team') {
    events.push({ type: 'miss', id: user.id, air: true });
    return;
  }
  for (const target of units) {
    if (def.effect === 'heal') {
      const amount = Math.min(def.amount ?? 0, target.maxHp - target.hp);
      target.hp += amount;
      events.push({ type: 'heal', id: target.id, amount });
      continue;
    }
    if (target !== user && !rng.chance(hitChance(state, user, def))) {
      events.push({ type: 'miss', id: target.id });
      continue;
    }
    if (def.power > 0) {
      const { amount, crit } = damageTo(content, state, user, target, def, moveId === 'attack', rng);
      target.hp = Math.max(0, target.hp - amount);
      events.push({ type: 'hit', id: target.id, amount, crit, fx: def.fx });
      // Schlafende wachen durch Treffer auf
      if (hasStatus(target, 'sleep')) {
        target.status = target.status.filter((s) => s.kind !== 'sleep');
        events.push({ type: 'statusEnd', id: target.id, status: 'sleep' });
      }
    }
    if (def.effect && target.hp > 0 && rng.chance(def.chance ?? 100)) addStatus(target, def.effect, def.turns ?? 3, events);
    if (target.side === 'enemy') target.aware = true;
    if (target.hp <= 0) faint(content, state, target, user, events);
  }
}

function faint(content: Content, state: DungeonState, unit: Unit, by: Unit, events: GameEvent[]) {
  events.push({ type: 'faint', id: unit.id });
  if (unit.side === 'escort') {
    state.escort = 'lost';
    events.push({ type: 'escortLost' });
    return;
  }
  if (unit.side !== 'enemy' || by.side !== 'team') return;
  const def = speciesDef(content, 'enemy', unit.species);
  const amount = xpYield(content, def, unit.level);
  for (const member of state.units.filter((u) => u.side === 'team' && u.hp > 0)) {
    events.push(...gainXp(content, member, amount, member.id === 'player' ? state.bonuses.extraPp : 0));
  }
  if (unit.boss) {
    events.push({ type: 'bossCalm' });
    // Die gerufenen Irrlichter verschwinden mit dem besänftigten Geist
    for (const u of state.units) if (u.side === 'enemy') u.hp = 0;
    state.outcome = 'cleared';
    events.push({ type: 'cleared' });
  }
}

// ---------- Gegenstände und Fallen ----------

function afterPlayerStep(content: Content, state: DungeonState, player: Unit, events: GameEvent[]) {
  const f = state.floor;
  const idx = f.items.findIndex((it) => samePos(it.pos, player.pos));
  if (idx >= 0) {
    const item = f.items[idx].item;
    if (state.bag.length < content.dungeon.bag.size) {
      state.bag.push(item);
      f.items.splice(idx, 1);
      events.push({ type: 'pickup', id: player.id, item });
    } else {
      events.push({ type: 'bagFull', item });
    }
  }
  const trap = f.traps.find((t) => samePos(t.pos, player.pos));
  if (trap) {
    trap.revealed = true;
    const amount = Math.max(1, Math.round(content.dungeon.traps[trap.kind].damage * (1 - state.bonuses.toughness)));
    player.hp = Math.max(0, player.hp - amount);
    events.push({ type: 'trap', id: player.id, kind: trap.kind, amount });
  }
  if (f.stairs && samePos(f.stairs, player.pos)) events.push({ type: 'onStairs' });
}

function useItem(content: Content, state: DungeonState, player: Unit, index: number, targetId: 'player' | 'partner', events: GameEvent[]): boolean {
  const item = state.bag[index];
  const def = item && content.dungeon.items[item];
  if (!def || def.use === 'quest') return false;
  const target = unitById(state, targetId);
  if (!target || target.hp <= 0) return false;
  state.bag.splice(index, 1);
  events.push({ type: 'itemUsed', id: player.id, item, target: targetId });
  if (def.use === 'heal') {
    const amount = Math.min(Math.round((def.amount ?? 0) * (1 + state.bonuses.healing)), target.maxHp - target.hp);
    target.hp += amount;
    events.push({ type: 'heal', id: target.id, amount });
  } else if (def.use === 'pp') {
    for (const m of target.moves) m.pp = Math.min(m.maxPp, m.pp + (def.amount ?? 0));
    events.push({ type: 'heal', id: target.id, amount: 0 });
  } else if (def.use === 'throw') {
    const throwDef: MoveDef = { power: 0, accuracy: 100, pp: 0, target: 'line', range: def.range, fx: 'rock' };
    const dir = aimWith(state, player, throwDef);
    const { units, end } = targetsOf(state, player, throwDef, dir);
    player.facing = dir;
    events.push({ type: 'face', id: player.id, dir }, { type: 'projectile', from: { ...player.pos }, to: end, fx: 'rock' });
    const hit = units[0];
    if (hit) {
      hit.hp = Math.max(0, hit.hp - (def.amount ?? 0));
      hit.aware = true;
      events.push({ type: 'hit', id: hit.id, amount: def.amount ?? 0, crit: false, fx: 'rock' });
      if (hit.hp <= 0) faint(content, state, hit, player, events);
    } else {
      events.push({ type: 'miss', id: player.id, air: true });
    }
  }
  return true;
}

// ---------- Verhalten der anderen ----------

/** Fähigkeit wählen: oft der Normalangriff, manchmal eine passende Fähigkeit mit Energie */
function chooseMove(content: Content, state: DungeonState, unit: Unit, rng: Random, specialChance: number): { id: string; dir: Dir } | null {
  const usable = unit.moves.filter((m) => m.pp > 0);
  if (unit.side === 'team' && unit.hp < unit.maxHp * 0.35) {
    const heal = usable.find((m) => moveDef(content, m.id).effect === 'heal');
    if (heal) return { id: heal.id, dir: unit.facing };
  }
  if (usable.length > 0 && rng.chance(specialChance)) {
    const options = usable.filter((m) => {
      const def = moveDef(content, m.id);
      // Schutz und Konzentration nur, wenn ein Gegner in der Nähe ist
      if (def.target === 'self') return !hasStatus(unit, def.effect ?? '') && state.units.some((u) => u.hp > 0 && isFoe(u, unit) && chebyshev(u.pos, unit.pos) <= 2);
      if (def.target === 'team') return false;
      return targetsOf(state, unit, def, aim(content, state, unit, m.id)).units.length > 0;
    });
    if (options.length > 0) {
      const m = rng.pick(options);
      return { id: m.id, dir: aim(content, state, unit, m.id) };
    }
  }
  const dir = aim(content, state, unit, 'attack');
  return targetsOf(state, unit, content.moves.attack, dir).units.length > 0 ? { id: 'attack', dir } : null;
}

function spendPp(unit: Unit, moveId: string) {
  const slot = unit.moves.find((m) => m.id === moveId);
  if (slot) slot.pp = Math.max(0, slot.pp - 1);
}

function actWith(content: Content, state: DungeonState, unit: Unit, choice: { id: string; dir: Dir }, rng: Random, events: GameEvent[]) {
  spendPp(unit, choice.id);
  useMove(content, state, unit, choice.id, choice.dir, rng, events);
}

function partnerTurn(content: Content, state: DungeonState, partner: Unit, rng: Random, events: GameEvent[]) {
  const player = unitById(state, 'player')!;
  const choice = chooseMove(content, state, partner, rng, 40);
  if (choice) return actWith(content, state, partner, choice, rng, events);
  const foes = state.units.filter((u) => u.side === 'enemy' && u.hp > 0 && chebyshev(u.pos, partner.pos) <= 3 && canSee(content, state, partner.pos, u.pos));
  if (foes.length > 0 && chebyshev(partner.pos, player.pos) <= 3) {
    const target = foes.sort((a, b) => chebyshev(a.pos, partner.pos) - chebyshev(b.pos, partner.pos))[0];
    if (stepToward(state, partner, attackSpots(state, target.pos), events)) return;
  }
  if (chebyshev(partner.pos, player.pos) > 1) stepToward(state, partner, neighbors(player.pos), events);
}

function escortTurn(state: DungeonState, escort: Unit, events: GameEvent[]) {
  if (state.escort !== 'following') return;
  const player = unitById(state, 'player')!;
  if (chebyshev(escort.pos, player.pos) > 1) stepToward(state, escort, neighbors(player.pos), events);
}

function enemyTurn(content: Content, state: DungeonState, enemy: Unit, rng: Random, events: GameEvent[]) {
  const targets = state.units.filter((u) => u.hp > 0 && u.side !== 'enemy' && (u.side === 'team' || state.escort === 'following'));
  if (!enemy.aware) {
    const notice = Math.max(1, content.dungeon.sight.notice - state.bonuses.stealth);
    if (targets.some((t) => chebyshev(t.pos, enemy.pos) <= notice && canSee(content, state, enemy.pos, t.pos))) enemy.aware = true;
  }
  if (enemy.boss) bossSummon(content, state, enemy, events);
  if (!enemy.aware) {
    if (rng.chance(50) && !hasStatus(enemy, 'root')) {
      const options = DIRS.filter((d) => canStep(enemy.pos, d, freeOfUnits(state, enemy)));
      if (options.length > 0) moveUnit(enemy, step(enemy.pos, rng.pick(options)), events);
    }
    return;
  }
  const choice = chooseMove(content, state, enemy, rng, enemy.boss ? 55 : 35);
  if (choice) return actWith(content, state, enemy, choice, rng, events);
  const nearest = targets.sort((a, b) => chebyshev(a.pos, enemy.pos) - chebyshev(b.pos, enemy.pos))[0];
  if (nearest) stepToward(state, enemy, attackSpots(state, nearest.pos), events);
}

/** Der Waldgeist ruft einmal Irrlichter zu Hilfe, wenn er geschwächt ist. */
function bossSummon(content: Content, state: DungeonState, boss: Unit, events: GameEvent[]) {
  const summon = speciesDef(content, 'enemy', boss.species).summon;
  if (!summon || state.bossSummoned || boss.hp > boss.maxHp * summon.belowHp) return;
  state.bossSummoned = true;
  const ids: string[] = [];
  for (const p of neighbors(boss.pos)) {
    if (ids.length >= summon.count) break;
    if (!freeOfUnits(state)(p)) continue;
    const u = makeUnit(content, { id: newId(state), side: 'enemy', species: summon.species, level: boss.level - 2, pos: p });
    u.aware = true;
    state.units.push(u);
    ids.push(u.id);
  }
  if (ids.length > 0) events.push({ type: 'summon', ids });
}

/** Status runterzählen, ggf. aufheben */
function tickStatus(unit: Unit, events: GameEvent[]) {
  for (const s of unit.status) s.turns--;
  for (const s of unit.status.filter((st) => st.turns <= 0)) events.push({ type: 'statusEnd', id: unit.id, status: s.kind });
  unit.status = unit.status.filter((s) => s.turns > 0);
}

/** Schläft das Wesen? Dann setzt es aus. */
function asleep(unit: Unit, events: GameEvent[]): boolean {
  if (!hasStatus(unit, 'sleep')) return false;
  events.push({ type: 'asleep', id: unit.id });
  return true;
}

// ---------- Ein Zug ----------

/** Führt die Aktion des Spielers aus. Gibt [] zurück, wenn sie nicht möglich war (kein Zug verbraucht). */
export function act(content: Content, state: DungeonState, action: Action): GameEvent[] {
  if (state.outcome) return [];
  return withRandom(state, (rng) => {
    const events: GameEvent[] = [];
    const player = unitById(state, 'player')!;

    if (action.type === 'turn') {
      player.facing = action.dir;
      return [{ type: 'face', id: 'player', dir: action.dir }];
    }
    if (action.type === 'giveUp') return defeat(state, events);

    if (!asleep(player, events)) {
      if (!playerAction(content, state, player, action, rng, events)) return [];
      if (action.type === 'stairs') return events;
    }
    if (state.outcome) return events;
    endOfTurn(content, state, rng, events);
    return events;
  });
}

function playerAction(content: Content, state: DungeonState, player: Unit, action: Action, rng: Random, events: GameEvent[]): boolean {
  switch (action.type) {
    case 'move': {
      const target = step(player.pos, action.dir);
      player.facing = action.dir;
      if (!canStep(player.pos, action.dir, tileFree(state))) {
        events.push({ type: 'face', id: 'player', dir: action.dir });
        return false;
      }
      const other = unitAt(state, target);
      if (other?.side === 'enemy') {
        useMove(content, state, player, 'attack', action.dir, rng, events);
        return true;
      }
      // Festgehalten: kein Schritt möglich, aber der Befreiungsversuch kostet einen Zug (sonst endet es nie)
      if (hasStatus(player, 'root')) {
        events.push({ type: 'status', id: 'player', status: 'root' });
        return true;
      }
      if (other?.side === 'escort' && state.escort === 'waiting') {
        state.escort = 'following';
        other.aware = true;
        events.push({ type: 'face', id: 'player', dir: action.dir }, { type: 'join', id: other.id });
        return true;
      }
      if (other) moveUnit(other, player.pos, events); // Plätze tauschen
      moveUnit(player, target, events);
      afterPlayerStep(content, state, player, events);
      return true;
    }
    case 'attack':
      useMove(content, state, player, 'attack', aim(content, state, player, 'attack'), rng, events);
      return true;
    case 'skill': {
      const slot = player.moves[action.index];
      if (!slot) return false;
      if (slot.pp <= 0) {
        events.push({ type: 'noPp', id: 'player' });
        return false;
      }
      slot.pp--;
      useMove(content, state, player, slot.id, aim(content, state, player, slot.id), rng, events);
      return true;
    }
    case 'item':
      return useItem(content, state, player, action.index, action.target, events);
    case 'wait':
      return true;
    case 'stairs':
      return takeStairs(content, state, player, rng, events);
    default:
      return false;
  }
}

function takeStairs(content: Content, state: DungeonState, player: Unit, rng: Random, events: GameEvent[]): boolean {
  const f = state.floor;
  if (!f.stairs || !samePos(f.stairs, player.pos)) return false;
  if (state.escort === 'following' && f.number === content.dungeon.quests.verirrt.floor) {
    state.escort = 'rescued';
    events.push({ type: 'rescued' });
  }
  // Wer zurückbleibt, bleibt zurück: Stups wartet dann vergeblich
  if (state.escort === 'waiting' && f.number >= content.dungeon.quests.verirrt.floor) state.escort = 'none';
  state.units = state.units.filter((u) => u.side === 'team' || (u.side === 'escort' && state.escort === 'following'));
  for (const u of state.units) u.status = [];
  const next = f.number + 1;
  if (next > content.dungeon.floors.length) enterBossFloor(content, state);
  else enterFloor(content, state, next, rng);
  events.push({ type: 'floor', number: state.floor.number, boss: state.floor.boss });
  updateExplored(content, state);
  return true;
}

function defeat(state: DungeonState, events: GameEvent[]): GameEvent[] {
  state.outcome = 'defeated';
  state.bag = [...state.bagAtStart];
  events.push({ type: 'defeated' });
  return events;
}

function endOfTurn(content: Content, state: DungeonState, rng: Random, events: GameEvent[]) {
  const player = unitById(state, 'player')!;
  tickStatus(player, events);
  const others = state.units.filter((u) => u.id !== 'player');
  for (const unit of others) {
    if (unit.hp <= 0 || state.outcome) continue;
    if (!asleep(unit, events)) {
      if (unit.id === 'partner') partnerTurn(content, state, unit, rng, events);
      else if (unit.side === 'escort') escortTurn(state, unit, events);
      else enemyTurn(content, state, unit, rng, events);
    }
    tickStatus(unit, events);
    if (player.hp <= 0 || unitById(state, 'partner')!.hp <= 0) return void defeat(state, events);
  }
  if (player.hp <= 0) return void defeat(state, events);
  state.units = state.units.filter((u) => u.hp > 0 || u.side === 'team');
  state.turn++;

  // Langsame Erholung des Teams; Verträglichkeit (hoher Pol) beschleunigt sie
  const every = Math.max(2, Math.round(content.dungeon.regenEvery / (1 + state.bonuses.healing)));
  if (state.turn % every === 0) {
    for (const u of state.units.filter((x) => (x.side === 'team' || (x.side === 'escort' && state.escort === 'following')) && x.hp < x.maxHp)) {
      u.hp = Math.min(u.maxHp, u.hp + 1 + Math.floor(u.maxHp / 40));
    }
  }
  // Ab und zu taucht ein neuer Gegner auf, außer auf der Boss-Lichtung
  if (!state.floor.boss && state.turn % content.dungeon.spawnEvery === 0) spawnEnemy(content, state, rng, events);
  updateExplored(content, state);
}

function spawnEnemy(content: Content, state: DungeonState, rng: Random, events: GameEvent[]) {
  const max = content.dungeon.floors[state.floor.number - 1].enemyCount[1] + 2;
  if (state.units.filter((u) => u.side === 'enemy' && u.hp > 0).length >= max) return;
  for (let i = 0; i < 30; i++) {
    const room = rng.pick(state.floor.rooms);
    const p = { x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y, room.y + room.h - 1) };
    if (!freeOfUnits(state)(p) || teamSees(content, state, p)) continue;
    const enemy = rollEnemy(content, state, state.floor.number, p, rng);
    state.units.push(enemy);
    events.push({ type: 'spawn', id: enemy.id });
    return;
  }
}
