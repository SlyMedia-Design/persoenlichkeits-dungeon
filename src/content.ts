// Bündelt alle JSON-Inhalte an einer Stelle, damit Szenen nicht direkt Dateien importieren.
import archetypesJson from '../data/archetypes.json';
import de from '../data/i18n/de.json';
import bankJson from '../data/ipip50_de.json';
import shortFormJson from '../data/mini_ipip20.json';
import normsJson from '../data/norms.json';
import villageJson from '../data/village.json';
import battleJson from '../data/battle.json';
import bonusesJson from '../data/bonuses.json';
import dungeonJson from '../data/dungeon.json';
import elementsJson from '../data/elements.json';
import movesJson from '../data/moves.json';
import type { BonusDef } from './core/dungeon/stats';
import type { Content } from './core/dungeon/types';
import type { ElementChart } from './core/elements';
import { createTranslator, type Dictionary } from './core/i18n';
import type { CreatureElements } from './core/matching';
import { selectItems } from './core/scoring';
import type { Archetype, ItemBank, Norms, PixelSprite } from './core/types';
import { parseVillage, type VillageDef } from './core/village';

/** Im Spiel gestellte Fragen: Mini-IPIP (20 Items aus der IPIP-50) */
export const bank = selectItems(bankJson as ItemBank, shortFormJson.itemIds);
export const norms = normsJson as unknown as Norms;
export const archetypes = archetypesJson.archetypes as unknown as Archetype[];
export const t = createTranslator(de as Dictionary);
export const village = parseVillage(villageJson as unknown as VillageDef);
export const dungeonContent = { dungeon: dungeonJson, battle: battleJson, moves: movesJson, elements: elementsJson } as unknown as Content;
/** Elemente der spielbaren Wesen (aus den Kampfwerten) samt Typentabelle */
export const creatureElements: CreatureElements = {
  chart: elementsJson as unknown as ElementChart,
  of: Object.fromEntries(Object.entries(dungeonContent.battle.team).map(([id, def]) => [id, def.element])),
};
/** Aussehen der Elemente: 16×16-Icon und Textfarbe */
export const elementLooks = elementsJson as unknown as {
  icons: Record<string, PixelSprite>;
  colors: Record<string, string>;
  /** Fähigkeitsstein: eine Form, eine Palette je Element */
  stone: { rows: string[]; palettes: Record<string, Record<string, string>> };
};
export const bonusDefs = bonusesJson as unknown as Record<string, BonusDef>;

export function archetypeById(id: string): Archetype {
  const a = archetypes.find((x) => x.id === id);
  if (!a) throw new Error(`Unbekanntes Wesen: ${id}`);
  return a;
}

/** Texte eines Wesens, z. B. creatureText('otter', 'species') */
export function creatureText(id: string, key: 'species' | 'article' | 'tagline' | 'description'): string {
  return t(`creatures.${id}.${key}`);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Setzt die Namen von Spieler und Partner in einen Text ein. */
export function withNames(text: string, names: { player?: string; partner?: string }): string {
  return text.replace(/\{player\}/g, names.player ?? '').replace(/\{partner\}/g, names.partner ?? '');
}
