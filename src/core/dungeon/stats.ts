/** Werte, Stufen, Fähigkeiten und Persönlichkeits-Boni. */
import type { Dir, Pos } from '../grid';
import { DIMENSIONS, type Profile } from '../types';
import type { Bonuses, Content, GameEvent, MoveSlot, Side, SpeciesDef, Stats, Unit } from './types';

export interface BonusDef {
  high: { kind: keyof Bonuses; perS: number };
  low: { kind: keyof Bonuses; perS: number };
}

export function statsAt(species: SpeciesDef, level: number): Stats {
  const at = (k: keyof Stats) => Math.floor(species.base[k] + species.growth[k] * (level - 1));
  return { hp: at('hp'), atk: at('atk'), def: at('def') };
}

export function xpToNext(content: Content, level: number): number {
  const { base, perLevel } = content.battle.xpToNext;
  return base + perLevel * level;
}

/** Fähigkeiten, die ein Team-Wesen auf dieser Stufe kennt (die zuletzt gelernten, höchstens maxMoves). */
export function movesAt(content: Content, species: SpeciesDef, level: number): string[] {
  const learned = Object.entries(species.learn ?? {})
    .filter(([lvl]) => Number(lvl) <= level)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, id]) => id);
  return learned.slice(-content.battle.maxMoves);
}

function slot(content: Content, id: string, extraPp: number): MoveSlot {
  const maxPp = content.moves.moves[id].pp + extraPp;
  return { id, pp: maxPp, maxPp };
}

export function speciesDef(content: Content, side: Side, species: string): SpeciesDef {
  const b = content.battle;
  const def = side === 'team' ? b.team[species] : (b.enemies[species] ?? b.boss[species]);
  if (!def) throw new Error(`Unbekannte Art: ${species}`);
  return def;
}

export function makeUnit(
  content: Content,
  opts: { id: string; side: Side; species: string; level: number; xp?: number; pos: Pos; facing?: Dir; extraPp?: number; boss?: boolean },
): Unit {
  const def = speciesDef(content, opts.side, opts.species);
  const s = statsAt(def, opts.level);
  const moveIds = opts.side === 'team' ? movesAt(content, def, opts.level) : (def.moves ?? []);
  return {
    id: opts.id,
    side: opts.side,
    species: opts.species,
    pos: { ...opts.pos },
    facing: opts.facing ?? 'down',
    level: opts.level,
    xp: opts.xp ?? 0,
    hp: s.hp,
    maxHp: s.hp,
    atk: s.atk,
    def: s.def,
    moves: moveIds.map((id) => slot(content, id, opts.extraPp ?? 0)),
    status: [],
    aware: false,
    boss: opts.boss,
  };
}

/** Erfahrung gutschreiben; bei Stufenaufstieg steigen die Werte, neue Fähigkeiten werden gelernt. */
export function gainXp(content: Content, unit: Unit, amount: number, extraPp: number): GameEvent[] {
  const events: GameEvent[] = [{ type: 'xp', id: unit.id, amount }];
  unit.xp += amount;
  const def = speciesDef(content, unit.side, unit.species);
  while (unit.xp >= xpToNext(content, unit.level)) {
    unit.xp -= xpToNext(content, unit.level);
    unit.level++;
    const s = statsAt(def, unit.level);
    unit.hp += s.hp - unit.maxHp;
    unit.maxHp = s.hp;
    unit.atk = s.atk;
    unit.def = s.def;
    const newMove = def.learn?.[String(unit.level)];
    let forgot: string | undefined;
    if (newMove && !unit.moves.some((m) => m.id === newMove)) {
      if (unit.moves.length >= content.battle.maxMoves) forgot = unit.moves.shift()!.id;
      unit.moves.push(slot(content, newMove, extraPp));
    }
    events.push({ type: 'levelUp', id: unit.id, level: unit.level, learned: newMove, forgot });
  }
  return events;
}

/** Boni aus dem z-Profil: Jeder Pol einer Dimension bringt einen eigenen Vorteil. */
export function computeBonuses(z: Profile, defs: Record<string, BonusDef>): Bonuses {
  const bonuses: Bonuses = {
    extraPp: 0,
    attackPower: 0,
    accuracy: 0,
    extraItems: 0,
    teamPower: 0,
    stealth: 0,
    healing: 0,
    crit: 0,
    sense: 0,
    toughness: 0,
  };
  for (const d of DIMENSIONS) {
    const def = defs[d];
    if (!def) continue;
    const v = Math.max(-2, Math.min(2, z[d]));
    const pole = v >= 0 ? def.high : def.low;
    bonuses[pole.kind] += Math.abs(v) * pole.perS;
  }
  // Ganzzahlige Boni runden, damit sie im Spiel eindeutig sind
  for (const k of ['extraPp', 'attackPower', 'accuracy', 'crit', 'stealth', 'sense'] as const) bonuses[k] = Math.round(bonuses[k]);
  return bonuses;
}
