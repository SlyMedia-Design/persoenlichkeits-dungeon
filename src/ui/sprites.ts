import Phaser from 'phaser';
import type { Archetype, PixelSprite } from '../core/types';

/** Erzeugt aus einem Text-Sprite (JSON) eine Phaser-Textur, falls noch nicht vorhanden. */
export function pixelTexture(scene: Phaser.Scene, key: string, sprite: PixelSprite): string {
  if (scene.textures.exists(key)) return key;
  const h = sprite.rows.length;
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) throw new Error(`Textur ${key} konnte nicht erstellt werden`);
  const ctx = canvas.getContext();
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = sprite.palette[ch];
      if (ch === '.' || !color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  canvas.refresh();
  return key;
}

/** Kantenlänge der Wesen-Porträts in Pixeln */
export const PORTRAIT_SIZE = 32;

/** Porträt (32×32) für Menüs und Szenen; das 16×16-Sprite ist fürs Spielfeld gedacht. */
export function creatureTexture(scene: Phaser.Scene, archetype: Archetype): string {
  return pixelTexture(scene, `portrait-${archetype.id}`, archetype.portrait);
}

/** Weicher runder Lichtpunkt für Glühwürmchen, Auren usw. */
export function glowTexture(scene: Phaser.Scene): string {
  const key = 'glow';
  if (scene.textures.exists(key)) return key;
  const size = 64;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) throw new Error('Textur glow konnte nicht erstellt werden');
  const ctx = canvas.getContext();
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
  return key;
}

/** Ganzzahlige Vergrößerung, damit die Pixel scharf bleiben. */
export function pixelScale(targetSize: number, spriteSize = PORTRAIT_SIZE): number {
  return Math.max(1, Math.floor(targetSize / spriteSize));
}

/** Kleines Wippen im Stand, damit das Wesen lebendig wirkt. */
export function idleBob(scene: Phaser.Scene, target: Phaser.GameObjects.Image, amount: number) {
  scene.tweens.add({
    targets: target,
    y: target.y - amount,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

/** 16×16-Sprite eines Wesens fürs Spielfeld */
export function fieldTexture(scene: Phaser.Scene, archetype: Archetype): string {
  return pixelTexture(scene, `sprite-${archetype.id}`, archetype.sprite);
}

/** Platzhalter für Dorfbewohner ohne eigenes Wesen: runder Farbkreis mit Augen (16×16). */
export function npcTexture(scene: Phaser.Scene, id: string, color: string): string {
  const key = `npc-${id}`;
  if (scene.textures.exists(key)) return key;
  const base = Phaser.Display.Color.HexStringToColor(color);
  const shade = base.clone().darken(22).rgba;
  const light = base.clone().lighten(14).rgba;
  const outline = base.clone().darken(55).rgba;
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 6.5;
      const dy = (y + 0.5 - 9) / 6.2;
      const d = dx * dx + dy * dy;
      if (y >= 15 && (x === 5 || x === 6 || x === 9 || x === 10)) row += 'o'; // Füßchen
      else if (d > 1.18) row += '.';
      else if (d > 0.86) row += 'o';
      else if (dx * 0.6 + dy * 0.8 > 0.45) row += 's';
      else if (dx < -0.2 && dy < -0.35) row += 'l';
      else row += 'b';
    }
    rows.push(row);
  }
  // Augen mit Glanzpunkt und rosa Wangen
  const put = (x: number, y: number, ch: string) => (rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1));
  for (const ex of [5, 10]) {
    put(ex, 8, 'e');
    put(ex, 9, 'e');
    put(ex, 8, 'w');
    put(ex + (ex === 5 ? -1 : 1), 11, 'p');
  }
  put(6, 9, 'e');
  put(11, 9, 'e');
  put(6, 8, 'e');
  put(11, 8, 'e');
  return pixelTexture(scene, key, {
    palette: { o: outline, b: color, s: shade, l: light, e: '#22182a', w: '#ffffff', p: '#f49aa8' },
    rows,
  });
}

/** Weicher ovaler Schatten unter Figuren */
export function shadowTexture(scene: Phaser.Scene): string {
  return pixelTexture(scene, 'shadow', {
    palette: { s: 'rgba(30,40,30,0.28)' },
    rows: ['...ssssssss...', '.ssssssssssss.', '...ssssssss...'],
  });
}
