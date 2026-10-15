import Phaser from 'phaser';
import { pixelTexture } from './sprites';

/** Pixel-Zeichen über NPCs mit eigenem Auftrag: orange mit hellem Rand, damit es auch vor dunklen Türen auffällt */
const PALETTE = { o: '#fff8ea', r: '#ff8a1c', y: '#ffc04a' };

const GLYPHS: Record<'!' | '?', string[]> = {
  '!': ['.ooo.', 'oryro', 'orrro', 'orrro', '.oro.', '.oro.', '.ooo.', '.....', '.ooo.', '.oro.', '.ooo.'],
  '?': ['.ooooo.', 'oryyrro', 'orrorro', 'ooo.oro', '..oorro', '..orroo', '..oroo.', '..ooo..', '.......', '..ooo..', '..oro..', '..ooo..'],
};

export function markerTexture(scene: Phaser.Scene, mark: '!' | '?'): string {
  return pixelTexture(scene, mark === '!' ? 'marker-exclaim' : 'marker-question', { palette: PALETTE, rows: GLYPHS[mark] });
}
