import Phaser from 'phaser';
import { t, village } from '../content';
import { acceptQuest, questStatus } from '../core/village';
import { getSave, updateSave } from '../state';
import { HudScene } from '../ui/HudScene';
import { itemKey } from '../ui/tiles';
import { COLORS, headingStyle, textStyle } from '../ui/theme';
import { shareResult } from './EndingScene';

type Mode = { kind: 'board'; note?: string } | { kind: 'menu' };

const STATUS_LABEL: Record<string, string> = {
  accepted: 'village.board.accepted',
  ready: 'village.board.ready',
  done: 'village.board.done',
};

/** Bedienoberfläche über dem Dorf: Dialoge, Schwarzes Brett, Menü, Hinweise. */
export class VillageHudScene extends HudScene<Mode> {
  constructor() {
    super('VillageHud');
  }

  openBoard() {
    this.setMode({ kind: 'board' });
  }

  protected hintText(touch: boolean) {
    return t(touch ? 'village.hintTouch' : 'village.hintKeys');
  }

  protected escapeIdle() {
    this.setMode({ kind: 'menu' });
  }

  protected drawTop() {
    const { small, font } = this.m;
    const menu = this.button(12 + 50, 10 + font, t('village.menu.open'), { width: 100, height: Math.round(font * 1.9), fontSize: small }, () => {
      if (!this.busy) this.setMode({ kind: 'menu' });
    });
    this.layer!.add(menu);
    // Münzen neben dem Menü-Knopf
    const coinX = 12 + 100 + 14;
    const coin = this.add.image(coinX, 10 + font, itemKey('coin')).setOrigin(0, 0.5).setScale(3);
    const money = this.add.text(coin.x + coin.displayWidth + 6, coin.y, t('village.money', { n: getSave().money ?? 0 }), textStyle(small)).setOrigin(0, 0.5);
    this.layer!.add([coin, money]);
  }

  protected drawMode(mode: Mode) {
    if (mode.kind === 'board') this.drawBoard(mode.note);
    else this.drawMenu();
  }

  private drawMenu() {
    let status: Phaser.GameObjects.Text;
    this.drawPanel(t('village.menu.title'), (b) => {
      b.button(t('village.menu.profile'), () => this.onLeave?.('Profile', { from: 'Village' }));
      b.button(t('village.menu.share'), () => void shareResult(status));
      b.button(t('village.menu.toTitle'), () => this.onLeave?.('Title'));
      b.button(t('village.menu.close'), () => this.close());
      // Platz für den Kopiertext beim Teilen
      status = b.text('', { color: COLORS.textDim });
      b.gap(this.m.small * 2);
    });
  }

  private drawBoard(note?: string) {
    const { width, height, contentWidth, font, small, gap } = this.m;
    const log = getSave().quests ?? {};
    const pad = Math.round(font * 0.8);
    const innerW = contentWidth - pad * 2;
    const panel = this.add.container((width - contentWidth) / 2, 0);
    const items: Phaser.GameObjects.GameObject[] = [];
    let y = pad;

    const title = this.add.text(contentWidth / 2, y, t('village.board.title'), headingStyle(Math.round(font * 1.25))).setOrigin(0.5, 0);
    items.push(title);
    y += title.height + gap;

    for (const { id } of village.def.quests) {
      const status = questStatus(log, id);
      const cardTop = y;
      const cardPad = Math.round(pad * 0.75);
      const tx = pad + cardPad;
      const tw = innerW - cardPad * 2;
      const card = this.add.graphics();
      items.push(card);
      const wrap = { width: tw, useAdvancedWrap: true };
      const qTitle = this.add.text(tx, y + cardPad, t(`village.quests.${id}.title`), { ...headingStyle(font, COLORS.textGold), wordWrap: wrap });
      y = qTitle.y + qTitle.height + 4;
      const body = this.add.text(tx, y, t(`village.quests.${id}.text`), { ...textStyle(small), wordWrap: wrap, lineSpacing: 3 });
      y = body.y + body.height + 4;
      const meta = this.add.text(
        tx,
        y,
        `${t('village.board.from', { from: t(`village.quests.${id}.from`) })}\n${t('village.board.reward')}`,
        { ...textStyle(small, COLORS.textDim), wordWrap: wrap, lineSpacing: 3 },
      );
      y = meta.y + meta.height + gap * 0.7;
      items.push(qTitle, body, meta);
      const btnH = Math.round(small * 2.2);
      if (status === 'open') {
        const accept = this.button(pad + innerW - cardPad - 80, y + btnH / 2, t('village.board.accept'), { width: 160, height: btnH, fontSize: small, fill: 0x4a6a3a }, () => {
          updateSave({ quests: acceptQuest(getSave().quests ?? {}, id) });
          this.setMode({ kind: 'board', note: t('village.board.acceptedNote') });
        });
        items.push(accept);
      } else {
        const label = this.add.text(pad + innerW - cardPad, y + btnH / 2, t(STATUS_LABEL[status]), headingStyle(small, '#bfe3a0')).setOrigin(1, 0.5);
        items.push(label);
      }
      y += btnH + cardPad;
      card.fillStyle(COLORS.panelLight, 1).fillRoundedRect(pad, cardTop, innerW, y - cardTop, 8);
      card.lineStyle(2, COLORS.cream, 0.35).strokeRoundedRect(pad, cardTop, innerW, y - cardTop, 8);
      y += gap;
    }

    if (note) {
      const n = this.add.text(contentWidth / 2, y, note, { ...textStyle(small, COLORS.textGold), align: 'center', wordWrap: { width: innerW } }).setOrigin(0.5, 0);
      items.push(n);
      y += n.height + gap;
    }
    const closeH = Math.round(font * 2.2);
    items.push(this.button(contentWidth / 2, y + closeH / 2, t('village.board.close'), { width: Math.min(innerW, 240), height: closeH }, () => this.close()));
    y += closeH + pad;

    panel.add([this.panel(0, 0, contentWidth, y), ...items]);
    panel.y = Math.max(8, (height - y) / 2);
    this.layer!.add([this.overlay(), panel]);
  }
}
