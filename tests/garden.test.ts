import { describe, expect, it } from 'vitest';
import de from '../data/i18n/de.json';
import dungeonJson from '../data/dungeon.json';
import villageJson from '../data/village.json';
import { emptyGarden, gardenUnlocked, growAfterRun, harvest, isRipe, normalizeGarden, plant, runsLeft } from '../src/core/garden';
import { createTranslator, type Dictionary } from '../src/core/i18n';
import { approachTiles, interactionAt, parseVillage, type VillageDef } from '../src/core/village';

const map = parseVillage(villageJson as unknown as VillageDef);
const def = map.def.garden;
const t = createTranslator(de as Dictionary);

describe('Beerenfeld', () => {
  it('jedes Beet liegt auf der Karte und ist von einem begehbaren Feld aus erreichbar', () => {
    def.plots.forEach((p, i) => {
      expect(interactionAt(map, p)).toEqual({ kind: 'plot', index: i });
      expect(approachTiles(map, p).length).toBeGreaterThan(0);
    });
  });

  it('gehört dem Spieler erst nach dem Leuchtmoos-Auftrag', () => {
    expect(gardenUnlocked(def, {})).toBe(false);
    expect(gardenUnlocked(def, { leuchtmoos: 'accepted' })).toBe(false);
    expect(gardenUnlocked(def, { leuchtmoos: 'ready' })).toBe(false);
    expect(gardenUnlocked(def, { leuchtmoos: 'done' })).toBe(true);
  });

  it('nach 4 Ausflügen ist eine Pflanze reif, nicht früher', () => {
    let garden = plant(def, emptyGarden(def), 0, 'heilbeere');
    for (let run = 1; run < 4; run++) {
      garden = growAfterRun(def, garden);
      expect(isRipe(def, garden[0]), `nach ${run} Ausflügen`).toBe(false);
      expect(runsLeft(def, garden[0]!)).toBe(4 - run);
    }
    garden = growAfterRun(def, garden);
    expect(isRipe(def, garden[0])).toBe(true);
    // Weitere Ausflüge ändern nichts mehr
    expect(growAfterRun(def, garden)[0]).toEqual(garden[0]);
  });

  it('pflanzt nur die Beeren von Oma Wurzel und nur in leere Beete', () => {
    const garden = plant(def, emptyGarden(def), 1, 'sternbeere');
    expect(garden[1]).toEqual({ berry: 'sternbeere', runs: 0 });
    expect(plant(def, garden, 1, 'heilbeere')).toBe(garden);
    expect(plant(def, garden, 0, 'wurfstein')).toBe(garden);
  });

  it('die Ernte kommt in den Beutel; was nicht passt, bleibt an der Pflanze', () => {
    let garden = plant(def, emptyGarden(def), 2, 'kraftbeere');
    for (let i = 0; i < def.growRuns; i++) garden = growAfterRun(def, garden);
    const full = harvest(def, garden, 2, Array(11).fill('wurfstein'), 12);
    expect(full.picked).toBe(1);
    expect(full.left).toBe(def.harvest - 1);
    expect(full.bag.filter((i) => i === 'kraftbeere')).toHaveLength(1);
    const rest = harvest(def, full.garden, 2, [], 12);
    expect(rest.picked).toBe(def.harvest - 1);
    expect(rest.garden[2]).toBeNull();
  });

  it('unreife Pflanzen lassen sich nicht ernten', () => {
    const garden = plant(def, emptyGarden(def), 0, 'heilbeere');
    expect(harvest(def, garden, 0, [], 12).picked).toBe(0);
  });

  it('alte Spielstände ohne Beerenfeld bekommen leere Beete', () => {
    expect(normalizeGarden(def, undefined)).toEqual([null, null, null]);
  });

  it('alle Samen sind Gegenstände mit Namen und Infotext', () => {
    const items = dungeonJson.items as Record<string, { use: string }>;
    for (const berry of def.seeds) {
      expect(items[berry], berry).toBeDefined();
      expect(t(`dungeon.items.${berry}.name`)).not.toContain('dungeon.items');
      expect(t(`dungeon.items.${berry}.info`)).not.toContain('dungeon.items');
    }
  });
});
