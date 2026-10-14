import Phaser from 'phaser';
import { archetypeById, capitalize, creatureText, t } from '../content';
import type { Archetype } from '../core/types';
import { getSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { PORTRAIT_SIZE, creatureTexture, glowTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, fitWidth, headingStyle, hexToInt, textStyle } from '../ui/theme';
import { Typewriter } from '../ui/typewriter';

export class RevealScene extends BaseScene {
  private revealed = false;
  private writer?: Typewriter;

  constructor() {
    super('Reveal');
  }

  init(data: { revealed?: boolean }) {
    this.revealed = data.revealed ?? false;
  }

  protected restartData() {
    return { revealed: this.revealed };
  }

  protected mood() {
    return this.revealed ? 1 : 0.8;
  }

  protected build() {
    const save = getSave();
    if (!save.archetypeId) {
      this.scene.start('Title');
      return;
    }
    const archetype = archetypeById(save.archetypeId);
    if (this.revealed) {
      this.showCreature(archetype, false);
      return;
    }

    const { cx, height, contentWidth, large } = this.m;
    const text = this.add
      .text(cx, height * 0.45, '', {
        ...textStyle(large),
        align: 'center',
        lineSpacing: Math.round(large * 0.35),
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    // Nach dem Text eine kurze Pause, dann von selbst enthüllen (oder früher per Antippen)
    this.writer = new Typewriter(this, text, t('reveal.wake'), () => {
      this.time.delayedCall(1800, () => this.startReveal(archetype, text));
    }, 35);
    this.input.on('pointerup', () => {
      if (this.writer && !this.writer.done) this.writer.finish();
      else this.startReveal(archetype, text);
    });
  }

  private startReveal(archetype: Archetype, text: Phaser.GameObjects.Text) {
    if (this.revealed) return;
    this.revealed = true;
    this.writer?.finish();
    this.tweens.add({ targets: text, alpha: 0, duration: 400 });
    this.backdrop.setMood(1);
    this.cameras.main.flash(900, 255, 248, 230);
    this.time.delayedCall(300, () => this.showCreature(archetype, true));
  }

  private showCreature(archetype: Archetype, animate: boolean) {
    const { cx, height, contentWidth, font, large, huge, small } = this.m;
    const size = Math.min(contentWidth * 0.5, height * 0.28);
    const scale = pixelScale(size);
    const y = height * 0.25;

    const aura = this.add.image(cx, y, glowTexture(this)).setTint(hexToInt(archetype.aura)).setBlendMode(Phaser.BlendModes.ADD);
    aura.setScale((PORTRAIT_SIZE * scale * 2.2) / 64);
    this.tweens.add({ targets: aura, alpha: { from: 0.5, to: 0.95 }, scale: aura.scale * 1.08, duration: 1600, yoyo: true, repeat: -1 });

    const creature = this.add.image(cx, y, creatureTexture(this, archetype)).setScale(scale);
    const species = creatureText(archetype.id, 'species');
    const title = this.add
      .text(cx, y + (PORTRAIT_SIZE * scale) / 2 + font, t('reveal.youAre', { article: creatureText(archetype.id, 'article'), species }), {
        ...headingStyle(huge),
        align: 'center',
        wordWrap: { width: contentWidth },
      })
      .setOrigin(0.5, 0);
    const tagline = this.add
      .text(cx, title.y + title.height + 4, capitalize(creatureText(archetype.id, 'tagline')), textStyle(large, COLORS.textDim))
      .setOrigin(0.5, 0);
    fitWidth(tagline, contentWidth);
    const description = this.add
      .text(cx, tagline.y + tagline.height + font, creatureText(archetype.id, 'description'), {
        ...textStyle(font),
        align: 'center',
        lineSpacing: Math.round(font * 0.3),
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    const voice = this.add
      .text(cx, description.y + description.height + font, t('reveal.voice'), {
        ...textStyle(small, COLORS.textDim),
        align: 'center',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    const buttonY = Math.min(height - 40, voice.y + voice.height + font * 2.2);
    const button = new Button(this, cx, buttonY, t('common.continue'), {
      width: Math.min(contentWidth, 280),
      fontSize: font,
      onClick: () => this.goTo('Partner'),
    });

    if (!animate) {
      idleBob(this, creature, scale);
      return;
    }
    creature.setScale(0).setAlpha(0);
    aura.setAlpha(0);
    this.tweens.add({
      targets: creature,
      scale,
      alpha: 1,
      duration: 900,
      ease: 'Back.easeOut',
      onComplete: () => idleBob(this, creature, scale),
    });
    this.tweens.add({ targets: aura, alpha: 0.8, duration: 1200 });
    const later = [title, tagline, description, voice, button];
    later.forEach((o) => o.setAlpha(0));
    later.forEach((o, i) => this.tweens.add({ targets: o, alpha: 1, duration: 600, delay: 900 + i * 700 }));
  }
}
