import { bank, t } from '../content';
import { Button } from '../ui/Button';
import { COLORS, textStyle } from '../ui/theme';
import { NarrationScene } from './NarrationScene';

export class IntroScene extends NarrationScene {
  constructor() {
    super('Intro');
  }

  protected mood() {
    return 0;
  }

  protected lines() {
    return t.list('intro.lines');
  }

  protected onFinished() {
    const { cx, height, font, small, contentWidth } = this.m;
    const y = Math.min(height * 0.45 + this.narration.height / 2 + font * 3, height - font * 6);
    const info = this.add.text(cx, y, t('intro.info', { n: bank.items.length, minutes: Math.ceil((bank.items.length * 12) / 60) }), textStyle(small, COLORS.textDim)).setOrigin(0.5).setAlpha(0);
    const button = new Button(this, cx, y + font * 2.8, t('intro.begin'), {
      width: Math.min(contentWidth, 300),
      fontSize: font,
      onClick: () => this.goTo('Question'),
    }).setAlpha(0);
    this.tweens.add({ targets: [info, button], alpha: 1, duration: 600 });
  }
}
