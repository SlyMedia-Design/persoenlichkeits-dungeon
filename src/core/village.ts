/** Dorf-Logik ohne Phaser: Karte aus Textraster, Begehbarkeit, Interaktionen, Aufträge. */
import { step, type Dir, type Pos } from './grid';

/** Was ein Zeichen der Textkarte bedeutet */
export interface TileDef {
  /** Bodenkachel, z. B. grass, path, water */
  ground: string;
  /** Gegenstand auf dem Boden, z. B. tree, roof, board */
  object?: string;
  solid?: boolean;
  /** i18n-Schlüssel eines Textes beim Untersuchen */
  examine?: string;
  /** Feld ist das Schwarze Brett */
  board?: boolean;
}

export type QuestStatus = 'accepted' | 'done';
export type QuestLog = Record<string, QuestStatus>;

export interface DialogRule {
  /** Gilt nur, wenn der Auftrag diesen Stand hat ('open' = noch nicht angenommen) */
  when?: { quest: string; status: QuestStatus | 'open' };
  /** i18n-Schlüssel einer Liste von Sätzen */
  lines: string;
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  facing: Dir;
  /** Platzhalter-Farbe (Farbkreis mit Augen) */
  color: string;
  /** Erste passende Regel gewinnt */
  dialogs: DialogRule[];
}

export interface Placement extends Pos {
  facing: Dir;
}

export interface VillageDef {
  legend: Record<string, TileDef>;
  map: string[];
  spawn: Placement;
  partnerSpawn: Pos;
  npcs: NpcDef[];
  /** Untersuchungstexte für einzelne Felder (überschreiben die Legende) */
  examine: (Pos & { text: string })[];
  quests: { id: string }[];
}

export interface VillageMap {
  def: VillageDef;
  width: number;
  height: number;
  /** Zeichen je Feld, [y][x] */
  chars: string[];
}

export type Interaction =
  | { kind: 'npc'; npc: NpcDef }
  | { kind: 'board' }
  | { kind: 'examine'; text: string };

/** Prüft die Textkarte und gibt sie zurück; Fehler in den Daten werfen sofort. */
export function parseVillage(def: VillageDef): VillageMap {
  const height = def.map.length;
  const width = def.map[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('Dorfkarte ist leer');
  def.map.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Zeile ${y} hat ${row.length} statt ${width} Zeichen`);
    [...row].forEach((ch, x) => {
      if (!def.legend[ch]) throw new Error(`Unbekanntes Zeichen „${ch}“ bei ${x},${y}`);
    });
  });
  return { def, width, height, chars: def.map };
}

export function inBounds(map: VillageMap, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
}

export function tileAt(map: VillageMap, p: Pos): TileDef | undefined {
  return inBounds(map, p) ? map.def.legend[map.chars[p.y][p.x]] : undefined;
}

export function npcAt(map: VillageMap, p: Pos): NpcDef | undefined {
  return map.def.npcs.find((n) => n.x === p.x && n.y === p.y);
}

/** Begehbar = innerhalb der Karte, nicht fest und kein NPC steht dort. */
export function isWalkable(map: VillageMap, p: Pos): boolean {
  const tile = tileAt(map, p);
  return !!tile && !tile.solid && !npcAt(map, p);
}

/** Was passiert, wenn man das Feld anspricht oder untersucht. */
export function interactionAt(map: VillageMap, p: Pos): Interaction | null {
  const npc = npcAt(map, p);
  if (npc) return { kind: 'npc', npc };
  const tile = tileAt(map, p);
  if (!tile) return null;
  if (tile.board) return { kind: 'board' };
  const special = map.def.examine.find((e) => e.x === p.x && e.y === p.y);
  if (special) return { kind: 'examine', text: special.text };
  return tile.examine ? { kind: 'examine', text: tile.examine } : null;
}

/** Felder, von denen aus man ein Ziel ansprechen kann (die begehbaren Nachbarn). */
export function approachTiles(map: VillageMap, p: Pos): Pos[] {
  return (['up', 'down', 'left', 'right'] as Dir[]).map((d) => step(p, d)).filter((n) => isWalkable(map, n));
}

export function questStatus(log: QuestLog, id: string): QuestStatus | 'open' {
  return log[id] ?? 'open';
}

/** i18n-Schlüssel der Sätze, die ein NPC gerade sagt. */
export function pickDialog(npc: NpcDef, log: QuestLog): string {
  const rule = npc.dialogs.find((r) => !r.when || questStatus(log, r.when.quest) === r.when.status);
  if (!rule) throw new Error(`NPC ${npc.id} hat keinen passenden Dialog`);
  return rule.lines;
}

/** Nimmt einen Auftrag an (bereits angenommene oder erledigte bleiben unverändert). */
export function acceptQuest(log: QuestLog, id: string): QuestLog {
  return log[id] ? log : { ...log, [id]: 'accepted' };
}
