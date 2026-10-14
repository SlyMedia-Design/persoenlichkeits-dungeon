import Phaser from 'phaser';
import type { Pos } from '../core/grid';
import { tileAt, type VillageMap } from '../core/village';

/**
 * Platzhalter-Kacheln (16×16), per Code gezeichnet, bis das Ninja Adventure Pack eingebunden ist.
 * Die ganze Dorfkarte wird einmal in eine einzige Textur gemalt.
 */
export const TILE = 16;

type Ctx = CanvasRenderingContext2D;

const C = {
  grass: '#a8d58a',
  grassDark: '#8fc274',
  grassLight: '#c4e6a3',
  path: '#ead3a2',
  pathDark: '#d6b985',
  pathPebble: '#c7a675',
  water: '#7cc4e0',
  waterDeep: '#64aed0',
  waterLight: '#c4ecf7',
  shore: '#5e9bb8',
  leaf: '#5f9f5b',
  leafDark: '#467d47',
  leafLight: '#86c06f',
  trunk: '#8a5a3c',
  outline: '#33402f',
  wall: '#f4e4c4',
  wallDark: '#d9c39c',
  timber: '#a9825a',
  wood: '#a87650',
  woodDark: '#7a5236',
  woodLight: '#c9965f',
  glass: '#ffe9a8',
  paper: '#fff8e2',
  stone: '#b1aec0',
  stoneDark: '#87849a',
  flowers: ['#f49ab4', '#ffe27a', '#ffffff', '#c7a6ec'],
};

/** Zwei Dachfarben, damit die Häuser unterscheidbar sind */
const ROOFS = [
  { base: '#d98a7a', dark: '#b4675d', light: '#efae98' },
  { base: '#7fa3cf', dark: '#5f80ad', light: '#a9c4e6' },
];

/** Deterministisches Rauschen je Feld, damit die Karte bei jedem Laden gleich aussieht */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function villageMapTexture(scene: Phaser.Scene, map: VillageMap): string {
  const key = 'village-map';
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, map.width * TILE, map.height * TILE);
  if (!canvas) throw new Error('Dorfkarte konnte nicht erstellt werden');
  const ctx = canvas.getContext();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) drawGround(ctx, map, { x, y });
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) drawObject(ctx, map, { x, y });
  }
  canvas.refresh();
  return key;
}

/** Wald rund um das Dorf (eine Kachel, wird wiederholt) */
export function forestTexture(scene: Phaser.Scene): string {
  const key = 'forest';
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, TILE, TILE);
  if (!canvas) throw new Error('Waldtextur konnte nicht erstellt werden');
  const ctx = canvas.getContext();
  rect(ctx, 0, 0, TILE, TILE, C.grassDark);
  drawTree(ctx, 0, 0, 0);
  canvas.refresh();
  return key;
}

function same(map: VillageMap, p: Pos, field: 'ground' | 'object', value: string): boolean {
  const tile = tileAt(map, p);
  // Außerhalb der Karte zählt als gleich, damit am Rand keine Kanten entstehen
  return !tile || tile[field] === value;
}

function drawGround(ctx: Ctx, map: VillageMap, p: Pos) {
  const tile = tileAt(map, p)!;
  const ox = p.x * TILE;
  const oy = p.y * TILE;
  const up = { x: p.x, y: p.y - 1 };
  const down = { x: p.x, y: p.y + 1 };
  const left = { x: p.x - 1, y: p.y };
  const right = { x: p.x + 1, y: p.y };

  if (tile.ground === 'grass') {
    rect(ctx, ox, oy, TILE, TILE, C.grass);
    for (let i = 0; i < 5; i++) {
      const gx = ox + Math.floor(hash(p.x, p.y, i) * 14) + 1;
      const gy = oy + Math.floor(hash(p.x, p.y, i + 9) * 13) + 2;
      rect(ctx, gx, gy, 1, 2, C.grassDark);
      if (i % 2 === 0) rect(ctx, gx + 1, gy - 1, 1, 1, C.grassLight);
    }
  } else if (tile.ground === 'path') {
    rect(ctx, ox, oy, TILE, TILE, C.path);
    for (let i = 0; i < 3; i++) {
      const px = ox + Math.floor(hash(p.x, p.y, i + 20) * 13) + 1;
      const py = oy + Math.floor(hash(p.x, p.y, i + 30) * 13) + 1;
      rect(ctx, px, py, 2, 1, C.pathPebble);
    }
    // Weiche Ränder zum Gras
    if (!same(map, up, 'ground', 'path')) rect(ctx, ox, oy, TILE, 1, C.pathDark);
    if (!same(map, down, 'ground', 'path')) rect(ctx, ox, oy + TILE - 1, TILE, 1, C.pathDark);
    if (!same(map, left, 'ground', 'path')) rect(ctx, ox, oy, 1, TILE, C.pathDark);
    if (!same(map, right, 'ground', 'path')) rect(ctx, ox + TILE - 1, oy, 1, TILE, C.pathDark);
  } else if (tile.ground === 'water') {
    rect(ctx, ox, oy, TILE, TILE, C.water);
    rect(ctx, ox + 2, oy + 5, TILE - 4, 7, C.waterDeep);
    const wx = ox + 2 + Math.floor(hash(p.x, p.y, 40) * 8);
    rect(ctx, wx, oy + 3 + Math.floor(hash(p.x, p.y, 41) * 9), 4, 1, C.waterLight);
    if (!same(map, up, 'ground', 'water')) {
      rect(ctx, ox, oy, TILE, 2, C.shore);
      rect(ctx, ox, oy + 2, TILE, 1, C.waterLight);
    }
    if (!same(map, down, 'ground', 'water')) rect(ctx, ox, oy + TILE - 2, TILE, 2, C.waterLight);
    if (!same(map, left, 'ground', 'water')) rect(ctx, ox, oy, 2, TILE, C.shore);
    if (!same(map, right, 'ground', 'water')) rect(ctx, ox + TILE - 2, oy, 2, TILE, C.shore);
  }
}

