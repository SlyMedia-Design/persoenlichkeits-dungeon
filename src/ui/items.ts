import { dungeonContent, t } from '../content';
import { parseBagEntry } from '../core/dungeon/stats';

/** Name eines Beutel-Eintrags; Fähigkeitssteine mit ihrer Fähigkeit („Glutstein: Glutkralle“) */
export function bagEntryName(entry: string): string {
  const { item, move } = parseBagEntry(entry);
  const name = t(`dungeon.items.${item}.name`);
  return move ? t('dungeon.ui.stoneName', { stone: name, move: t(`moves.${move}.name`) }) : name;
}

/** Beschreibung eines Beutel-Eintrags */
export function bagEntryInfo(entry: string): string {
  const { item, move } = parseBagEntry(entry);
  return t(`dungeon.items.${item}.info`, move ? { move: t(`moves.${move}.name`) } : undefined);
}

/** Gegenstandsdaten zu einem Beutel-Eintrag */
export function bagEntryDef(entry: string) {
  return dungeonContent.dungeon.items[parseBagEntry(entry).item];
}
