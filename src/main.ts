import '@fontsource/pixelify-sans/400.css';
import Phaser from 'phaser';
import { EndingScene } from './scenes/EndingScene';
import { IntroScene } from './scenes/IntroScene';
import { NameScene } from './scenes/NameScene';
import { PartnerScene } from './scenes/PartnerScene';
import { ProfileScene } from './scenes/ProfileScene';
import { QuestionScene } from './scenes/QuestionScene';
import { RevealScene } from './scenes/RevealScene';
import { TitleScene } from './scenes/TitleScene';
import { COLORS } from './ui/theme';

async function start() {
  // Die Pixelschrift muss geladen sein, bevor Phaser Texte rendert
  try {
    await document.fonts.load('20px "Pixelify Sans"', 'ÄÖÜäöüß');
  } catch {
    // Ersatzschrift wird verwendet
  }
  // WebGL scheitert bei Fenstergröße 0 (z. B. Seite im Hintergrund geladen)
  while (window.innerWidth === 0 || window.innerHeight === 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: COLORS.night,
    pixelArt: true,
    roundPixels: true,
    dom: { createContainer: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: { activePointers: 2 },
    scene: [TitleScene, IntroScene, QuestionScene, RevealScene, PartnerScene, NameScene, EndingScene, ProfileScene],
  });
}

void start();
