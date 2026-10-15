import type { DungeonState } from './dungeon/types';
import type { Pos } from './grid';
import { DIMENSIONS, type Answers, type Profile, type ScoreResult } from './types';
import type { Placement, QuestLog } from './village';

export const SAVE_KEY = 'persoenlichkeits-dungeon.save';
/** 1 = Test mit 50 Fragen, 2 = Mini-IPIP mit 20 Fragen */
export const SAVE_VERSION = 2;

/** Stufe, Erfahrung und aktive Fähigkeiten eines Team-Mitglieds zwischen den Ausflügen */
export interface TeamProgress {
  level: number;
  xp: number;
  /** Fehlt bei älteren Spielständen: dann gelten die Fähigkeiten der Stufe */
  moves?: string[];
}

export interface SaveData {
  version: number;
  /** Antworten, auch während der Test noch läuft */
  answers: Answers;
  /** Index der aktuellen Frage */
  current: number;
  result?: ScoreResult;
  archetypeId?: string;
  partnerId?: string;
  playerName?: string;
  partnerName?: string;
  completedAt?: string;
  /** Dorf (Meilenstein 2): Positionen von Spieler und Partner */
  village?: { player: Placement; partner: Pos };
  /** Stand der Aufträge vom Schwarzen Brett */
  quests?: QuestLog;
  /** Begrüßung beim ersten Betreten des Dorfs schon gesehen */
  villageIntroSeen?: boolean;
  /** Meilenstein 3: Stufe und Erfahrung von Spieler und Partner */
  team?: { player: TeamProgress; partner: TeamProgress };
  /** Beutel zwischen den Ausflügen */
  bag?: string[];
  /** Laufender Dungeon-Durchgang (wird nach jedem Zug gesichert) */
  dungeon?: DungeonState;
  /** Der Waldgeist wurde besänftigt */
  dungeonCleared?: boolean;
}

/** Minimale Schnittstelle, damit localStorage in Tests ersetzt werden kann. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function newSave(): SaveData {
  return { version: SAVE_VERSION, answers: {}, current: 0 };
}

function isSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SaveData>;
  return typeof v.version === 'number' && typeof v.answers === 'object' && v.answers !== null && typeof v.current === 'number';
}

/**
 * Bringt ältere Spielstände auf den aktuellen Stand.
 * Version 1 (50 Fragen): Ein fertiges Ergebnis bleibt erhalten; ein halb ausgefüllter
 * Test wird verworfen, weil die Fragenposition nicht zur Kurzform passt.
 */
export function migrateSave(data: SaveData): SaveData | null {
  if (data.version === SAVE_VERSION) return renameMoves(data);
  if (data.version === 1 && data.result && data.archetypeId) return renameMoves({ ...data, version: SAVE_VERSION });
  return null;
}

/** Umbenannte Fähigkeiten (15.10.2026: der Dachs ist jetzt Glut) */
const RENAMED_MOVES: Record<string, string> = { steinkralle: 'glutkralle', erzpanzer: 'glutpanzer', erdstoss: 'glutstoss' };

/** Ein laufender Dungeon kann noch alte Fähigkeiten enthalten. */
function renameMoves(data: SaveData): SaveData {
  if (!data.dungeon) return data;
  for (const unit of data.dungeon.units) {
    for (const slot of unit.moves) slot.id = RENAMED_MOVES[slot.id] ?? slot.id;
  }
  return data;
}

/** Lädt den Spielstand. Kaputte oder fremde Daten und blockierter Speicher ergeben null. */
export function loadSave(storage: StorageLike | undefined): SaveData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSaveData(parsed) ? migrateSave(parsed) : null;
  } catch {
    return null;
  }
}

/** Speichert den Spielstand. Gibt false zurück, wenn der Browser das Speichern verhindert. */
export function writeSave(storage: StorageLike | undefined, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | undefined): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Speicher blockiert: nichts zu löschen
  }
}

/**
 * Text für „Ergebnis teilen“: die fünf Mittelwerte (1–5) für die spätere Norm-Justierung.
 * Enthält bewusst keine Namen und keine Einzelantworten.
 */
export function shareText(means: Profile, labels: Record<keyof Profile, string>, header: string): string {
  const parts = DIMENSIONS.map((d) => `${labels[d]} ${means[d].toFixed(2)}`);
  return `${header}\n${parts.join(' | ')}\nMini-IPIP (1–5), v${SAVE_VERSION}`;
}
