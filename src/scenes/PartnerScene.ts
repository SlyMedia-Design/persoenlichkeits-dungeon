import Phaser from 'phaser';
import { archetypes, capitalize, creatureElements, creatureText, t } from '../content';
import { suggestPartner } from '../core/matching';
import type { Archetype } from '../core/types';
import { getSave, updateSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { elementColor, elementName, elementTexture } from '../ui/elements';
import { creatureTexture, glowTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, fitWidth, headingStyle, textStyle } from '../ui/theme';

interface Card {
  archetype: Archetype;
  bg: Phaser.GameObjects.Graphics;
  w: number;
  h: number;
  x: number;
  y: number;
}

export class PartnerScene extends BaseScene {
  private selectedId?: string;
  private cards: Card[] = [];
  private suggestedId = '';

  constructor() {
    super('Partner');
  }

  init(data: { selectedId?: string }) {
    this.selectedId = data.selectedId;
    this.cards = [];
  }

  protected restartData() {
    return { selectedId: this.selectedId };
  }

  protected mood() {
    return 1;
  }

  protected build() {
    const save = getSave();
    if (!save.result || !save.archetypeId) {
      this.scene.start('Title');
      return;
    }
    const { cx, width, height, contentWidth, left, font, small, gap } = this.m;
    const suggested = suggestPartner(save.result.z, archetypes, save.archetypeId, creatureElements);
    this.suggestedId = suggested.id;
    this.selectedId ??= suggested.id;

    const wrap = { width: contentWidth, useAdvancedWrap: true };
    const intro = this.add
      .text(cx, 48, t('partner.intro'), { ...textStyle(small), align: 'center', wordWrap: wrap, lineSpacing: 4 })
      .setOrigin(0.5, 0);
    const suggestion = this.add
      .text(
        cx,
        intro.y + intro.height + gap,
        t('partner.suggest', {
          article: capitalize(creatureText(suggested.id, 'article')),
          species: creatureText(suggested.id, 'species'),
        }),
        { ...textStyle(small, COLORS.textGold), align: 'center', wordWrap: wrap, lineSpacing: 4 },
      )
      .setOrigin(0.5, 0);
    const prompt = this.add
      .text(cx, suggestion.y + suggestion.height + gap, t('partner.choose'), textStyle(font))
      .setOrigin(0.5, 0);

    // Karten: 4 nebeneinander auf breiten, 2×2 auf schmalen Bildschirmen
    const columns = width >= 700 ? 4 : 2;
    const rows = Math.ceil(archetypes.length / columns);
    const top = prompt.y + prompt.height + gap;
    const buttonSpace = font * 3.6;
    const cardW = (contentWidth - gap * (columns - 1)) / columns;
    const cardH = Math.min((height - top - buttonSpace - gap * (rows - 1)) / rows, cardW * 1.5);
    archetypes.forEach((a, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      this.addCard(a, left + col * (cardW + gap) + cardW / 2, top + row * (cardH + gap) + cardH / 2, cardW, cardH);
    });

    new Button(this, cx, height - buttonSpace / 2, t('partner.pick'), {
      width: Math.min(contentWidth, 280),
      fontSize: font,
      onClick: () => {
        updateSave({ partnerId: this.selectedId });
        this.goTo('Names');
      },
    });
    this.redrawCards();
  }

  private addCard(archetype: Archetype, x: number, y: number, w: number, h: number) {
    const { small, font } = this.m;
    if (archetype.id === this.suggestedId) {
      // Sanfter goldener Schimmer hinter der vorgeschlagenen Karte
      const glow = this.add
        .image(x, y, glowTexture(this))
        .setDisplaySize(w * 1.5, h * 1.35)
        .setTint(COLORS.gold)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.25);
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const bg = this.add.graphics({ x, y });
    const card: Card = { archetype, bg, w, h, x, y };
    this.cards.push(card);

    const labelSize = Math.min(small, Math.round(w / 9));
    const nameSize = Math.min(font, Math.round(labelSize * 1.2));
    const taglineSize = Math.round(labelSize * 0.85);
    // Platz für Name + bis zu zwei Zeilen Untertitel + Element
    const textBlock = nameSize * 1.4 + taglineSize * 2.8 + 10 + (taglineSize >= 16 ? 32 : 16) + 4;
    const spriteArea = h - textBlock;
    const scale = pixelScale(Math.min(w * 0.8, spriteArea - 6));
    const sprite = this.add.image(x, y - h / 2 + spriteArea / 2 + 4, creatureTexture(this, archetype)).setScale(scale);
    idleBob(this, sprite, Math.max(1, scale / 2));
    const name = fitWidth(
      this.add
        .text(x, y - h / 2 + spriteArea, creatureText(archetype.id, 'species'), headingStyle(nameSize, COLORS.text))
        .setOrigin(0.5, 0),
      w - 12,
    );
    this.add
      .text(x, name.y + name.height + 2, creatureText(archetype.id, 'tagline'), {
        ...textStyle(taglineSize, COLORS.textDim),
        align: 'center',
        wordWrap: { width: w - 12, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.addElement(archetype.id, x - w / 2 + 8, y + h / 2 - 8, taglineSize);
    if (archetype.id === this.suggestedId) this.addBadge(x, y - h / 2, w, labelSize);

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      this.selectedId = archetype.id;
      this.redrawCards();
    });
  }

  /** Element des Wesens unten links in der Karte: Icon und Name */
  private addElement(id: string, left: number, bottom: number, size: number) {
    const element = creatureElements.of[id];
    if (!element) return;
    const scale = size >= 16 ? 2 : 1;
    const icon = this.add.image(left, bottom, elementTexture(this, element)).setOrigin(0, 1).setScale(scale);
    this.add.text(left + icon.displayWidth + 4, bottom - icon.displayHeight / 2, elementName(element), textStyle(size, elementColor(element))).setOrigin(0, 0.5);
  }

  /** Abzeichen über der vorgeschlagenen Karte: Pixelstern + Text auf goldenem Schild */
  private addBadge(x: number, y: number, cardW: number, labelSize: number) {
    const size = Math.max(13, Math.round(labelSize * 0.9));
    const label = this.add.text(0, 0, t('partner.suggested'), headingStyle(size, '#2a1f10', { shadow: undefined })).setOrigin(0, 0.5);
    const px = Math.max(2, Math.round(size / 7)); // Kantenlänge eines Stern-Pixels
    const starW = px * 5;
    const padX = Math.round(size * 0.55);
    const gapX = Math.round(size * 0.35);
    const w = Math.min(cardW - 8, padX * 2 + starW + gapX + label.width);
    const h = Math.round(size * 1.7);
    if (padX * 2 + starW + gapX + label.width > w) fitWidth(label, w - padX * 2 - starW - gapX);

    const g = this.add.graphics();
    g.fillStyle(0x120f22, 0.45).fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, h / 2);
    g.fillStyle(COLORS.gold, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(0xfff0c0, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, Math.max(2, h * 0.22), h * 0.11);
    g.lineStyle(2, 0x5a3a14, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    // Pixelstern (5×5)
    const star = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
    const sx = -w / 2 + padX;
    star.forEach((row, r) =>
      [...row].forEach((c, k) => {
        if (c === '#') g.fillStyle(0xfffbe8, 1).fillRect(sx + k * px, -starW / 2 + r * px, px, px);
      }),
    );
    label.setPosition(sx + starW + gapX, 0);
    const badge = this.add.container(x, y, [g, label]);
    this.tweens.add({ targets: badge, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private redrawCards() {
    for (const { archetype, bg, w, h } of this.cards) {
      const selected = archetype.id === this.selectedId;
      bg.clear();
      bg.fillStyle(0x000000, 0.3);
      bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 8);
      bg.fillStyle(selected ? COLORS.panelLight : COLORS.panel, 0.92);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : COLORS.cream, selected ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    }
  }
}
