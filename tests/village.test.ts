import { describe, expect, it } from 'vitest';
import de from '../data/i18n/de.json';
import villageJson from '../data/village.json';
import { createTranslator, type Dictionary } from '../src/core/i18n';
import { canStep, combineDirs, dirTo, findPath, step, type Pos } from '../src/core/grid';
import {
  acceptQuest,
  approachTiles,
  completeQuest,
  interactionAt,
  isWalkable,
  parseVillage,
  pickDialog,
  questMarker,
  type NpcDef,
  type VillageDef,
} from '../src/core/village';

const def = villageJson as unknown as VillageDef;
const map = parseVillage(def);
const t = createTranslator(de as Dictionary);
const walkable = (p: Pos) => isWalkable(map, p);

describe('Wegsuche', () => {
  const open = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < 5 && p.y < 5 && !(p.x === 2 && p.y < 4);

  it('findet den kürzesten Weg um ein Hindernis herum, auch schräg', () => {
    const path = findPath({ x: 0, y: 0 }, [{ x: 4, y: 0 }], open)!;
    // gerade wären es 12 Schritte; schräg 10, weil man an der Mauerecke nicht schräg vorbeikommt
    expect(path).toHaveLength(10);
    let p = { x: 0, y: 0 };
    for (const d of path) {
      expect(canStep(p, d, open)).toBe(true);
      p = step(p, d);
    }
    expect(p).toEqual({ x: 4, y: 0 });
  });

  it('schneidet keine Ecken', () => {
    expect(canStep({ x: 1, y: 3 }, 'down-right', open)).toBe(false);
    expect(canStep({ x: 1, y: 3 }, 'down-left', open)).toBe(true);
  });

  it('zwei Tasten ergeben eine Schrägrichtung', () => {
    expect(combineDirs('up', 'left')).toBe('up-left');
    expect(combineDirs(undefined, 'right')).toBe('right');
    expect(combineDirs(undefined, undefined)).toBeUndefined();
  });

  it('gibt [] zurück, wenn man schon am Ziel ist, und null ohne Weg', () => {
    expect(findPath({ x: 0, y: 0 }, [{ x: 0, y: 0 }], open)).toEqual([]);
    expect(findPath({ x: 0, y: 0 }, [{ x: 9, y: 9 }], open)).toBeNull();
  });

  it('dirTo erkennt nur direkte Nachbarn (auch schräg)', () => {
    expect(dirTo({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe('up');
    expect(dirTo({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe('down-right');
    expect(dirTo({ x: 1, y: 1 }, { x: 3, y: 1 })).toBeUndefined();
  });
});

describe('Dorfkarte', () => {
  it('wirft bei ungleich langen Zeilen oder unbekannten Zeichen', () => {
    expect(() => parseVillage({ ...def, map: ['..', '.'] })).toThrow();
    expect(() => parseVillage({ ...def, map: ['.?'] })).toThrow();
  });

  it('Start- und Partnerfeld sind begehbar', () => {
    expect(isWalkable(map, def.spawn)).toBe(true);
    expect(isWalkable(map, def.partnerSpawn)).toBe(true);
  });

  it('alle NPCs, das Brett und alle Untersuchungsfelder sind vom Start aus erreichbar', () => {
    const targets: Pos[] = [...def.npcs, ...def.examine];
    map.chars.forEach((row, y) => [...row].forEach((ch, x) => def.legend[ch].board && targets.push({ x, y })));
    expect(targets.length).toBeGreaterThan(4);
    for (const target of targets) {
      expect(findPath(def.spawn, approachTiles(map, target), walkable), `${target.x},${target.y}`).not.toBeNull();
    }
  });

  it('NPCs blockieren ihr Feld und lassen sich ansprechen', () => {
    for (const npc of def.npcs) {
      expect(isWalkable(map, npc)).toBe(false);
      expect(interactionAt(map, npc)).toMatchObject({ kind: 'npc', npc: { id: npc.id } });
    }
  });

  it('Einzeltexte überschreiben den Standardtext der Legende', () => {
    const door = def.examine[0];
    expect(interactionAt(map, door)).toEqual({ kind: 'examine', text: door.text });
  });

  it('alle Texte der Karte existieren in de.json', () => {
    const keys = [
      ...Object.values(def.legend).flatMap((tile) => (tile.examine ? [tile.examine] : [])),
      ...def.examine.map((e) => e.text),
      ...def.quests.flatMap((q) => ['title', 'text', 'from'].map((k) => `village.quests.${q.id}.${k}`)),
      ...def.npcs.map((n) => `village.npcs.${n.id}.name`),
    ];
    for (const key of keys) expect(t(key), key).not.toBe(`[${key}]`);
    for (const npc of def.npcs) {
      for (const rule of npc.dialogs) expect(t.list(rule.lines)[0], rule.lines).not.toBe(`[${rule.lines}]`);
    }
  });
});

describe('Dialoge und Aufträge', () => {
  const wurzel = def.npcs.find((n) => n.id === 'wurzel')!;

  it('NPCs reagieren auf angenommene Aufträge', () => {
    expect(pickDialog(wurzel, {}).lines).toBe('village.npcs.wurzel.default');
    expect(pickDialog(wurzel, { leuchtmoos: 'accepted' }).lines).toBe('village.npcs.wurzel.questAccepted');
    const ready = pickDialog(wurzel, { leuchtmoos: 'ready' });
    expect(ready.complete).toBe('leuchtmoos');
    expect(completeQuest({ leuchtmoos: 'ready' }, 'leuchtmoos')).toEqual({ leuchtmoos: 'done' });
    expect(completeQuest({ leuchtmoos: 'accepted' }, 'leuchtmoos')).toEqual({ leuchtmoos: 'accepted' });
  });

  it('acceptQuest nimmt an, überschreibt aber keinen erledigten Auftrag', () => {
    expect(acceptQuest({}, 'verirrt')).toEqual({ verirrt: 'accepted' });
    expect(acceptQuest({ verirrt: 'done' }, 'verirrt')).toEqual({ verirrt: 'done' });
  });

  it('NPC-Aufträge: ! bis zur Annahme, ? bei der Abgabe-Stelle, nichts nach der Abgabe', () => {
    const giver: NpcDef = { id: 'a', x: 0, y: 0, facing: 'down', sprite: 'mouse', gives: 'auftrag', dialogs: [{ lines: 'x' }] };
    const taker: NpcDef = { id: 'b', x: 0, y: 0, facing: 'down', sprite: 'mouse', dialogs: [{ when: { quest: 'auftrag', status: 'ready' }, lines: 'y', complete: 'auftrag' }, { lines: 'x' }] };
    const npcs = [giver, taker];
    expect(questMarker(giver, {}, npcs)).toBe('!');
    expect(questMarker(taker, {}, npcs)).toBeNull();
    expect(questMarker(giver, { auftrag: 'accepted' }, npcs)).toBeNull();
    expect(questMarker(giver, { auftrag: 'ready' }, npcs)).toBeNull();
    expect(questMarker(taker, { auftrag: 'ready' }, npcs)).toBe('?');
    expect(questMarker(taker, { auftrag: 'done' }, npcs)).toBeNull();
  });

  it('im Dorf: Paula vergibt „Stups vermisst“ (!), Fips nimmt ihn ab (?)', () => {
    const npc = (id: string) => def.npcs.find((n) => n.id === id)!;
    expect(questMarker(npc('paula'), {}, def.npcs)).toBe('!');
    expect(questMarker(npc('fips'), { verirrt: 'ready' }, def.npcs)).toBe('?');
    expect(pickDialog(npc('paula'), {}).accept).toBe('verirrt');
    expect(pickDialog(npc('fips'), { verirrt: 'ready' }).complete).toBe('verirrt');
  });

  it('Brett-Aufträge bekommen kein Zeichen, nur ein Auftrag hängt am Brett', () => {
    for (const npc of def.npcs) expect(questMarker(npc, { verirrt: 'done', leuchtmoos: 'ready' }, def.npcs)).toBeNull();
    expect(def.quests.filter((q) => q.board).map((q) => q.id)).toEqual(['leuchtmoos']);
    expect(def.npcs.filter((n) => n.gives).map((n) => n.id)).toEqual(['paula']);
  });

  it('5 Dorfbewohner, und Häuser für alle fünf Gebäude', () => {
    expect(def.npcs.map((n) => n.id).sort()).toEqual(['brummbart', 'fips', 'kiesel', 'paula', 'wurzel']);
    expect(def.buildings).toHaveLength(5);
  });
});
