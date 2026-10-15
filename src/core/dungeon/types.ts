/** Typen des Dungeons. Alles hier ist reines JSON, damit ein laufender Dungeon gespeichert werden kann. */
import type { ElementChart } from '../elements';
import type { Dir, Pos } from '../grid';

export type MoveTarget = 'front' | 'line' | 'around' | 'self' | 'team';
export type StatusKind = 'blind' | 'sleep' | 'root' | 'guard' | 'focus';

export interface MoveDef {
  power: number;
  accuracy: number;
  pp: number;
  /** Element der Fähigkeit; ohne Element (Grundangriff) immer neutral */
  element?: string;
  target: MoveTarget;
  range?: number;
  effect?: StatusKind | 'heal';
  chance?: number;
  turns?: number;
  amount?: number;
  fx: string;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
}

export interface SpeciesDef {
  /** Element der Art (data/elements.json) */
  element: string;
  base: Stats;
  growth: Stats;
  sprite?: string;
  xp?: number;
  /** Feste Fähigkeiten (Gegner) */
  moves?: string[];
  /** Stufe → Fähigkeit (Team) */
  learn?: Record<string, string>;
  summon?: { species: string; count: number; belowHp: number };
}

export interface BattleData {
  startLevel: number;
  maxMoves: number;
  /** Erfahrung bis zur nächsten Stufe: base × Stufe^exponent (wächst immer steiler, wie in Mystery Dungeon) */
  xpToNext: { base: number; exponent: number };
  /** Erfahrung für einen besiegten Gegner: xp der Art × Stufe des Gegners × perLevel */
  xpYield: { perLevel: number };
  /** Schaden wächst mit der Stufe des Angreifers: × (1 + levelScale × (Stufe − 1)) */
  damage: { levelScale: number };
  team: Record<string, SpeciesDef>;
  enemies: Record<string, SpeciesDef>;
  boss: Record<string, SpeciesDef>;
}

export interface MovesData {
  attack: MoveDef;
  moves: Record<string, MoveDef>;
}

export interface ItemDef {
  weight: number;
  use: 'heal' | 'pp' | 'throw' | 'quest' | 'learn';
  /** Fähigkeitsstein: Element der Fähigkeit, die er lehrt */
  element?: string;
  amount?: number;
  range?: number;
  sprite: string;
}

export interface FloorDef {
  /** Stufe der Gegner auf dieser Etage (von, bis); steigt von Etage zu Etage */
  enemyLevel: [number, number];
  /** [Art, Gewicht] */
  enemies: [string, number][];
  enemyCount: [number, number];
  items: number;
  traps: number;
}

export interface DungeonDef {
  id: string;
  /** Schwierigkeit, wird vor dem Betreten angezeigt */
  level: number;
  size: { width: number; height: number };
  rooms: { cols: number; rows: number; minSize: number; maxWidth: number; maxHeight: number };
  bag: { size: number };
  sight: { corridor: number; notice: number };
  regenEvery: number;
  floors: FloorDef[];
  spawnEvery: number;
  items: Record<string, ItemDef>;
  traps: Record<string, { damage: number; sprite: string }>;
  quests: {
    verirrt: { floor: number; escort: { id: string; sprite: string; hp: number } };
    leuchtmoos: { item: string; perFloor: number; needed: number };
  };
  boss: { species: string; level: number; map: string[] };
  /** Fähigkeitssteine pro Dungeon (nicht pro Etage): bis moreAbove Etagen genau min, darüber zufällig min bis max */
  stones: { min: number; max: number; moreAbove: number };
}

export interface Content {
  dungeon: DungeonDef;
  battle: BattleData;
  moves: MovesData;
  elements: ElementChart;
}

export interface MoveSlot {
  id: string;
  pp: number;
  maxPp: number;
}

export interface Status {
  kind: StatusKind;
  turns: number;
}

export type Side = 'team' | 'enemy' | 'escort';

