import { dungeonContent, t } from '../content';
import { parseBagEntry } from '../core/dungeon/stats';

/** Name eines Beutel-Eintrags; Fähigkeitssteine mit ihrer Fähigkeit („Glutstein: Glutkralle“) */
export function bagEntryName(entry: string): string {
  const { item, move } = parseBagEntry(entry);
  const name = t(`dungeon.items.${item}.name`);
  return move ? t('dungeon.ui.stoneName', { stone: name, move: t(`moves.${move}.name`) }) : name;
}

/**
 * Beschreibung eines Beutel-Eintrags mit der genauen Wirkung (Heilung, Energie, Schaden).
 * healing = Heilungs-Bonus aus dem Profil (Verträglichkeit), wie er im Dungeon wirkt.
 */
export function bagEntryInfo(entry: string, healing = 0): string {
  const { item, move } = parseBagEntry(entry);
  const def = dungeonContent.dungeon.items[item];
  const amount = def.use === 'heal' ? Math.round((def.amount ?? 0) * (1 + healing)) : (def.amount ?? 0);
  return t(`dungeon.items.${item}.info`, { amount, range: def.range ?? 0, move: move ? t(`moves.${move}.name`) : '' });
}

/** Gegenstandsdaten zu einem Beutel-Eintrag */
export function bagEntryDef(entry: string) {
  return dungeonContent.dungeon.items[parseBagEntry(entry).item];
}

/** Gleiche Einträge zusammenfassen: Eintrag → Plätze im Beutel */
export function groupEntries(entries: string[]): Map<string, number[]> {
  const counts = new Map<string, number[]>();
  entries.forEach((entry, i) => counts.set(entry, [...(counts.get(entry) ?? []), i]));
  return counts;
}
