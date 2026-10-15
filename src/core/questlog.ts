/** Questlog: angenommene Aufträge mit dem nächsten Schritt (Texte in data/i18n/de.json unter village.quests.<id>.log). */
import type { EscortState } from './dungeon/types';
import { questStatus, type QuestLog, type QuestStatus } from './village';

export interface QuestProgress {
  /** Leuchtmoos in der Quest-Tasche */
  moss: number;
  mossNeeded: number;
  /** Stand von Stups im laufenden Dungeon (fehlt im Dorf) */
  escort?: EscortState;
}

export interface QuestLogEntry {
  id: string;
  status: QuestStatus;
  /** i18n-Schlüssel des nächsten Schritts */
  step: string;
  vars: Record<string, number>;
}

/** Angenommene und erfüllte Aufträge zuerst, erledigte danach; offene (nicht angenommene) fehlen. */
export function questLogEntries(quests: readonly { id: string }[], log: QuestLog, progress: QuestProgress): QuestLogEntry[] {
  const entries: QuestLogEntry[] = [];
  for (const { id } of quests) {
    const status = questStatus(log, id);
    if (status === 'open') continue;
    let variant: string = status;
    let vars: Record<string, number> = {};
    if (status === 'accepted' && id === 'verirrt' && (progress.escort === 'following' || progress.escort === 'rescued')) variant = progress.escort;
    if (status === 'accepted' && id === 'leuchtmoos') vars = { n: Math.min(progress.moss, progress.mossNeeded), needed: progress.mossNeeded };
    entries.push({ id, status, step: `village.quests.${id}.log.${variant}`, vars });
  }
  const order = (s: QuestStatus) => (s === 'done' ? 1 : 0);
  return entries.sort((a, b) => order(a.status) - order(b.status));
}
