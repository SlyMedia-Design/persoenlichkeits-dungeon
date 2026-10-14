/**
 * Zeichnet die 32×32-Porträts der Wesen und schreibt sie als Text-Sprites
 * (Palette + Zeilen) nach data/archetypes.json → archetypes[].portrait.
 *
 *   npx tsx scripts/draw-creatures.ts
 *
 * Die Wesen werden aus einfachen Formen gebaut (Ellipsen, Dreiecke, Pixel),
 * mit Licht von links oben schattiert und am Ende mit einer 1-Pixel-Kontur umrandet.
 * Die Formsprache folgt CLAUDE.md: rund = verträglich, warm = extravertiert,
 * Muster/Leuchten = offen, symmetrisch = gewissenhaft, große Augen/Ohren = feinfühlig.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIZE = 32;
type Grid = (string | null)[][];
interface Material {
  light: string;
  base: string;
  shade: string;
}

class Canvas {
  px: Grid = Array.from({ length: SIZE }, () => new Array<string | null>(SIZE).fill(null));
  /** Zeichen, die keine schwarze Kontur bekommen (z. B. Wasserblasen, Leuchtpunkte) */
  noOutline = new Set<string>();

  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.px[y][x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? this.px[y][x] : null;
  }

  /** Ellipse mit Kugel-Schattierung (Licht von links oben). clip begrenzt auf bereits gefüllte Pixel. */
  ball(cx: number, cy: number, rx: number, ry: number, m: Material, opts: { clip?: boolean; soft?: boolean } = {}) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        if (opts.clip && !this.get(x, y)) continue;
        const nz = Math.sqrt(1 - r2);
        const i = -0.35 * nx - 0.5 * ny + 0.8 * nz;
        const hi = opts.soft ? 0.98 : 0.9;
        this.set(x, y, i > hi ? m.light : i < 0.18 ? m.shade : m.base);
      }
  }

  /** Einfarbige Ellipse */
  oval(cx: number, cy: number, rx: number, ry: number, c: string, clip = false) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1 && (!clip || this.get(x, y))) this.set(x, y, c);
      }
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: string) {
    const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
      (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d1 = s(px, py, ax, ay, bx, by);
        const d2 = s(px, py, bx, by, cx, cy);
        const d3 = s(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y, c);
      }
  }

  /** Pixel-Liste [x, y] in einer Farbe; mirror spiegelt zusätzlich an der Mittelachse. */
  dots(points: [number, number][], c: string, mirror = false) {
    for (const [x, y] of points) {
      this.set(x, y, c);
      if (mirror) this.set(SIZE - 1 - x, y, c);
    }
  }

  /** Kontur: jedes leere Pixel neben einem gefüllten wird Umrissfarbe. */
  outline(c: string) {
    const add: [number, number][] = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (this.get(x, y)) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const n = this.get(x + dx, y + dy);
          return n !== null && n !== c && !this.noOutline.has(n);
        });
        if (near) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
  }

  rows(): string[] {
    return this.px.map((r) => r.map((c) => c ?? '.').join(''));
  }
}

/** Glänzendes Auge: dunkles Oval mit Lichtpunkt oben links */
function eye(cv: Canvas, x: number, y: number, w: number, h: number, dark: string, white: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cv.set(x + dx, y + dy, dark);
  cv.set(x, y, white);
  if (w >= 3 && h >= 3) cv.set(x + w - 1, y + h - 1, white);
}

