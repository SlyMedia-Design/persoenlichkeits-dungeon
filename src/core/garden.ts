/**
 * Oma Wurzels Beerenfeld, ohne Phaser: Beete bepflanzen, nach jedem Dungeon-Ausflug wachsen lassen
 * und reife Beeren in den Beutel ernten.
 */
import type { Pos } from './grid';
import type { QuestLog, QuestStatus } from './village';

export interface GardenDef {
  /** Felder der Beete auf der Dorfkarte (in der Karte fest, Zeichen mit plot: true) */
  plots: Pos[];
  /** Nach so vielen Ausflügen sind die Pflanzen reif */
  growRuns: number;
  /** Beeren pro reifer Pflanze */
  harvest: number;
  /** Was man pflanzen kann (Gegenstände aus data/dungeon.json); die Samen gibt Oma Wurzel */
  seeds: string[];
  /** Ab diesem Auftragsstand gehört das Feld dem Spieler */
  unlock: { quest: string; status: QuestStatus };
}

export interface Plot {
  berry: string;
  /** Ausflüge seit dem Pflanzen (höchstens growRuns) */
  runs: number;
  /** Beeren, die bei der Ernte nicht mehr in den Beutel gepasst haben */
  left?: number;
}

/** Ein Eintrag je Beet; null = leer */
export type Garden = (Plot | null)[];

export function emptyGarden(def: GardenDef): Garden {
  return def.plots.map(() => null);
}

/** Älterer oder fehlender Spielstand: auf die Zahl der Beete bringen */
export function normalizeGarden(def: GardenDef, garden: Garden | undefined): Garden {
  return def.plots.map((_, i) => garden?.[i] ?? null);
}

export function gardenUnlocked(def: GardenDef, log: QuestLog): boolean {
  return log[def.unlock.quest] === def.unlock.status;
}

export function plotIndexAt(def: GardenDef, p: Pos): number {
  return def.plots.findIndex((q) => q.x === p.x && q.y === p.y);
}

export function plant(def: GardenDef, garden: Garden, index: number, berry: string): Garden {
  if (garden[index] || !def.seeds.includes(berry)) return garden;
  return garden.map((p, i) => (i === index ? { berry, runs: 0 } : p));
}

/** Nach einem Ausflug (egal wie er ausging) wächst jede Pflanze eine Stufe */
export function growAfterRun(def: GardenDef, garden: Garden): Garden {
  return garden.map((p) => (p ? { ...p, runs: Math.min(def.growRuns, p.runs + 1) } : null));
}

export function isRipe(def: GardenDef, plot: Plot | null): boolean {
  return !!plot && plot.runs >= def.growRuns;
}

/** Noch fehlende Ausflüge bis zur Ernte */
export function runsLeft(def: GardenDef, plot: Plot): number {
  return Math.max(0, def.growRuns - plot.runs);
}

export interface HarvestResult {
  garden: Garden;
  bag: string[];
  picked: number;
  /** Bleiben an der Pflanze, bis wieder Platz im Beutel ist */
  left: number;
}

/** Reife Beeren pflücken, so viele in den Beutel passen; der Rest bleibt an der Pflanze. */
export function harvest(def: GardenDef, garden: Garden, index: number, bag: string[], bagSize: number): HarvestResult {
  const plot = garden[index];
  if (!plot || !isRipe(def, plot)) return { garden, bag, picked: 0, left: 0 };
  const total = plot.left ?? def.harvest;
  const picked = Math.min(total, Math.max(0, bagSize - bag.length));
  const left = total - picked;
  return {
    garden: garden.map((p, i) => (i === index ? (left > 0 ? { ...plot, left } : null) : p)),
    bag: [...bag, ...Array.from({ length: picked }, () => plot.berry)],
    picked,
    left,
  };
}
