import Phaser from 'phaser';
import { t } from '../content';
import { ambient } from './ambient';
import { Backdrop } from './backdrop';
import { COLORS, metrics, textStyle, type Metrics } from './theme';

/**
 * Gemeinsame Grundlage aller Szenen: Hintergrund, Musik-Schalter, Ein-/Ausblenden
 * und Neuaufbau bei Größenänderung (Handy drehen, Fenster ziehen).
 */
export abstract class BaseScene extends Phaser.Scene {
  protected m!: Metrics;
  protected backdrop!: Backdrop;
  private resizeTimer?: Phaser.Time.TimerEvent;
  private leaving = false;

  /** Zustand, der bei einem Neuaufbau erhalten bleiben soll. */
  protected restartData(): object {
    return {};
  }

  /** Stimmung des Hintergrunds (0 Nacht … 1 Morgen). */
  protected mood(): number {
    return 0.3;
  }

  protected abstract build(): void;

  create() {
    this.leaving = false;
    this.m = metrics(this);
    this.backdrop = new Backdrop(this, this.mood());
    ambient.setBrightness(this.mood());
    this.build();
    addSoundToggle(this, this.m);
    this.cameras.main.fadeIn(400, 26, 24, 48);

    this.input.on('pointerdown', () => ambient.unlock());
    const onResize = () => {
      this.resizeTimer?.remove();
      this.resizeTimer = this.time.delayedCall(150, () => this.scene.restart(this.restartData()));
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  /** Sanft zur nächsten Szene überblenden. */
  protected goTo(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(350, 26, 24, 48);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}

/** Musik-Schalter oben rechts; gibt den Text zurück, damit Szenen ihn als Bedienelement erkennen. */
export function addSoundToggle(scene: Phaser.Scene, m: Metrics): Phaser.GameObjects.Text {
  const label = () => (ambient.muted ? t('common.soundOff') : t('common.soundOn'));
  const text = scene.add
    .text(m.width - 12, 10, label(), textStyle(m.small, COLORS.textDim))
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(100)
    .setPadding(8, 6, 8, 6)
    .setInteractive({ useHandCursor: true });
  text.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    ambient.toggle();
    // Musik und Geräusche aus Dateien (z. B. Boss) folgen dem Schalter
    scene.sound.mute = ambient.muted;
    text.setText(label());
  });
  return text;
}