// ---------------------------------------------------------------- Otter
function otter() {
  const palette = {
    o: '#3b2114', B: '#f2ad63', b: '#d9823b', d: '#a35a26',
    C: '#fff3dc', c: '#f6dcb2', e: '#d9b486',
    k: '#1c1210', w: '#ffffff', n: '#4a2a1e', p: '#f2907e',
    z: '#fff0f5', s: '#f7c3d3', S: '#d0809d',
    q: '#bdeeff', Q: '#ffffff', r: '#69bfe4',
  };
  const fur = { light: 'B', base: 'b', shade: 'd' };
  const cream = { light: 'C', base: 'c', shade: 'e' };
  const cv = new Canvas();
  cv.noOutline = new Set(['q', 'Q', 'r']);
  cv.ball(25.5, 27.5, 4, 2, fur); // Schwanz
  cv.ball(11.5, 29.4, 3, 2, fur); // Füße
  cv.ball(20.5, 29.4, 3, 2, fur);
  cv.ball(16, 23.5, 8.5, 6.5, fur); // Körper
  cv.ball(16, 24.6, 5.2, 4.6, cream, { clip: true, soft: true }); // Bauch
  cv.ball(8.6, 22.8, 2.2, 2.8, fur); // Arme
  cv.ball(23.4, 22.8, 2.2, 2.8, fur);
  cv.ball(7.6, 7.2, 2.4, 2.4, fur); // Ohren
  cv.ball(24.4, 7.2, 2.4, 2.4, fur);
  cv.dots([[7, 7]], 'd', true);
  cv.ball(16, 13, 10.5, 8.6, fur); // Kopf
  cv.ball(16, 16.8, 5.4, 3.4, cream, { soft: true }); // Schnauze
  cv.dots([[15, 15], [16, 15]], 'n');
  cv.dots([[15, 16], [16, 16]], 'n');
  cv.dots([[15, 15]], 'B');
  cv.dots([[14, 18], [17, 18]], 'e');
  cv.dots([[15, 19], [16, 19]], 'e');
  eye(cv, 11, 11, 2, 3, 'k', 'w');
  eye(cv, 19, 11, 2, 3, 'k', 'w');
  cv.dots([[9, 15], [10, 15]], 'p', true);
  // Muschelkappe
  cv.ball(16, 5.2, 5.2, 3.4, { light: 'z', base: 's', shade: 'S' }, { soft: true });
  cv.dots([[13, 3], [13, 4], [13, 5], [16, 2], [16, 3], [16, 4], [16, 5], [19, 3], [19, 4], [19, 5]], 'S');
  cv.dots([[12, 7], [13, 7], [14, 7], [15, 7], [16, 7], [17, 7], [18, 7], [19, 7], [20, 7]], 'S');
  // Wasserblasen
  for (const [x, y, r] of [[3.5, 13.5, 1.9], [28.2, 9.5, 1.4], [27.5, 17.8, 2.2], [5, 19, 1]] as const) {
    cv.oval(x, y, r, r, 'r');
    if (r > 1.2) cv.oval(x, y, r - 0.9, r - 0.9, 'q');
    cv.set(Math.floor(x - r / 2), Math.floor(y - r / 2), 'Q');
  }
  cv.outline('o');
  return { palette, rows: cv.rows() };
}

