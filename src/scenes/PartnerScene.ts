import Phaser from 'phaser';
import { archetypes, capitalize, creatureText, t } from '../content';
import { suggestPartner } from '../core/matching';
import type { Archetype } from '../core/types';
import { getSave, updateSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { creatureTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, textStyle } from '../ui/theme';

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
    const suggested = suggestPartner(save.result.z, archetypes, save.archetypeId);
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
    const bg = this.add.graphics({ x, y });
    const card: Card = { archetype, bg, w, h, x, y };
    this.cards.push(card);

    const labelSize = Math.min(small, Math.round(w / 9));
    const nameSize = Math.min(font, Math.round(labelSize * 1.2));
    const taglineSize = Math.round(labelSize * 0.85);
    // Platz für Name + bis zu zwei Zeilen Untertitel
    const textBlock = nameSize * 1.4 + taglineSize * 2.8 + 10;
    const spriteArea = h - textBlock;
    const scale = pixelScale(Math.min(w * 0.6, spriteArea - 20));
    const sprite = this.add.image(x, y - h / 2 + spriteArea / 2 + 4, creatureTexture(this, archetype)).setScale(scale);
    idleBob(this, sprite, Math.max(1, scale / 2));
    const name = this.add
      .text(x, y - h / 2 + spriteArea, creatureText(archetype.id, 'species'), textStyle(nameSize))
      .setOrigin(0.5, 0);
    this.add
      .text(x, name.y + name.height + 2, creatureText(archetype.id, 'tagline'), {
        ...textStyle(taglineSize, COLORS.textDim),
        align: 'center',
        wordWrap: { width: w - 12, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    if (archetype.id === this.suggestedId) {
      this.add
        .text(x, y - h / 2, t('partner.suggested'), {
          ...textStyle(Math.round(labelSize * 0.85), '#1a1830'),
          backgroundColor: COLORS.textGold,
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0.5);
    }

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      this.selectedId = archetype.id;
      this.redrawCards();
    });
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
