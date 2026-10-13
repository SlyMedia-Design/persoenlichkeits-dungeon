import { archetypeById, creatureText, t } from '../content';
import { getSave, updateSave } from '../state';
import { BaseScene } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { creatureTexture, idleBob, pixelScale } from '../ui/sprites';
import { COLORS, textStyle } from '../ui/theme';

const MAX_LENGTH = 14;

export class NameScene extends BaseScene {
  private step: 'player' | 'partner' = 'player';

  constructor() {
    super('Names');
  }

  init(data: { step?: 'player' | 'partner' }) {
    this.step = data.step ?? 'player';
  }

  protected restartData() {
    return { step: this.step };
  }

  protected mood() {
    return 1;
  }

  protected build() {
    const save = getSave();
    if (!save.archetypeId || !save.partnerId) {
      this.scene.start('Title');
      return;
    }
    const { cx, height, contentWidth, font, large, small } = this.m;
    const id = this.step === 'player' ? save.archetypeId : save.partnerId;
    const archetype = archetypeById(id);

    const scale = pixelScale(Math.min(contentWidth * 0.4, height * 0.2));
    const spriteY = height * 0.2;
    const sprite = this.add.image(cx, spriteY, creatureTexture(this, archetype)).setScale(scale);
    idleBob(this, sprite, scale);

    const question =
      this.step === 'player'
        ? t('names.player')
        : t('names.partner', { article: creatureText(id, 'article'), species: creatureText(id, 'species') });
    const label = this.add
      .text(cx, spriteY + 8 * scale + font * 1.5, question, {
        ...textStyle(large),
        align: 'center',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.maxLength = MAX_LENGTH;
    input.placeholder = t('names.placeholder');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = (this.step === 'player' ? save.playerName : save.partnerName) ?? '';
    const inputY = label.y + label.height + font * 2;
    this.add.dom(cx, inputY, input);

    const error = this.add.text(cx, inputY + font * 2, '', textStyle(small, COLORS.textGold)).setOrigin(0.5, 0);

    const submit = () => {
      const name = input.value.trim().slice(0, MAX_LENGTH);
      if (!name) {
        error.setText(t('names.empty'));
        input.focus();
        return;
      }
      input.blur();
      if (this.step === 'player') {
        updateSave({ playerName: name });
        this.goTo('Names', { step: 'partner' });
      } else {
        updateSave({ partnerName: name });
        this.goTo('Ending');
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    new Button(this, cx, inputY + font * 5, t('common.confirm'), {
      width: Math.min(contentWidth, 260),
      fontSize: font,
      onClick: submit,
    });
    // Auf dem Handy nicht sofort die Tastatur aufklappen
    if (window.matchMedia('(pointer: fine)').matches) this.time.delayedCall(450, () => input.focus());
  }
}
