import Phaser from 'phaser';
import { archetypeById, capitalize, creatureText, t } from '../content';
import { band, normalCdf } from '../core/scoring';
import { DIMENSIONS, type Dimension } from '../core/types';
import { getSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { PORTRAIT_SIZE, creatureTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, headingStyle, hexToInt, textStyle } from '../ui/theme';
import { shareResult } from './EndingScene';

/** Volles Big-Five-Profil mit Erklärungen. Scrollbar per Wischen, Mausrad oder Pfeiltasten. */
export class ProfileScene extends BaseScene {
  constructor() {
    super('Profile');
  }

  protected mood() {
    return 0.55;
  }

  protected build() {
    const save = getSave();
    if (!save.result || !save.archetypeId) {
      this.scene.start('Title');
      return;
    }
    const { cx, left, contentWidth, font, large, small, gap, height } = this.m;
    const wrap = { width: contentWidth, useAdvancedWrap: true };
    const archetype = archetypeById(save.archetypeId);

    let y = 56;
    this.add.text(cx, y, t('profile.title'), headingStyle(large)).setOrigin(0.5, 0);
    y += large + gap * 2;

    const scale = pixelScale(Math.min(96, contentWidth * 0.25));
    const sprite = this.add.image(cx, y + (PORTRAIT_SIZE / 2) * scale, creatureTexture(this, archetype)).setScale(scale);
    idleBob(this, sprite, Math.max(1, scale / 2));
    y += PORTRAIT_SIZE * scale + gap;

    const article = creatureText(archetype.id, 'article');
    const species = creatureText(archetype.id, 'species');
    const who = save.playerName ? t('profile.creature', { player: save.playerName, article, species }) : species;
    y = this.line(cx, y, who, textStyle(font), wrap) + 2;
    y = this.line(cx, y, capitalize(creatureText(archetype.id, 'tagline')), textStyle(small, COLORS.textDim), wrap);
    if (save.partnerId && save.partnerName) {
      y += 4;
      y = this.line(
        cx,
        y,
        t('profile.partnerLine', {
          partner: save.partnerName,
          article: creatureText(save.partnerId, 'article'),
          species: creatureText(save.partnerId, 'species'),
        }),
        textStyle(small, COLORS.textDim),
        wrap,
      );
    }
    y += gap * 2;

    for (const d of DIMENSIONS) y = this.dimensionBlock(d, save.result.z[d], y, hexToInt(archetype.color)) + gap * 2;

    y = this.line(cx, y, t('profile.disclaimer'), { ...textStyle(small, COLORS.textDim), align: 'center', lineSpacing: 4 }, wrap);
    y += gap * 2;

    const status = this.add
      .text(cx, 0, '', { ...textStyle(small, COLORS.textDim), align: 'center', wordWrap: wrap })
      .setOrigin(0.5, 0);
    const shareButton = new Button(this, cx, 0, t('ending.share'), {
      width: Math.min(contentWidth, 280),
      fontSize: font,
      onClick: () => void shareResult(status).then(() => this.updateBounds(status.y + status.height + 24)),
    });
    shareButton.setY(y + shareButton.buttonHeight / 2);
    y += shareButton.buttonHeight + gap;
    status.setY(y);
    y += small * 2 + gap;

    y = this.line(cx, y, t('credits.title'), headingStyle(small), wrap) + 4;
    for (const credit of t.list('credits.lines')) {
      y = this.line(cx, y, credit, { ...textStyle(Math.round(small * 0.9), COLORS.textDim), align: 'center' }, wrap) + 2;
    }
    this.updateBounds(y + 32);

    // Fester Schließen-Knopf auf einem Streifen, damit gescrollter Inhalt darunter verschwindet
    this.add
      .graphics()
      .fillStyle(COLORS.night, 0.92)
      .fillRect(0, 0, this.m.width, 48)
      .setScrollFactor(0)
      .setDepth(99);
    this.add
      .text(left, 14, `‹ ${t('profile.close')}`, textStyle(small, COLORS.textDim))
      .setPadding(6, 6, 6, 6)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.goTo('Title'));

    this.enableScrolling(height);
  }

  private line(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle, wrap: object) {
    const obj = this.add.text(x, y, text, { align: 'center', ...style, wordWrap: wrap }).setOrigin(0.5, 0);
    return y + obj.height;
  }

  private dimensionBlock(d: Dimension, z: number, y: number, accent: number): number {
    const { left, contentWidth, font, small } = this.m;
    const wrap = { width: contentWidth, useAdvancedWrap: true };
    this.add.text(left, y, t(`dimensions.${d}.name`), headingStyle(font));
    y += font + 6;
    const about = this.add.text(left, y, t(`dimensions.${d}.about`), { ...textStyle(small, COLORS.textDim), wordWrap: wrap });
    y += about.height + 8;

    // Balken: Position = Anteil der Vergleichsgruppe mit niedrigerem Wert
    const pct = normalCdf(z);
    const barH = 12;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(left, y, contentWidth, barH, 6);
    g.fillStyle(accent, 0.9);
    g.fillRoundedRect(left, y, Math.max(barH, contentWidth * pct), barH, 6);
    g.lineStyle(2, COLORS.cream, 0.7);
    g.lineBetween(left + contentWidth / 2, y - 3, left + contentWidth / 2, y + barH + 3);
    y += barH + 6;
    const percent = Math.round(Phaser.Math.Clamp(pct * 100, 1, 99));
    const pctText = this.add.text(left, y, t('profile.percentile', { pct: percent }), {
      ...textStyle(Math.round(small * 0.9), COLORS.textDim),
      wordWrap: wrap,
    });
    y += pctText.height + 6;
    const desc = this.add.text(left, y, t(`dimensions.${d}.${band(z)}`), { ...textStyle(small), wordWrap: wrap, lineSpacing: 3 });
    return y + desc.height;
  }

  private updateBounds(contentHeight: number) {
    this.cameras.main.setBounds(0, 0, this.m.width, Math.max(contentHeight, this.m.height));
  }

  private enableScrolling(viewHeight: number) {
    const cam = this.cameras.main;
    let lastY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (lastY = p.y));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollY += lastY - p.y;
      lastY = p.y;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => (cam.scrollY += dy * 0.6));
    this.input.keyboard?.on('keydown-DOWN', () => (cam.scrollY += viewHeight * 0.2));
    this.input.keyboard?.on('keydown-UP', () => (cam.scrollY -= viewHeight * 0.2));
  }
}
