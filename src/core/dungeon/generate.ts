/** Erzeugt Etagen: Räume in einem Raster, verbunden durch Gänge; dazu die handgebaute Boss-Lichtung. */
import type { Pos } from '../grid';
import type { Random } from './random';
import { makeUnit } from './stats';
import type { Content, DungeonState, Floor, GroundItem, Rect, Trap, Unit } from './types';

const key = (p: Pos) => `${p.x},${p.y}`;

function emptyExplored(width: number, height: number): string[] {
  return Array.from({ length: height }, () => '0'.repeat(width));
}

function carve(grid: string[][], x: number, y: number) {
  if (y > 0 && y < grid.length - 1 && x > 0 && x < grid[0].length - 1) grid[y][x] = '.';
}

/** Gang in L-Form zwischen zwei Punkten */
function corridor(grid: string[][], a: Pos, b: Pos, rng: Random) {
  const horizontalFirst = rng.chance(50);
  const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  for (const [from, to] of [
    [a, corner],
    [corner, b],
  ]) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let p = { ...from };
    carve(grid, p.x, p.y);
    while (p.x !== to.x || p.y !== to.y) {
      p = { x: p.x + dx, y: p.y + dy };
      carve(grid, p.x, p.y);
    }
  }
}

function roomPoint(room: Rect, rng: Random): Pos {
  return { x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y, room.y + room.h - 1) };
}

export interface GeneratedFloor {
  floor: Floor;
  start: Pos;
  /** Raum, in dem das Team startet (dort stehen keine Gegner) */
  startRoom: number;
}

/** Zufällige Etage: Räume, Gänge und Treppe (ohne Wesen und Gegenstände). */
export function generateLayout(content: Content, number: number, rng: Random): GeneratedFloor {
  const { width, height } = content.dungeon.size;
  const r = content.dungeon.rooms;
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));
  const cellW = Math.floor(width / r.cols);
  const cellH = Math.floor(height / r.rows);
  const rooms: Rect[] = [];
  for (let row = 0; row < r.rows; row++) {
    for (let col = 0; col < r.cols; col++) {
      const w = rng.int(r.minSize, Math.min(r.maxWidth, cellW - 3));
      const h = rng.int(r.minSize, Math.min(r.maxHeight, cellH - 3));
      const x = col * cellW + rng.int(1, cellW - w - 2);
      const y = row * cellH + rng.int(1, cellH - h - 2);
      rooms.push({ x, y, w, h });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = '.';
    }
  }
  const at = (col: number, row: number) => rooms[row * r.cols + col];
  // Waagerecht immer verbinden; senkrecht mindestens eine Verbindung je Zeilenpaar, weitere zufällig
  for (let row = 0; row < r.rows; row++) {
    for (let col = 0; col < r.cols - 1; col++) corridor(grid, roomPoint(at(col, row), rng), roomPoint(at(col + 1, row), rng), rng);
  }
  for (let row = 0; row < r.rows - 1; row++) {
    const must = rng.int(0, r.cols - 1);
    for (let col = 0; col < r.cols; col++) {
      if (col === must || rng.chance(40)) corridor(grid, roomPoint(at(col, row), rng), roomPoint(at(col, row + 1), rng), rng);
    }
  }
  const startRoom = rng.int(0, rooms.length - 1);
  let stairsRoom = rng.int(0, rooms.length - 2);
  if (stairsRoom >= startRoom) stairsRoom++;
  const floor: Floor = {
    number,
    boss: false,
    width,
    height,
    tiles: grid.map((row) => row.join('')),
    rooms,
    stairs: roomPoint(rooms[stairsRoom], rng),
    items: [],
    traps: [],
    explored: emptyExplored(width, height),
  };
  return { floor, start: roomPoint(rooms[startRoom], rng), startRoom };
}

export function isFloorTile(floor: Floor, p: Pos): boolean {
  return p.y >= 0 && p.y < floor.height && p.x >= 0 && p.x < floor.width && floor.tiles[p.y][p.x] === '.';
}

/** Freies Bodenfeld in einem Raum (nicht Treppe, nicht belegt) */
function freeSpot(floor: Floor, taken: Set<string>, rng: Random, avoidRoom?: number): Pos | null {
  for (let i = 0; i < 200; i++) {
    let idx = rng.int(0, floor.rooms.length - 1);
    if (idx === avoidRoom && floor.rooms.length > 1) idx = (idx + 1) % floor.rooms.length;
    const p = roomPoint(floor.rooms[idx], rng);
    if (!taken.has(key(p)) && !(floor.stairs && key(floor.stairs) === key(p))) {
      taken.add(key(p));
      return p;
    }
  }
  return null;
}

/** Nachbarfeld für den Partner neben dem Startpunkt */
function besideStart(floor: Floor, start: Pos, taken: Set<string>): Pos {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = { x: start.x + dx, y: start.y + dy };
    if (isFloorTile(floor, p) && !taken.has(key(p))) return p;
  }
  return start;
}

