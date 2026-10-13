import Phaser from 'phaser';
import { t } from '../content';
import { BaseScene } from '../ui/BaseScene';
import { COLORS, textStyle } from '../ui/theme';
import { Typewriter } from '../ui/typewriter';

/** Erzähltext Zeile für Zeile; Antippen beschleunigt bzw. blättert weiter. */
export abstract class NarrationScene extends BaseScene {
  protected lineIndex = 0;
  private text!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private writer?: Typewriter;
  private finished = false;
  private fading = false;

  protected abstract lines(): string[];
  /** Wird nach der letzten Zeile aufgerufen. */
  protected abstract onFinished(): void;

  init(data: { lineIndex?: number }) {
    this.lineIndex = data.lineIndex ?? 0;
    this.finished = false;
    this.fading = false;
  }

  protected restartData() {
    return { lineIndex: this.lineIndex };
  }

  protected build() {
    const { cx, height, contentWidth, large, small } = this.m;
    this.text = this.add
      .text(cx, height * 0.45, '', {
        ...textStyle(large),
        align: 'center',
        lineSpacing: Math.round(large * 0.35),
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.hint = this.add
      .text(cx, height - 40, t('common.tapToContinue'), textStyle(small, COLORS.textDim))
      .setOrigin(0.5)
      .setAlpha(0);

    this.input.on('pointerup', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.showLine();
  }

  /** Text-Objekt, falls eine Unterklasse nach dem Erzähltext eigene Elemente zeigen will. */
  protected get narration() {
    return this.text;
  }

  private showLine() {
    this.hint.setAlpha(0);
    this.writer?.destroy();
    this.writer = new Typewriter(this, this.text, this.lines()[this.lineIndex], () => {
      this.tweens.add({ targets: this.hint, alpha: 0.7, duration: 400 });
    });
  }

  private advance() {
    if (this.finished || this.fading) return;
    if (this.writer && !this.writer.done) {
      this.writer.finish();
      return;
    }
    if (this.lineIndex < this.lines().length - 1) {
      this.lineIndex++;
      this.fading = true;
      this.tweens.add({
        targets: this.text,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.fading = false;
          this.text.setAlpha(1);
          this.showLine();
        },
      });
      return;
    }
    this.finished = true;
    this.hint.setVisible(false);
    this.onFinished();
  }
}