// ---------------------------------------------------------------- Eule
function eule() {
  const palette = {
    o: '#161a33', B: '#7384c6', b: '#4d5da0', d: '#344178',
    F: '#eef2ff', f: '#c8d1ef', D: '#99a5d3',
    Y: '#ffe28c', y: '#f0bd45', u: '#b8862a',
    k: '#0d0d18', w: '#ffffff', g: '#8ff8ff', G: '#e8ffff',
    H: '#dfe6fb', h: '#b3bfe6', j: '#8794c8',
  };
  const plumage = { light: 'B', base: 'b', shade: 'd' };
  const cv = new Canvas();
  cv.noOutline = new Set(['G']);
  cv.ball(11.5, 29.6, 2.6, 1.6, { light: 'Y', base: 'y', shade: 'u' }); // Krallen
  cv.ball(20.5, 29.6, 2.6, 1.6, { light: 'Y', base: 'y', shade: 'u' });
  cv.ball(16, 23.6, 8.2, 6.6, plumage); // Körper
  cv.ball(16, 24.6, 5, 4.8, { light: 'H', base: 'h', shade: 'j' }, { clip: true, soft: true }); // Brust
  for (const [x, y] of [[14, 23], [17, 23], [15, 26], [18, 26], [13, 26]] as const) {
    cv.dots([[x, y], [x + 1, y + 1]], 'j');
  }
  cv.ball(8.4, 23.4, 3, 5.4, plumage); // Flügel
  cv.ball(23.6, 23.4, 3, 5.4, plumage);
  cv.dots([[7, 27], [8, 28], [9, 27], [7, 25], [8, 26]], 'g', true); // leuchtende Federspitzen
  cv.dots([[8, 28]], 'G', true);
  cv.tri(5.5, 1.5, 11.5, 7.5, 7, 9, 'b'); // Federohren
  cv.tri(26.5, 1.5, 20.5, 7.5, 25, 9, 'b');
  cv.dots([[7, 4], [8, 5]], 'd', true);
  cv.ball(16, 13.2, 10.6, 8.6, plumage); // Kopf
  cv.ball(12, 13.4, 4.8, 4.6, { light: 'F', base: 'f', shade: 'D' }, { soft: true }); // Gesichtsschleier
  cv.ball(20, 13.4, 4.8, 4.6, { light: 'F', base: 'f', shade: 'D' }, { soft: true });
  for (const cx of [12, 20]) {
    cv.oval(cx, 13.2, 3.3, 3.3, 'y');
    cv.oval(cx, 13.2, 2.2, 2.2, 'k');
  }
  cv.dots([[10, 11], [11, 12], [18, 11], [19, 12]], 'w');
  cv.dots([[12, 14], [20, 14]], 'G');
  cv.tri(14.6, 15.5, 17.4, 15.5, 16, 19, 'y'); // Schnabel
  cv.dots([[15, 15]], 'Y');
  cv.dots([[16, 17]], 'u');
  cv.dots([[3, 11], [29, 8], [27, 3]], 'G'); // Funken
  cv.outline('o');
  return { palette, rows: cv.rows() };
}

// ---------------------------------------------------------------- Dachs
function dachs() {
  const palette = {
    o: '#221c1a', B: '#b3a79b', b: '#8f8378', d: '#675d55',
    M: '#4a403b', m: '#2e2725', v: '#f6f1e9', V: '#cbc2b5',
    R: '#ffb46e', r: '#e2742c', x: '#a24e1c',
    S: '#cfdbe6', s: '#8fa0b4', T: '#617086',
    k: '#0e0c0c', w: '#ffffff', n: '#141010', p: '#c49386',
  };
  const fur = { light: 'B', base: 'b', shade: 'd' };
  const stone = { light: 'S', base: 's', shade: 'T' };
  const cv = new Canvas();
  cv.ball(16, 23.4, 9.4, 6.6, fur); // Körper
  cv.ball(11, 29.4, 2.8, 1.9, stone); // Steinpfoten vor dem Körper
  cv.ball(21, 29.4, 2.8, 1.9, stone);
  cv.dots([[9, 30], [11, 30]], 'S', true);
  cv.ball(7.6, 24, 2.4, 3, fur); // Arme mit Steinkrallen
  cv.ball(24.4, 24, 2.4, 3, fur);
  cv.dots([[6, 26], [7, 27], [8, 27]], 's', true);
  cv.dots([[6, 26]], 'S', true);
  // Erzflecken (symmetrisch)
  for (const [x, y] of [[11, 22], [13, 26]] as const) {
    cv.dots([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], 'r', true);
    cv.dots([[x, y]], 'R', true);
    cv.dots([[x + 1, y + 1]], 'x', true);
  }
  cv.ball(7.6, 6.4, 3.6, 3.6, fur); // große Ohren
  cv.ball(24.4, 6.4, 3.6, 3.6, fur);
  cv.oval(7.6, 6.6, 1.8, 2, 'p');
  cv.oval(24.4, 6.6, 1.8, 2, 'p');
  cv.ball(16, 13.6, 10.6, 8.6, fur); // Kopf
  cv.ball(11, 12.4, 3.2, 6.6, { light: 'M', base: 'm', shade: 'm' }, { clip: true }); // Maske
  cv.ball(21, 12.4, 3.2, 6.6, { light: 'M', base: 'm', shade: 'm' }, { clip: true });
  cv.ball(16, 10.4, 2.3, 7.6, { light: 'v', base: 'v', shade: 'V' }, { clip: true }); // Mittelstreifen
  cv.ball(16, 17.4, 3.8, 2.8, { light: 'v', base: 'v', shade: 'V' }); // Schnauze
  cv.dots([[15, 16], [16, 16], [15, 17], [16, 17]], 'n');
  cv.dots([[15, 16]], 'M');
  eye(cv, 10, 11, 3, 3, 'k', 'w');
  eye(cv, 19, 11, 3, 3, 'k', 'w');
  cv.outline('o');
  return { palette, rows: cv.rows() };
}

