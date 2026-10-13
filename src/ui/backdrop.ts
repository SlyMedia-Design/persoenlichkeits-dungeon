import Phaser from 'phaser';
import { glowTexture } from './sprites';
import { SKY, rampColor } from './theme';

/**
 * Stimmungsvoller Hintergrund: Farbverlauf von Nacht (mood 0) bis Morgendämmerung (mood 1),
 * darüber langsam schwebende Lichtpunkte.
 */
export class Backdrop {
  private sky: Phaser.GameObjects.Graphics;
  private motes: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, mood: number, moteCount = 18) {
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-10);
    this.setMood(mood);
    const key = glowTexture(scene);
    const { width, height } = scene.scale;
    for (let i = 0; i < moteCount; i++) {
      const mote = scene.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), key)
        .setScale(Phaser.Math.FloatBetween(0.08, 0.22))
        .setAlpha(0)
        .setTint(Phaser.Utils.Array.GetRandom([0xfff2b0, 0xffd27a, 0xb8f0ff, 0xf9c4d2]))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(-9);
      this.motes.push(mote);
      this.drift(mote, Phaser.Math.Between(0, 3000));
    }
  }

  setMood(mood: number) {
    const { width, height } = this.scene.scale;
    const top = rampColor(SKY.top, mood);
    const bottom = rampColor(SKY.bottom, mood);
    this.sky.clear();
    this.sky.fillGradientStyle(top, top, bottom, bottom, 1);
    this.sky.fillRect(0, 0, width, height);
  }

  private drift(mote: Phaser.GameObjects.Image, delay: number) {
    const { width, height } = this.scene.scale;
    mote.setPosition(Phaser.Math.Between(0, width), Phaser.Math.Between(height * 0.2, height));
    this.scene.tweens.add({
      targets: mote,
      x: mote.x + Phaser.Math.Between(-60, 60),
      y: mote.y - Phaser.Math.Between(60, 160),
      alpha: { from: 0, to: Phaser.Math.FloatBetween(0.4, 0.9) },
      duration: Phaser.Math.Between(3000, 6000),
      delay,
      yoyo: false,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: mote,
          alpha: 0,
          duration: 1200,
          onComplete: () => this.drift(mote, Phaser.Math.Between(0, 1500)),
        });
      },
    });
  }
}
