import Phaser from 'phaser';
import { pixelTexture } from './sprites';

/** Pixel-Zeichen über NPCs mit eigenem Auftrag: orange mit dunklem Rand */
const PALETTE = { o: '#4a2410', r: '#ff9a3c', y: '#ffd27a' };

const GLYPHS: Record<'!' | '?', string[]> = {
  '!': ['.ooo.', 'oryro', 'orrro', 'orrro', '.oro.', '.oro.', '.ooo.', '.....', '.ooo.', '.oro.', '.ooo.'],
  '?': ['.ooooo.', 'oryyrro', 'orrorro', 'ooo.oro', '..oorro', '..orroo', '..oroo.', '..ooo..', '.......', '..ooo..', '..oro..', '..ooo..'],
};

export function markerTexture(scene: Phaser.Scene, mark: '!' | '?'): string {
  return pixelTexture(scene, mark === '!' ? 'marker-exclaim' : 'marker-question', { palette: PALETTE, rows: GLYPHS[mark] });
}
