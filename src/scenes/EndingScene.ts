import Phaser from 'phaser';
import { archetypeById, t } from '../content';
import { shareText } from '../core/save';
import { getSave, updateSave } from '../state';
import { Button } from '../ui/Button';
import { copyToClipboard } from '../ui/share';
import { PORTRAIT_SIZE, creatureTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, fitWidth, headingStyle, textStyle } from '../ui/theme';
import { NarrationScene } from './NarrationScene';

export class EndingScene extends NarrationScene {
  constructor() {
    super('Ending');
  }

  protected mood() {
    return 0.9;
  }

  protected build() {
    const save = getSave();
    if (!save.archetypeId || !save.partnerId || !save.playerName || !save.partnerName) {
      this.scene.start('Title');
      return;
    }
    // Die beiden Freunde nebeneinander am unteren Rand
    const { cx, height, contentWidth } = this.m;
    const scale = pixelScale(Math.min(contentWidth * 0.22, height * 0.12));
    const y = height * 0.18;
    const player = this.add.image(cx - PORTRAIT_SIZE * 0.75 * scale, y, creatureTexture(this, archetypeById(save.archetypeId))).setScale(scale);
    const partner = this.add
      .image(cx + PORTRAIT_SIZE * 0.75 * scale, y, creatureTexture(this, archetypeById(save.partnerId)))
      .setScale(scale)
      .setFlipX(true);
    idleBob(this, player, scale);
    this.time.delayedCall(400, () => idleBob(this, partner, scale));
    super.build();
  }

  protected lines() {
    const save = getSave();
    return t.list('ending.lines').map((line) =>
      line.replace(/\{player\}/g, save.playerName ?? '').replace(/\{partner\}/g, save.partnerName ?? ''),
    );
  }

  protected onFinished() {
    if (!getSave().completedAt) updateSave({ completedAt: new Date().toISOString() });
    const { cx, height, font, huge, small, contentWidth, gap } = this.m;
    this.tweens.add({ targets: this.narration, alpha: 0, duration: 500 });

    const end = this.add.text(cx, height * 0.36, t('ending.end'), headingStyle(huge)).setOrigin(0.5).setAlpha(0);
    fitWidth(end, contentWidth);
    const next = this.add.text(cx, end.y + huge, t('ending.next'), textStyle(font, COLORS.textDim)).setOrigin(0.5).setAlpha(0);

    const width = Math.min(contentWidth, 300);
    let y = next.y + font * 3;
    const status = this.add
      .text(cx, height - 16, '', { ...textStyle(small, COLORS.textDim), align: 'center', wordWrap: { width: contentWidth } })
      .setOrigin(0.5, 1);
    const buttons: Phaser.GameObjects.GameObject[] = [];
    const add = (label: string, onClick: () => void) => {
      const b = new Button(this, cx, y, label, { width, fontSize: font, onClick });
      y += b.buttonHeight + gap;
      buttons.push(b.setAlpha(0));
    };
    add(t('ending.village'), () => this.goTo('Village'));
    add(t('ending.profile'), () => this.goTo('Profile', { from: 'Ending' }));
    add(t('ending.share'), () => void shareResult(status));
    add(t('ending.restart'), () => this.goTo('Title', { confirming: true }));

    [end, next, ...buttons].forEach((o, i) => this.tweens.add({ targets: o, alpha: 1, duration: 700, delay: 300 + i * 250 }));
  }
}

export async function shareResult(status: Phaser.GameObjects.Text) {
  const result = getSave().result;
  if (!result) return;
  const labels = { O: 'O', C: 'C', E: 'E', A: 'A', N: 'N' };
  const text = shareText(result.means, labels, t('ending.shareHeader'));
  const ok = await copyToClipboard(text);
  status.setText(ok ? t('ending.shared') : `${t('ending.shareFailed')}\n${text}`);
}
