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

/** Ist der Lautstärkeregler gerade aufgeklappt? (bleibt beim Neuaufbau der Oberfläche erhalten) */
let sliderOpen = false;

/**
 * Lautstärke oben rechts: Antippen klappt einen Regler auf. Gibt den Text zurück, damit Szenen ihn
 * als Bedienelement erkennen; onUse meldet jede Berührung (die HUD-Szenen verbrauchen sie damit).
 */
export function addSoundToggle(scene: Phaser.Scene, m: Metrics, onUse?: () => void): Phaser.GameObjects.Text {
  const label = () => (ambient.muted ? t('common.soundOff') : t('common.soundLevel', { percent: Math.round(ambient.volume * 100) }));
  scene.sound.volume = ambient.volume;
  const text = scene.add
    .text(m.width - 12, 10, label(), textStyle(m.small, COLORS.textDim))
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(100)
    .setPadding(8, 6, 8, 6)
    .setInteractive({ useHandCursor: true });

  // Regler: Leiste mit Knopf unter dem Text
  const trackW = Math.round(m.small * 7);
  const padX = Math.round(m.small * 0.8);
  const panelW = trackW + padX * 2;
  const panelH = Math.round(m.small * 2.4);
  const panel = scene.add.container(m.width - 12 - panelW, 10 + text.height + 4).setScrollFactor(0).setDepth(101);
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.panel, 0.95).fillRoundedRect(0, 0, panelW, panelH, 8);
  bg.lineStyle(2, COLORS.cream, 0.5).strokeRoundedRect(0, 0, panelW, panelH, 8);
  const bar = scene.add.graphics();
  const knob = scene.add.circle(0, panelH / 2, Math.round(m.small * 0.45), COLORS.gold).setStrokeStyle(2, 0x120f22);
  const zone = scene.add.zone(0, 0, panelW, panelH).setOrigin(0).setInteractive({ useHandCursor: true });
  panel.add([bg, bar, knob, zone]);
  const draw = () => {
    const x = padX + trackW * ambient.volume;
    bar.clear();
    bar.fillStyle(0x120f22, 0.8).fillRoundedRect(padX, panelH / 2 - 3, trackW, 6, 3);
    bar.fillStyle(COLORS.gold, 1).fillRoundedRect(padX, panelH / 2 - 3, Math.max(6, x - padX), 6, 3);
    knob.x = x;
    text.setText(label());
  };
  const setFrom = (pointer: Phaser.Input.Pointer) => {
    ambient.setVolume((pointer.x - panel.x - padX) / trackW);
    scene.sound.volume = ambient.volume;
    draw();
  };
  const show = (open: boolean) => {
    sliderOpen = open;
    panel.setVisible(open);
    draw();
  };
  type Handler = (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => void;
  const swallow = (fn?: (pointer: Phaser.Input.Pointer) => void): Handler => (pointer, _x, _y, event) => {
    event.stopPropagation();
    onUse?.();
    fn?.(pointer);
  };
  text.on('pointerup', swallow(() => show(!sliderOpen)));
  zone.on('pointerdown', swallow(setFrom));
  zone.on('pointermove', (pointer: Phaser.Input.Pointer) => pointer.isDown && setFrom(pointer));
  zone.on('pointerup', swallow());
  text.once('destroy', () => panel.destroy());
  show(sliderOpen);
  return text;
}
