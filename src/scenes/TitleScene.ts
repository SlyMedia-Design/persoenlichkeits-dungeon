import { t } from '../content';
import { getSave, resetSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { COLORS, textStyle } from '../ui/theme';

export class TitleScene extends BaseScene {
  private confirming = false;

  constructor() {
    super('Title');
  }

  init(data: { confirming?: boolean }) {
    this.confirming = data.confirming ?? false;
  }

  protected restartData() {
    return { confirming: this.confirming };
  }

  protected mood() {
    return 0.15;
  }

  protected build() {
    const { cx, height, huge, font, small, contentWidth } = this.m;
    const title = this.add
      .text(cx, height * 0.3, t('meta.title'), {
        ...textStyle(huge, COLORS.textGold),
        align: 'center',
        wordWrap: { width: contentWidth },
      })
      .setOrigin(0.5);
    // Ein langes Wort lässt sich nicht umbrechen: notfalls die Schrift verkleinern
    if (title.width > contentWidth) title.setFontSize(Math.floor((huge * contentWidth) / title.width));
    this.tweens.add({ targets: title, y: title.y - 6, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(cx, title.y + title.height / 2 + font, t('meta.subtitle'), textStyle(font, COLORS.textDim)).setOrigin(0.5, 0);

    const save = getSave();
    const started = Object.keys(save.answers).length > 0;
    const width = Math.min(contentWidth, 320);
    let y = height * 0.58;
    const add = (label: string, onClick: () => void) => {
      const b = new Button(this, cx, y, label, { width, fontSize: font, onClick });
      y += b.buttonHeight + this.m.gap;
      return b;
    };

    if (this.confirming) {
      this.add
        .text(cx, y - font * 3, t('title.restartConfirm'), {
          ...textStyle(font),
          align: 'center',
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 1);
      add(t('common.confirm'), () => {
        resetSave();
        this.goTo('Intro');
      });
      add(t('common.cancel'), () => this.scene.restart({ confirming: false }));
    } else if (save.result && save.playerName) {
      add(t('title.profile'), () => this.goTo('Profile', { from: 'Title' }));
      add(t('title.start'), () => this.scene.restart({ confirming: true }));
    } else if (started) {
      add(t('title.resume'), () => this.goTo(resumeScene()));
      add(t('title.start'), () => this.scene.restart({ confirming: true }));
    } else {
      add(t('title.start'), () => this.goTo('Intro'));
    }

    this.add
      .text(cx, height - 24, t('title.privacy'), { ...textStyle(small, COLORS.textDim), align: 'center', wordWrap: { width: contentWidth } })
      .setOrigin(0.5, 1);
  }
}

/** Wohin „Fortsetzen“ führt, je nachdem wie weit der Spielstand ist. */
function resumeScene(): string {
  const save = getSave();
  if (!save.result) return 'Question';
  if (!save.partnerId) return 'Reveal';
  if (!save.playerName || !save.partnerName) return 'Names';
  return 'Ending';
}