export interface Unit {
  /** player, partner, stups, boss oder e1, e2 … */
  id: string;
  side: Side;
  species: string;
  pos: Pos;
  facing: Dir;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  moves: MoveSlot[];
  status: Status[];
  /** Gegner hat das Team bemerkt; Begleiter folgt bereits */
  aware: boolean;
  boss?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GroundItem {
  pos: Pos;
  item: string;
}

export interface Trap {
  pos: Pos;
  kind: string;
  revealed: boolean;
}

export interface Floor {
  /** 1 … Anzahl Etagen; danach folgt die Lichtung des Bosses */
  number: number;
  boss: boolean;
  width: number;
  height: number;
  /** # = Wand (Wald), . = Boden; [y][x] */
  tiles: string[];
  rooms: Rect[];
  stairs: Pos | null;
  items: GroundItem[];
  traps: Trap[];
  /** Schon gesehene Felder für die Übersichtskarte: 1 = gesehen; [y][x] */
  explored: string[];
}

/** Passive Boni aus dem Persönlichkeitsprofil (siehe data/bonuses.json) */
export interface Bonuses {
  extraPp: number;
  attackPower: number;
  accuracy: number;
  extraItems: number;
  teamPower: number;
  stealth: number;
  healing: number;
  crit: number;
  sense: number;
  toughness: number;
}

export type EscortState = 'none' | 'waiting' | 'following' | 'rescued' | 'lost';

export interface DungeonState {
  version: 1;
  dungeonId: string;
  /** Zustand des Zufallsgenerators, damit Spielstände reproduzierbar weiterlaufen */
  rng: number;
  floor: Floor;
  units: Unit[];
  bag: string[];
  /** Beutel beim Betreten: nach einer Niederlage wird er wiederhergestellt */
  bagAtStart: string[];
  /** Quest-Tasche: Auftragsgegenstände, getrennt vom Beutel und ohne Platzgrenze (fehlt bei alten Spielständen) */
  questBag?: string[];
  questBagAtStart?: string[];
  turn: number;
  bonuses: Bonuses;
  escort: EscortState;
  mossActive: boolean;
  bossSummoned: boolean;
  nextId: number;
  outcome?: 'cleared' | 'defeated';
  /** Etagen, auf denen ein Fähigkeitsstein liegt (beim Betreten ausgewürfelt) */
  stonePlan?: number[];
  /** Neue Fähigkeiten aus Stufenaufstiegen, bei denen der Spieler wählen muss, was er verlernt */
  pendingLearn?: PendingLearn[];
}

export interface PendingLearn {
  id: 'player' | 'partner';
  move: string;
}

export type Action =
  | { type: 'move'; dir: Dir }
  | { type: 'turn'; dir: Dir }
  | { type: 'attack' }
  | { type: 'skill'; index: number }
  /** forget = Platz der Fähigkeit, die für einen Fähigkeitsstein verlernt wird (nur bei 4 aktiven) */
  | { type: 'item'; index: number; target: 'player' | 'partner'; forget?: number }
  /** Offene Fähigkeit aus einem Stufenaufstieg: forget = verlernter Platz, null = nicht lernen (kostet keinen Zug) */
  | { type: 'learn'; forget: number | null }
  /** Gegenstand auf das eigene Feld legen; liegt dort schon etwas, wird getauscht (kostet einen Zug) */
  | { type: 'drop'; index: number }
  | { type: 'wait' }
  | { type: 'stairs' }
  | { type: 'giveUp' };

export type GameEvent =
  | { type: 'move'; id: string; to: Pos }
  | { type: 'face'; id: string; dir: Dir }
  | { type: 'use'; id: string; move: string }
  | { type: 'projectile'; from: Pos; to: Pos; fx: string }
  | { type: 'hit'; id: string; amount: number; crit: boolean; fx: string }
  /** air = niemand stand im Weg (sonst hat id ausgewichen) */
  | { type: 'miss'; id: string; air?: boolean }
  | { type: 'heal'; id: string; amount: number }
  | { type: 'status'; id: string; status: StatusKind }
  | { type: 'statusEnd'; id: string; status: StatusKind }
  | { type: 'asleep'; id: string }
  | { type: 'noPp'; id: string }
  | { type: 'faint'; id: string }
  | { type: 'xp'; id: string; amount: number }
  /** offered = neue Fähigkeit, für die erst eine andere verlernt werden muss */
  | { type: 'levelUp'; id: string; level: number; learned?: string; offered?: string }
  | { type: 'learned'; id: string; move: string; forgot?: string }
  | { type: 'learnSkipped'; id: string; move: string }
  | { type: 'pickup'; id: string; item: string }
  | { type: 'bagFull'; item: string }
  /** picked = dafür aufgehobener Gegenstand (Tausch) */
  | { type: 'drop'; id: string; item: string; picked?: string }
  | { type: 'itemUsed'; id: string; item: string; target: string }
  | { type: 'trap'; id: string; kind: string; amount: number }
  | { type: 'onStairs' }
  | { type: 'join'; id: string }
  | { type: 'rescued' }
  | { type: 'escortLost' }
  | { type: 'floor'; number: number; boss: boolean }
  | { type: 'summon'; ids: string[] }
  | { type: 'spawn'; id: string }
  | { type: 'bossCalm' }
  | { type: 'defeated' }
  | { type: 'cleared' };
