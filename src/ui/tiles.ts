import Phaser from 'phaser';
import tilesetJson from '../../data/tileset.json';
import { autotileOffset } from '../core/autotile';
import type { Pos } from '../core/grid';
import { planTrees, type TileRef, type TilesetDef } from '../core/tileset';
import { tileAt, type VillageMap } from '../core/village';

/**
 * Setzt die Dorfkarte aus den Kacheln des Ninja Adventure Packs zusammen (Zuordnung in data/tileset.json).
 * Die ganze Karte samt Waldrand wird einmal in eine einzige Textur gemalt.
 */
export const TILE = 16;
/** Waldrand um die Karte (in Feldern), damit die Figuren am Rand nicht hinter dem Dialog verschwinden */
export const BORDER = 4;

export const tileset = tilesetJson as unknown as TilesetDef;

const sheetKey = (name: string) => `tiles-${name}`;
export const actorKey = (id: string) => `actor-${id}`;
export const faceKey = (id: string) => `face-${id}`;

/** Lädt alle Kachelbilder und Figuren (nur, was noch nicht geladen ist). */
export function preloadTileset(scene: Phaser.Scene) {
  const base = import.meta.env.BASE_URL;
  for (const [name, path] of Object.entries(tileset.sheets)) {
    if (!scene.textures.exists(sheetKey(name))) scene.load.image(sheetKey(name), base + path);
  }
  for (const [id, actor] of Object.entries(tileset.actors)) {
    if (!scene.textures.exists(actorKey(id))) scene.load.spritesheet(actorKey(id), base + actor.sheet, { frameWidth: TILE, frameHeight: TILE });
    if (!scene.textures.exists(faceKey(id))) scene.load.image(faceKey(id), base + actor.face);
  }
}

/** Bildnummer einer Figur im Spritesheet: Spalten = Blickrichtung, Zeilen = Laufbilder */
export function actorFrame(facing: 'down' | 'up' | 'left' | 'right', step = 0): number {
  return step * 4 + ['down', 'up', 'left', 'right'].indexOf(facing);
}

/** Deterministisches Rauschen je Feld, damit die Karte bei jedem Laden gleich aussieht */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick<T>(list: T[], x: number, y: number, salt: number): T {
  return list[Math.floor(hash(x, y, salt) * list.length)];
}

export function villageMapTexture(scene: Phaser.Scene, map: VillageMap): string {
  const key = 'village-map';
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, (map.width + 2 * BORDER) * TILE, (map.height + 2 * BORDER) * TILE);
  if (!canvas) throw new Error('Dorfkarte konnte nicht erstellt werden');
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;

  /** Kachel(n) aus einem Tileset an ein Kartenfeld kopieren (Kartenkoordinaten, auch außerhalb) */
  const blit = (ref: TileRef, at: Pos, offset: Pos = { x: 0, y: 0 }) => {
    const img = scene.textures.get(sheetKey(ref.sheet)).getSourceImage() as CanvasImageSource;
    const w = (ref.w ?? 1) * TILE;
    const h = (ref.h ?? 1) * TILE;
    ctx.drawImage(img, (ref.x + offset.x) * TILE, (ref.y + offset.y) * TILE, w, h, (at.x + BORDER) * TILE, (at.y + BORDER) * TILE, w, h);
  };

  const from = { x: -BORDER, y: -BORDER };
  const to = { x: map.width + BORDER - 1, y: map.height + BORDER - 1 };
  const isTree = (p: Pos) => {
    const tile = tileAt(map, p);
    return !tile || tile.object === 'tree';
  };

  // 1. Boden: überall Gras, darauf Wege und Wasser mit passenden Rändern
  for (let y = from.y; y <= to.y; y++) {
    for (let x = from.x; x <= to.x; x++) {
      const r = hash(x, y, 1);
      blit(r < 0.18 ? pick(tileset.grass.variants, x, y, 2) : tileset.grass.base, { x, y });
      const tile = tileAt(map, { x, y });
      const auto = tile && tileset.autotiles[tile.ground];
      if (auto) {
        const same = (dx: number, dy: number) => tileAt(map, { x: x + dx, y: y + dy })?.ground === tile.ground;
        const nb = {
          n: same(0, -1),
          s: same(0, 1),
          w: same(-1, 0),
          e: same(1, 0),
          nw: same(-1, -1),
          ne: same(1, -1),
          sw: same(-1, 1),
          se: same(1, 1),
        };
        blit(auto, { x, y }, autotileOffset(nb, auto.innerCorners));
      } else if (tile && !tile.object && r > 0.93) {
        blit(pick(tileset.grass.details, x, y, 3), { x, y });
      }
    }
  }

  // 2. Gegenstände auf einzelnen Feldern
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const object = tileAt(map, { x, y })?.object;
      const refs = object && tileset.objects[object];
      if (refs) blit(pick(refs, x, y, 4), { x, y });
    }
  }

  // 3. Häuser
  for (const b of map.def.buildings) blit(tileset.buildings[b.style], b);

  // 4. Bäume: große Bäume auf zusammenhängenden Flächen, sonst Büsche
  const trees = planTrees(isTree, from, to);
  for (const p of trees.small) blit(pick(tileset.objects.bush, p.x, p.y, 5), p);
  for (const p of trees.big) blit(pick(tileset.trees, p.x, p.y, 6), p);

  canvas.refresh();
  return key;
}