function drawObject(ctx: Ctx, map: VillageMap, p: Pos) {
  const tile = tileAt(map, p)!;
  const ox = p.x * TILE;
  const oy = p.y * TILE;
  switch (tile.object) {
    case 'flowers':
      for (let i = 0; i < 4; i++) {
        const fx = ox + 2 + Math.floor(hash(p.x, p.y, i + 50) * 11);
        const fy = oy + 2 + Math.floor(hash(p.x, p.y, i + 60) * 11);
        const color = C.flowers[Math.floor(hash(p.x, p.y, i + 70) * C.flowers.length)];
        rect(ctx, fx, fy, 2, 2, color);
        rect(ctx, fx, fy + 2, 1, 1, C.grassDark);
      }
      break;
    case 'tree':
      drawTree(ctx, ox, oy, hash(p.x, p.y, 80));
      break;
    case 'roof':
      drawRoof(ctx, map, p, ox, oy);
      break;
    case 'wall':
    case 'window':
    case 'door':
      drawWall(ctx, map, p, ox, oy, tile.object);
      break;
    case 'fence':
      drawFence(ctx, map, p, ox, oy);
      break;
    case 'board':
      rect(ctx, ox + 3, oy + 9, 2, 7, C.woodDark);
      rect(ctx, ox + 11, oy + 9, 2, 7, C.woodDark);
      rect(ctx, ox + 1, oy + 1, 14, 10, C.outline);
      rect(ctx, ox + 2, oy + 2, 12, 8, C.wood);
      rect(ctx, ox + 2, oy + 2, 12, 1, C.woodLight);
      rect(ctx, ox + 3, oy + 3, 4, 5, C.paper);
      rect(ctx, ox + 8, oy + 4, 5, 4, C.paper);
      rect(ctx, ox + 4, oy + 4, 2, 1, C.timber);
      rect(ctx, ox + 9, oy + 5, 3, 1, C.timber);
      rect(ctx, ox + 5, oy + 3, 1, 1, '#e05a5a');
      break;
    case 'sign':
      rect(ctx, ox + 7, oy + 8, 2, 8, C.woodDark);
      rect(ctx, ox + 2, oy + 3, 12, 6, C.outline);
      rect(ctx, ox + 3, oy + 4, 10, 4, C.woodLight);
      rect(ctx, ox + 4, oy + 5, 6, 1, C.woodDark);
      rect(ctx, ox + 10, oy + 5, 2, 2, C.woodDark);
      break;
    case 'well':
      rect(ctx, ox + 2, oy + 4, 12, 11, C.stoneDark);
      rect(ctx, ox + 3, oy + 4, 10, 9, C.stone);
      rect(ctx, ox + 5, oy + 6, 6, 4, '#3d5f7a');
      rect(ctx, ox + 6, oy + 7, 2, 1, C.waterLight);
      rect(ctx, ox + 3, oy + 1, 1, 6, C.woodDark);
      rect(ctx, ox + 12, oy + 1, 1, 6, C.woodDark);
      rect(ctx, ox + 2, oy, 12, 2, ROOFS[0].dark);
      break;
    case 'gate':
      rect(ctx, ox + 1, oy + 2, 3, 14, C.woodDark);
      rect(ctx, ox + 12, oy + 2, 3, 14, C.woodDark);
      rect(ctx, ox, oy + 1, TILE, 3, C.wood);
      for (let i = 0; i < 3; i++) rect(ctx, ox + 4, oy + 6 + i * 4, 8, 2, C.woodLight);
      rect(ctx, ox + 5 + Math.floor(hash(p.x, p.y, 90) * 6), oy + 1, 2, 2, C.leafLight);
      break;
  }
}

