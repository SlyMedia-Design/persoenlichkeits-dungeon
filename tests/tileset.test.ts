import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tilesetJson from '../data/tileset.json';
import villageJson from '../data/village.json';
import { autotileOffset, type Neighbors } from '../src/core/autotile';
import type { Pos } from '../src/core/grid';
import { planTrees, type TilesetDef } from '../src/core/tileset';
import { parseVillage, tileAt, type VillageDef } from '../src/core/village';

const tileset = tilesetJson as unknown as TilesetDef;
const map = parseVillage(villageJson as unknown as VillageDef);
const all: Neighbors = { n: true, e: true, s: true, w: true, ne: true, nw: true, se: true, sw: true };

describe('Autotile', () => {
  it('wählt Mitte, Kanten und Ecken des 3×3-Blocks', () => {
    expect(autotileOffset(all)).toEqual({ x: 1, y: 1 });
    expect(autotileOffset({ ...all, n: false })).toEqual({ x: 1, y: 0 });
    expect(autotileOffset({ ...all, n: false, w: false })).toEqual({ x: 0, y: 0 });
    expect(autotileOffset({ ...all, s: false, e: false })).toEqual({ x: 2, y: 2 });
  });

  it('wählt Streifen und Einzelfeld', () => {
    expect(autotileOffset({ ...all, w: false, e: false })).toEqual({ x: 3, y: 1 });
    expect(autotileOffset({ ...all, w: false, e: false, n: false })).toEqual({ x: 3, y: 0 });
    expect(autotileOffset({ ...all, n: false, s: false, e: false })).toEqual({ x: 2, y: 3 });
    expect(autotileOffset({ ...all, n: false, s: false, w: false, e: false })).toEqual({ x: 3, y: 3 });
  });

  it('nutzt Innenecken nur, wenn erlaubt', () => {
    expect(autotileOffset({ ...all, nw: false })).toEqual({ x: 6, y: 2 });
    expect(autotileOffset({ ...all, se: false })).toEqual({ x: 5, y: 1 });
    expect(autotileOffset({ ...all, nw: false }, false)).toEqual({ x: 1, y: 1 });
  });
});

describe('Baumplanung', () => {
  it('füllt Flächen mit großen Bäumen und Lücken mit Büschen', () => {
    const trees = new Set(['1,1', '2,1', '1,2', '2,2', '4,4']);
    const { big, small } = planTrees((p: Pos) => trees.has(`${p.x},${p.y}`), { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(big).toEqual([{ x: 1, y: 1 }]);
    expect(small).toEqual([{ x: 4, y: 4 }]);
  });
});

describe('Grafikzuordnung', () => {
  it('alle Bilddateien liegen in public/', () => {
    const paths = [
      ...Object.values(tileset.sheets),
      ...Object.values(tileset.actors).flatMap((a) => (a.face ? [a.sheet, a.face] : [a.sheet])),
      ...Object.values(tileset.items),
      ...Object.values(tileset.fx).map((f) => f.sheet),
    ];
    for (const p of paths) expect(existsSync(resolve(import.meta.dirname, '../public', p)), p).toBe(true);
  });

  it('alle Gegenstände und Böden der Karte haben eine Grafik', () => {
    for (const tile of Object.values(map.def.legend)) {
      if (tile.ground !== 'grass') expect(tileset.autotiles[tile.ground], tile.ground).toBeDefined();
      if (tile.object && !['tree', 'building'].includes(tile.object)) expect(tileset.objects[tile.object], tile.object).toBeDefined();
    }
    for (const npc of map.def.npcs) expect(tileset.actors[npc.sprite], npc.sprite).toBeDefined();
  });

  it('Häuser liegen genau auf ihren H/D-Feldern, die Tür auf einem D', () => {
    let houseCells = 0;
    map.chars.forEach((row) => (houseCells += [...row].filter((c) => c === 'H' || c === 'D').length));
    let covered = 0;
    for (const b of map.def.buildings) {
      const style = tileset.buildings[b.style];
      expect(style, b.style).toBeDefined();
      for (let dy = 0; dy < style.h; dy++) {
        for (let dx = 0; dx < style.w; dx++) {
          const ch = map.chars[b.y + dy]?.[b.x + dx];
          const isDoor = dx === style.door.x && dy === style.door.y;
          expect(ch, `${b.style} ${dx},${dy}`).toBe(isDoor ? 'D' : 'H');
          covered++;
        }
      }
      expect(tileAt(map, { x: b.x + style.door.x, y: b.y + style.door.y + 1 })?.solid).toBeFalsy();
    }
    expect(covered).toBe(houseCells);
  });
});
