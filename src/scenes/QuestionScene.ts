import Phaser from 'phaser';
import { archetypes, bank, norms, t } from '../content';
import { matchArchetype } from '../core/matching';
import { isComplete, score } from '../core/scoring';
import { getSave, updateSave } from '../state';
import { ambient } from '../ui/ambient';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { glowTexture } from '../ui/sprites';
import { COLORS, textStyle } from '../ui/theme';

const INTERLUDE_EVERY = 5;
/** Fortschrittsleiste unterhalb des Musik-Schalters oben rechts */
const BAR_Y = 54;
const LABEL_Y = BAR_Y + 24;
const QUESTION_TOP = LABEL_Y + 28;

export class QuestionScene extends BaseScene {
  private index = 0;
  private interlude = false;
  private content?: Phaser.GameObjects.Container;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressOrb!: Phaser.GameObjects.Image;
  private progressText!: Phaser.GameObjects.Text;
  private backText!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super('Question');
  }

  init() {
    const save = getSave();
    this.index = Phaser.Math.Clamp(save.current, 0, bank.items.length);
    // Nach der letzten Antwort (z. B. Seite neu geladen) direkt das Schluss-Zwischenspiel zeigen
    this.interlude = this.index >= bank.items.length;
    this.busy = false;
  }

  private get total() {
    return bank.items.length;
  }

  protected mood() {
    return (this.index / this.total) * 0.75;
  }

  protected build() {
    const { left, contentWidth, small } = this.m;
    this.progressBar = this.add.graphics();
    this.progressOrb = this.add.image(0, 0, glowTexture(this)).setScale(0.35).setTint(0xffe6a0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.progressOrb, alpha: { from: 0.6, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    this.progressText = this.add.text(left + contentWidth, LABEL_Y, '', textStyle(small, COLORS.textDim)).setOrigin(1, 0.5);
    this.backText = this.add
      .text(left, LABEL_Y, `‹ ${t('common.back')}`, textStyle(small, COLORS.textDim))
      .setOrigin(0, 0.5)
      .setPadding(6, 6, 6, 6)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.back());

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.interlude) {
        if (e.key === ' ' || e.key === 'Enter') this.leaveInterlude();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) this.answer(n);
      if (e.key === 'Backspace' || e.key === 'ArrowLeft') this.back();
    });
    this.input.on('pointerup', () => this.interlude && this.leaveInterlude());

    this.render(0);
  }

  private updateProgress() {
    const { left, contentWidth } = this.m;
    const answered = Math.min(this.index, this.total);
    const y = BAR_Y;
    const h = 8;
    const fill = (contentWidth * answered) / this.total;
    const g = this.progressBar;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(left, y - h / 2, contentWidth, h, 4);
    g.fillStyle(COLORS.gold, 0.9);
    if (fill > 0) g.fillRoundedRect(left, y - h / 2, Math.max(fill, h), h, 4);
    // Kleine Wegsteine an den Zwischenspielen
    for (let i = INTERLUDE_EVERY; i < this.total; i += INTERLUDE_EVERY) {
      g.fillStyle(i <= answered ? 0xffffff : COLORS.cream, i <= answered ? 0.9 : 0.35);
      g.fillCircle(left + (contentWidth * i) / this.total, y, 3);
    }
    this.progressOrb.setPosition(left + fill, y);
    this.progressText.setText(t('test.progress', { n: Math.min(this.index + 1, this.total), total: this.total }));
    this.progressText.setVisible(!this.interlude);
    this.backText.setVisible(!this.interlude && this.index > 0);
    this.backdrop.setMood(this.mood());
    ambient.setBrightness(this.mood());
  }

  /** Baut die aktuelle Frage bzw. das Zwischenspiel auf. direction: 1 vor, -1 zurück, 0 ohne Animation. */
  private render(direction: number) {
    const old = this.content;
    if (old) {
      this.tweens.add({
        targets: old,
        alpha: 0,
        x: -direction * 40,
        duration: 180,
        onComplete: () => old.destroy(),
      });
    }
    this.content = this.interlude ? this.buildInterlude() : this.buildQuestion();
    this.content.setAlpha(0).setX(direction * 40);
    this.tweens.add({ targets: this.content, alpha: 1, x: 0, duration: 260, delay: old ? 120 : 0, ease: 'Cubic.easeOut' });
    this.updateProgress();
  }

  private buildQuestion(): Phaser.GameObjects.Container {
    const { cx, height, contentWidth, font, large, gap } = this.m;
    const item = bank.items[this.index];
    const selected = getSave().answers[item.id];
    const c = this.add.container(0, 0);

    const labels = t.list('test.answers');
    const buttonWidth = Math.min(contentWidth, 420);
    const buttonHeight = Math.round(font * 2.3);
    const buttonsTop = height - 24 - labels.length * buttonHeight - (labels.length - 1) * gap;

    const stem = this.add.text(cx, 0, t('test.stem'), textStyle(font, COLORS.textDim)).setOrigin(0.5, 0);
    const text = this.add
      .text(cx, 0, item.text, {
        ...textStyle(large),
        align: 'center',
        lineSpacing: Math.round(large * 0.25),
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    // Frage mittig im freien Raum zwischen Fortschritt und Antworten
    const blockHeight = stem.height + gap + text.height;
    const top = Math.max(QUESTION_TOP, QUESTION_TOP + (buttonsTop - QUESTION_TOP - blockHeight) / 2);
    stem.setY(top);
    text.setY(top + stem.height + gap);
    c.add([stem, text]);

    labels.forEach((label, i) => {
      const value = i + 1;
      const b = new Button(this, cx, buttonsTop + buttonHeight / 2 + i * (buttonHeight + gap), label, {
        width: buttonWidth,
        height: buttonHeight,
        fontSize: font,
        onClick: () => this.answer(value),
      });
      if (selected === value) b.setSelected(true);
      c.add(b);
    });
    return c;
  }

  private buildInterlude(): Phaser.GameObjects.Container {
    const { cx, height, contentWidth, large, small } = this.m;
    const c = this.add.container(0, 0);
    const line = t(`test.interludes.${this.index}`);
    const text = this.add
      .text(cx, height * 0.45, line, {
        ...textStyle(large),
        align: 'center',
        lineSpacing: Math.round(large * 0.35),
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const hint = this.add.text(cx, height - 40, t('common.tapToContinue'), textStyle(small, COLORS.textDim)).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: { from: 0.3, to: 0.8 }, duration: 1000, yoyo: true, repeat: -1 });
    c.add([text, hint]);
    return c;
  }

  private answer(value: number) {
    if (this.busy || this.interlude) return;
    this.busy = true;
    const item = bank.items[this.index];
    const answers = { ...getSave().answers, [item.id]: value };
    this.index++;
    updateSave({ answers, current: this.index });
    // kurz die Auswahl zeigen, dann weiter
    this.time.delayedCall(140, () => {
      this.interlude = this.index % INTERLUDE_EVERY === 0;
      this.render(1);
      this.busy = false;
    });
  }

  private back() {
    if (this.busy || this.interlude || this.index === 0) return;
    this.index--;
    updateSave({ current: this.index });
    this.render(-1);
  }

  private leaveInterlude() {
    if (this.busy) return;
    if (this.index >= this.total) {
      this.finish();
      return;
    }
    this.interlude = false;
    this.render(1);
  }

  private finish() {
    const save = getSave();
    if (!isComplete(bank, save.answers)) {
      // Sollte nicht vorkommen; zur ersten offenen Frage springen
      const open = bank.items.findIndex((i) => save.answers[i.id] === undefined);
      this.index = Math.max(0, open);
      this.interlude = false;
      updateSave({ current: this.index });
      this.render(-1);
      return;
    }
    this.busy = true;
    const result = score(bank, save.answers, norms);
    const archetype = matchArchetype(result.z, archetypes);
    updateSave({ result, archetypeId: archetype.id });
    this.goTo('Reveal');
  }
}