function drawTree(ctx: Ctx, ox: number, oy: number, r: number) {
  rect(ctx, ox + 6, oy + 11, 4, 5, C.trunk);
  rect(ctx, ox + 1, oy + 2, 14, 10, C.outline);
  rect(ctx, ox + 3, oy, 10, 14, C.outline);
  rect(ctx, ox + 2, oy + 3, 12, 8, C.leafDark);
  rect(ctx, ox + 4, oy + 1, 8, 12, C.leafDark);
  rect(ctx, ox + 3, oy + 2, 10, 7, C.leaf);
  rect(ctx, ox + 5, oy + 1, 6, 9, C.leaf);
  rect(ctx, ox + 5, oy + 2, 3, 2, C.leafLight);
  rect(ctx, ox + 4, oy + 4, 2, 1, C.leafLight);
  if (r > 0.6) rect(ctx, ox + 10, oy + 5, 2, 2, '#e8705f'); // Apfel
}

/** Gebäude werden über zusammenhängende Dach-/Wandflächen erkannt; die Farbe hängt an der Kartenhälfte. */
function roofColors(map: VillageMap, p: Pos) {
  return ROOFS[p.x < map.width / 2 ? 0 : 1];
}

function drawRoof(ctx: Ctx, map: VillageMap, p: Pos, ox: number, oy: number) {
  const col = roofColors(map, p);
  const isRoof = (q: Pos) => tileAt(map, q)?.object === 'roof';
  rect(ctx, ox, oy, TILE, TILE, col.base);
  for (let row = 0; row < 4; row++) {
    const yy = oy + row * 4 + 3;
    rect(ctx, ox, yy, TILE, 1, col.dark);
    const shift = row % 2 === 0 ? 0 : 4;
    for (let k = shift; k < TILE; k += 8) rect(ctx, ox + k, yy - 3, 1, 3, col.dark);
  }
  if (!isRoof({ x: p.x, y: p.y - 1 })) {
    rect(ctx, ox, oy, TILE, 2, C.outline);
    rect(ctx, ox, oy + 2, TILE, 1, col.light);
  }
  if (!isRoof({ x: p.x - 1, y: p.y })) rect(ctx, ox, oy, 1, TILE, C.outline);
  if (!isRoof({ x: p.x + 1, y: p.y })) rect(ctx, ox + TILE - 1, oy, 1, TILE, C.outline);
  if (!isRoof({ x: p.x, y: p.y + 1 })) {
    rect(ctx, ox, oy + TILE - 2, TILE, 2, C.outline);
    rect(ctx, ox, oy + TILE - 3, TILE, 1, col.dark);
  }
}

function drawWall(ctx: Ctx, map: VillageMap, p: Pos, ox: number, oy: number, kind: string) {
  const isHouse = (q: Pos) => ['wall', 'window', 'door'].includes(tileAt(map, q)?.object ?? '');
  rect(ctx, ox, oy, TILE, TILE, C.wall);
  rect(ctx, ox, oy, TILE, 2, C.wallDark); // Schatten unter dem Dach
  rect(ctx, ox, oy + TILE - 2, TILE, 2, C.timber);
  if (!isHouse({ x: p.x - 1, y: p.y })) rect(ctx, ox, oy, 2, TILE, C.timber);
  if (!isHouse({ x: p.x + 1, y: p.y })) rect(ctx, ox + TILE - 2, oy, 2, TILE, C.timber);
  if (kind === 'window') {
    rect(ctx, ox + 3, oy + 4, 10, 8, C.woodDark);
    rect(ctx, ox + 4, oy + 5, 8, 6, C.glass);
    rect(ctx, ox + 7, oy + 5, 2, 6, C.woodDark);
    rect(ctx, ox + 4, oy + 7, 8, 1, C.woodDark);
    rect(ctx, ox + 4, oy + 5, 2, 1, '#ffffff');
  } else if (kind === 'door') {
    rect(ctx, ox + 3, oy + 3, 10, 13, C.outline);
    rect(ctx, ox + 4, oy + 4, 8, 12, C.wood);
    rect(ctx, ox + 4, oy + 4, 8, 1, C.woodLight);
    rect(ctx, ox + 7, oy + 4, 1, 12, C.woodDark);
    rect(ctx, ox + 10, oy + 10, 1, 1, C.glass);
  }
}

function drawFence(ctx: Ctx, map: VillageMap, p: Pos, ox: number, oy: number) {
  const isFence = (q: Pos) => tileAt(map, q)?.object === 'fence';
  const l = isFence({ x: p.x - 1, y: p.y });
  const r = isFence({ x: p.x + 1, y: p.y });
  const u = isFence({ x: p.x, y: p.y - 1 });
  const d = isFence({ x: p.x, y: p.y + 1 });
  // Pfosten
  rect(ctx, ox + 6, oy + 3, 4, 11, C.woodDark);
  rect(ctx, ox + 7, oy + 3, 2, 10, C.woodLight);
  // Latten zu den Nachbarn
  for (const yy of [6, 10]) {
    if (l) rect(ctx, ox, oy + yy, 7, 2, C.wood);
    if (r) rect(ctx, ox + 9, oy + yy, 7, 2, C.wood);
  }
  if (u) rect(ctx, ox + 7, oy, 2, 4, C.wood);
  if (d) rect(ctx, ox + 7, oy + 13, 2, 3, C.wood);
}