export function newId(state: DungeonState, prefix = 'e'): string {
  return `${prefix}${state.nextId++}`;
}

/** Gegner passend zur Etage würfeln */
export function rollEnemy(content: Content, state: DungeonState, number: number, pos: Pos, rng: Random): Unit {
  const floor = content.dungeon.floors[number - 1];
  const [species] = rng.weighted(floor.enemies, (e) => e[1]);
  const [min, max] = floor.enemyLevel;
  return makeUnit(content, { id: newId(state), side: 'enemy', species, level: rng.int(min, max), pos });
}

/**
 * Baut eine neue zufällige Etage in den Zustand ein: Team an den Start, Gegner, Gegenstände,
 * Fallen und Quest-Inhalte (Stups auf seiner Etage, Leuchtmoos auf jeder Etage).
 */
export function enterFloor(content: Content, state: DungeonState, number: number, rng: Random) {
  const def = content.dungeon;
  const { floor, start, startRoom } = generateLayout(content, number, rng);
  const taken = new Set<string>([key(start)]);
  const team = state.units.filter((u) => u.side === 'team' || (u.side === 'escort' && state.escort === 'following'));
  const player = team.find((u) => u.id === 'player')!;
  player.pos = start;
  for (const u of team) {
    if (u === player) continue;
    u.pos = besideStart(floor, start, taken);
    taken.add(key(u.pos));
  }
  const units: Unit[] = [...team];

  const floorDef = def.floors[number - 1];
  const count = rng.int(floorDef.enemyCount[0], floorDef.enemyCount[1]);
  for (let i = 0; i < count; i++) {
    const p = freeSpot(floor, taken, rng, startRoom);
    if (p) units.push(rollEnemy(content, state, number, p, rng));
  }

  const items: GroundItem[] = [];
  const itemCount = floorDef.items + Math.floor(state.bonuses.extraItems) + (rng.next() < state.bonuses.extraItems % 1 ? 1 : 0);
  const findable = Object.entries(def.items).filter(([, it]) => it.weight > 0);
  for (let i = 0; i < itemCount; i++) {
    const p = freeSpot(floor, taken, rng);
    if (p) items.push({ pos: p, item: rng.weighted(findable, ([, it]) => it.weight)[0] });
  }
  if (state.mossActive) {
    for (let i = 0; i < def.quests.leuchtmoos.perFloor; i++) {
      const p = freeSpot(floor, taken, rng, startRoom);
      if (p) items.push({ pos: p, item: def.quests.leuchtmoos.item });
    }
  }
  const traps: Trap[] = [];
  const trapKinds = Object.keys(def.traps);
  for (let i = 0; i < floorDef.traps; i++) {
    const p = freeSpot(floor, taken, rng, startRoom);
    if (p) traps.push({ pos: p, kind: rng.pick(trapKinds), revealed: false });
  }

  if (state.escort === 'waiting' && number === def.quests.verirrt.floor) {
    const p = freeSpot(floor, taken, rng, startRoom);
    if (p) {
      const e = def.quests.verirrt.escort;
      units.push({
        id: e.id,
        side: 'escort',
        species: e.id,
        pos: p,
        facing: 'down',
        level: 1,
        xp: 0,
        hp: e.hp,
        maxHp: e.hp,
        atk: 0,
        def: 2,
        moves: [],
        status: [],
        aware: false,
      });
    }
  }
  // Wartet Stups noch auf einer früheren Etage? Dann bleibt er dort zurück.
  state.units = units;
  state.floor = { ...floor, items, traps };
}

/** Die handgebaute Lichtung des Bosses */
export function enterBossFloor(content: Content, state: DungeonState) {
  const def = content.dungeon.boss;
  const height = def.map.length;
  const width = def.map[0].length;
  const find = (ch: string): Pos => {
    const y = def.map.findIndex((row) => row.includes(ch));
    return { x: def.map[y].indexOf(ch), y };
  };
  const team = state.units.filter((u) => u.side === 'team');
  team.find((u) => u.id === 'player')!.pos = find('P');
  const partner = team.find((u) => u.id === 'partner');
  if (partner) partner.pos = find('Q');
  for (const u of team) u.facing = 'up';
  const boss = makeUnit(content, { id: 'boss', side: 'enemy', species: def.species, level: def.level, pos: find('B'), boss: true });
  boss.aware = true;
  state.units = [...team, boss];
  state.floor = {
    number: content.dungeon.floors.length + 1,
    boss: true,
    width,
    height,
    tiles: def.map.map((row) => row.replace(/[BPQ]/g, '.')),
    rooms: [{ x: 1, y: 1, w: width - 2, h: height - 2 }],
    stairs: null,
    items: [],
    traps: [],
    explored: emptyExplored(width, height),
  };
}
