import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

export interface ButtonOptions {
  width: number;
  fontSize: number;
  onClick: () => void;
  height?: number;
  fill?: number;
  textColor?: string;
  align?: 'center' | 'left';
}

/** Pixeliger Knopf mit Hover- und Druck-Zustand; funktioniert mit Maus und Touch. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private fill: number;
  private hovered = false;
  private selected = false;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: ButtonOptions) {
    super(scene, x, y);
    this.bw = opts.width;
    this.fill = opts.fill ?? COLORS.panel;
    const padX = Math.round(opts.fontSize * 0.8);
    this.label = scene.add
      .text(opts.align === 'left' ? -opts.width / 2 + padX : 0, 0, text, {
        ...textStyle(opts.fontSize, opts.textColor),
        align: opts.align ?? 'center',
        wordWrap: { width: opts.width - padX * 2, useAdvancedWrap: true },
      })
      .setOrigin(opts.align === 'left' ? 0 : 0.5, 0.5);
    this.bh = opts.height ?? Math.max(Math.round(opts.fontSize * 2.4), this.label.height + opts.fontSize);
    this.bg = scene.add.graphics();
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.draw();

    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      this.hovered = true;
      this.draw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.setScale(1);
      this.draw();
    });
    this.on('pointerdown', () => this.enabled && this.setScale(0.97));
    this.on('pointerup', () => {
      this.setScale(1);
      if (this.enabled) opts.onClick();
    });
    scene.add.existing(this);
  }

  get buttonHeight() {
    return this.bh;
  }

  setSelected(selected: boolean) {
    this.selected = selected;
    this.draw();
    return this;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
    return this;
  }

  private draw() {
    const g = this.bg;
    const { bw: w, bh: h } = this;
    g.clear();
    // Schatten
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 6);
    // Fläche
    g.fillStyle(this.selected ? COLORS.panelLight : this.fill, 0.95);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    // Rahmen
    g.lineStyle(3, this.selected || this.hovered ? COLORS.gold : COLORS.cream, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  }
}
