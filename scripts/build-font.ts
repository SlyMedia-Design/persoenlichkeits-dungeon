/**
 * Erzeugt die Spielschrift „Dorfschrift“ aus Pixelify Sans (SIL Open Font License 1.1).
 *
 *   npx tsx scripts/build-font.ts
 *
 * Ziel: gleicher Pixel-Look, aber auf kleinen Handy-Bildschirmen besser lesbar.
 * - kräftigere Grundschnitte (Medium statt Regular, Bold für Überschriften)
 * - größere x-Höhe: Kleinbuchstaben werden höher, Ober- und Unterlängen bleiben gleich lang
 * - mehr Abstand zwischen Buchstaben und Wörtern
 *
 * Ergebnis: src/ui/fonts/dorfschrift-{regular,bold}.otf (+ OFL-Lizenztext)
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ot from 'opentype.js';

const opentype = ((ot as unknown as { default?: typeof ot }).default ?? ot) as typeof ot;

const SOURCE_DIR = resolve(import.meta.dirname, '../node_modules/@fontsource/pixelify-sans/files');
const TARGET_DIR = resolve(import.meta.dirname, '../src/ui/fonts');

/** Zusätzlicher Buchstabenabstand in Font-Einheiten (1000 = Schriftgröße) */
const TRACKING = 60;
/** Zusätzlicher Wortabstand */
const EXTRA_SPACE = 90;
/** Faktor für die x-Höhe */
const X_HEIGHT_SCALE = 1.1;

function load(file: string): ot.Font {
  const buf = readFileSync(resolve(SOURCE_DIR, file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function build(sourceFile: string, styleName: string, outFile: string) {
  const src = load(sourceFile);
  const xHeight = (src.tables.os2 as unknown as { sxHeight: number }).sxHeight;
  const lift = xHeight * (X_HEIGHT_SCALE - 1);
  // Höhe streckt nur den Bereich zwischen Grundlinie und x-Höhe; alles darüber rutscht nach oben.
  const mapY = (y: number) => (y <= 0 ? y : y <= xHeight ? y * X_HEIGHT_SCALE : y + lift);
  const mapX = (x: number) => x + TRACKING / 2;

  const glyphs: ot.Glyph[] = [];
  for (let i = 0; i < src.glyphs.length; i++) {
    const g = src.glyphs.get(i);
    const path = new opentype.Path();
    for (const c of g.path.commands) {
      const cmd = { ...c } as Record<string, number | string>;
      for (const k of ['x', 'x1', 'x2']) if (typeof cmd[k] === 'number') cmd[k] = mapX(cmd[k] as number);
      for (const k of ['y', 'y1', 'y2']) if (typeof cmd[k] === 'number') cmd[k] = mapY(cmd[k] as number);
      path.commands.push(cmd as unknown as ot.PathCommand);
    }
    const isSpace = g.unicode === 0x20 || g.unicode === 0xa0;
    glyphs.push(
      new opentype.Glyph({
        name: g.name ?? `glyph${i}`,
        unicode: g.unicode,
        unicodes: g.unicodes,
        advanceWidth: (g.advanceWidth ?? 0) + (g.advanceWidth ? TRACKING : 0) + (isSpace ? EXTRA_SPACE : 0),
        path,
      }),
    );
  }

  const font = new opentype.Font({
    familyName: 'Dorfschrift',
    styleName,
    unitsPerEm: src.unitsPerEm,
    ascender: Math.round(src.ascender + lift),
    descender: src.descender,
    designer: 'Persönlichkeits-Dungeon, abgeleitet von Pixelify Sans (Stefie Justprince)',
    copyright: 'Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)',
    license: 'SIL Open Font License 1.1 (https://openfontlicense.org)',
    version: '1.0',
    glyphs,
  });
  writeFileSync(resolve(TARGET_DIR, outFile), Buffer.from(font.toArrayBuffer()));
  console.log(`${outFile}: ${glyphs.length} Zeichen`);
}

mkdirSync(TARGET_DIR, { recursive: true });
build('pixelify-sans-latin-500-normal.woff', 'Regular', 'dorfschrift-regular.otf');
build('pixelify-sans-latin-700-normal.woff', 'Bold', 'dorfschrift-bold.otf');
copyFileSync(resolve(SOURCE_DIR, '../LICENSE'), resolve(TARGET_DIR, 'OFL.txt'));