// ---------------------------------------------------------------- Capybara
function capybara() {
  const palette = {
    o: '#3a2a1a', B: '#d4b088', b: '#b8936a', d: '#8f6e4c',
    L: '#e6cba5', l: '#c9a67c', a: '#a3815c',
    M: '#9fd36f', m: '#62a24a', N: '#3f7432',
    j: '#ffd2e2', f: '#f590b4', F: '#ffe27a',
    k: '#2a1c10', n: '#4a3420', e: '#9b7552',
  };
  const fur = { light: 'B', base: 'b', shade: 'd' };
  const moss = { light: 'M', base: 'm', shade: 'N' };
  const cv = new Canvas();
  cv.ball(11.2, 29.5, 3, 1.8, fur); // Füße
  cv.ball(20.8, 29.5, 3, 1.8, fur);
  cv.ball(16, 23.8, 10, 6.6, fur); // runder Körper
  cv.ball(7.6, 7.6, 1.8, 1.8, fur); // kleine Ohren
  cv.ball(24.4, 7.6, 1.8, 1.8, fur);
  cv.ball(16, 13.4, 10.2, 8.2, fur); // Kopf
  cv.ball(16, 17, 6.6, 4.2, { light: 'L', base: 'l', shade: 'a' }, { soft: true }); // Schnauze
  cv.dots([[13, 16], [13, 17], [18, 16], [18, 17]], 'n');
  cv.dots([[14, 16], [17, 16]], 'a');
  cv.dots([[15, 19], [16, 19]], 'a');
  // zufrieden geschlossene Augen
  cv.dots([[9, 11], [12, 11], [10, 12], [11, 12]], 'k', true);
  // Moos auf Kopf und Schultern, unregelmäßiger Rand
  cv.ball(14.5, 6.4, 7.4, 3.2, moss);
  cv.ball(21, 6.8, 3.6, 2.4, moss);
  cv.dots([[8, 5], [12, 3], [17, 3], [22, 4]], 'm');
  // Blüten (bewusst unsymmetrisch)
  for (const [x, y] of [[11, 4], [19, 3], [24, 6]] as const) {
    cv.dots([[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]], 'f');
    cv.dots([[x - 1, y]], 'j');
    cv.dots([[x, y]], 'F');
  }
  cv.dots([[11, 21], [12, 21], [13, 21], [14, 21], [15, 21], [16, 21], [17, 21], [18, 21], [19, 21], [20, 21]], 'd'); // Kinnlinie
  cv.outline('o');
  return { palette, rows: cv.rows() };
}

const portraits: Record<string, { palette: Record<string, string>; rows: string[] }> = {
  otter: otter(),
  eule: eule(),
  dachs: dachs(),
  capybara: capybara(),
};

const file = resolve(import.meta.dirname, '../data/archetypes.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
for (const a of data.archetypes) {
  if (!portraits[a.id]) throw new Error(`Kein Porträt für ${a.id}`);
  a.portrait = portraits[a.id];
}
data.description =
  'Prototyp-Wesen. profile = Ziel-z-Profil (hoch = +1, niedrig = −1), N = Neurotizismus/Feingefühl. Texte stehen in data/i18n/de.json unter creatures.<id>. sprite = 16×16 (Spielfeld), portrait = 32×32 (Menüs, erzeugt mit scripts/draw-creatures.ts). Jedes Zeichen ist ein Eintrag der Palette, \'.\' ist durchsichtig.';
writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
for (const [id, p] of Object.entries(portraits)) console.log(`${id}\n${p.rows.join('\n')}\n`);
