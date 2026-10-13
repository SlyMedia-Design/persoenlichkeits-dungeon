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

export function creatureTexture(scene: Phaser.Scene, archetype: Archetype): string {
  return pixelTexture(scene, `creature-${archetype.id}`, archetype.sprite);
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
export function pixelScale(targetSize: number, spriteSize = 16): number {
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
