/** Auswertung nach einem Durchgang: was ins Dorf mitgenommen wird. */
import type { QuestLog } from '../village';
import type { TeamMember } from './engine';
import type { Content, DungeonState } from './types';

export interface RunResult {
  team: { player: Omit<TeamMember, 'species'>; partner: Omit<TeamMember, 'species'> };
  bag: string[];
  quests: QuestLog;
  cleared: boolean;
  /** Leuchtmoos im Beutel (falls der Auftrag noch läuft) */
  moss: number;
}

/**
 * Stufen und Erfahrung bleiben immer erhalten (auch nach einer Niederlage).
 * Stups gilt als gerettet, sobald er die Treppe erreicht hat. Leuchtmoos sammelt sich im Beutel,
 * bis genug für Oma Wurzel beisammen ist.
 */
export function settleRun(content: Content, state: DungeonState, quests: QuestLog): RunResult {
  const member = (id: string) => {
    const u = state.units.find((x) => x.id === id)!;
    return { level: u.level, xp: u.xp };
  };
  const next: QuestLog = { ...quests };
  let bag = [...state.bag];
  if (state.escort === 'rescued' && next.verirrt === 'accepted') next.verirrt = 'ready';
  const { item, needed } = content.dungeon.quests.leuchtmoos;
  let moss = bag.filter((i) => i === item).length;
  if (next.leuchtmoos === 'accepted' && moss >= needed) {
    let removed = 0;
    bag = bag.filter((i) => !(i === item && removed++ < needed));
    next.leuchtmoos = 'ready';
    moss = 0;
  }
  return {
    team: { player: member('player'), partner: member('partner') },
    bag,
    quests: next,
    cleared: state.outcome === 'cleared',
    moss: next.leuchtmoos === 'accepted' ? moss : 0,
  };
}
