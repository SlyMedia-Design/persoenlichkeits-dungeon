import Phaser from 'phaser';
import { t, village } from '../content';
import { acceptQuest, questStatus } from '../core/village';
import { getSave, updateSave } from '../state';
import { addSoundToggle } from '../ui/BaseScene';
import { Button } from '../ui/Button';
import { Typewriter } from '../ui/typewriter';
import { COLORS, headingStyle, metrics, textStyle, type Metrics } from '../ui/theme';
import { shareResult } from './EndingScene';

interface Dialog {
  speaker?: string;
  /** Textur des Gesichtsbilds neben dem Text */
  portrait?: string;
  lines: string[];
  index: number;
  /** Aktuelle Zeile ist fertig geschrieben (bei Neuaufbau nicht erneut tippen) */
  typed: boolean;
  onDone?: () => void;
}

type Mode = { kind: 'none' } | { kind: 'dialog'; dialog: Dialog } | { kind: 'board'; note?: string } | { kind: 'menu' };

const HINT_MS = 8000;

/**
 * Bedienoberfläche über dem Dorf: Dialoge, Schwarzes Brett, Menü, Hinweise.
 * Läuft als eigene Szene, damit sie vom Kamera-Zoom der Karte unabhängig bleibt.
 */
export class VillageHudScene extends Phaser.Scene {
  private mode: Mode = { kind: 'none' };
  private layer?: Phaser.GameObjects.Container;
  private m!: Metrics;
  private typewriter?: Typewriter;
  private hintUntil = 0;
  private hintPending = false;
  /** Zuletzt von der Oberfläche verbrauchte Berührung (dasselbe Browser-Ereignis sieht auch das Dorf) */
  private consumedEvent?: Event;
  /** Wird vom Dorf gesetzt: Szene verlassen (Profil, Titel) */
  onLeave?: (key: string, data?: object) => void;

  constructor() {
    super('VillageHud');
  }

  get busy(): boolean {
    return this.mode.kind !== 'none';
  }

  create() {
    this.mode = { kind: 'none' };
    this.hintUntil = 0;
    this.hintPending = false;
    this.render();
    const onResize = () => this.render();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this.advance();
      if (e.code === 'Escape') {
        if (this.mode.kind === 'dialog') this.endDialog(this.mode.dialog);
        else this.setMode(this.busy ? { kind: 'none' } : { kind: 'menu' });
      }
    });
  }

  /** Jemand spricht: mehrere Sätze nacheinander, weiter per Tippen oder Leertaste. */
  say(speaker: string | undefined, lines: string[], onDone?: () => void, portrait?: string) {
    this.setMode({ kind: 'dialog', dialog: { speaker, portrait, lines, index: 0, typed: false, onDone } });
  }

  openBoard() {
    this.setMode({ kind: 'board' });
  }

  /** Steuerungshinweis für einige Sekunden (wartet, bis kein Dialog mehr offen ist). */
  showHint() {
    if (this.busy) {
      this.hintPending = true;
      return;
    }
    this.hintUntil = this.time.now + HINT_MS;
    this.render();
    // Nur neu zeichnen, wenn nichts anderes offen ist (sonst würde ein Dialog neu getippt)
    this.time.delayedCall(HINT_MS + 50, () => !this.busy && this.render());
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.render();
    if (mode.kind === 'none' && this.hintPending) {
      this.hintPending = false;
      this.showHint();
    }
  }

  private consume() {
    this.consumedEvent = this.input.activePointer.event;
  }

  /** Hat die Oberfläche diese Berührung schon verarbeitet? */
  consumed(pointer: Phaser.Input.Pointer): boolean {
    return !!pointer.event && pointer.event === this.consumedEvent;
  }

  private advance() {
    if (this.mode.kind !== 'dialog') return;
    const dialog = this.mode.dialog;
    if (this.typewriter && !this.typewriter.done) {
      this.typewriter.finish();
      return;
    }
    dialog.index++;
    dialog.typed = false;
    if (dialog.index >= dialog.lines.length) this.endDialog(dialog);
    else this.render();
  }

  private endDialog(dialog: Dialog) {
    this.setMode({ kind: 'none' });
    dialog.onDone?.();
  }

  /** Baut die ganze Oberfläche neu auf (auch nach Größenänderung). */
  private render() {
    this.typewriter?.destroy();
    this.typewriter = undefined;
    // Endlos-Animationen (Pfeil im Dialog) gehören zu den alten Elementen
    this.tweens.killAll();
    this.layer?.destroy(true);
    this.m = metrics(this);
    this.layer = this.add.container();

    const { small, font } = this.m;
    const menu = new Button(this, 12 + 50, 10 + font, t('village.menu.open'), {
      width: 100,
      height: Math.round(font * 1.9),
      fontSize: small,
      onClick: () => {
        this.consume();
        if (!this.busy) this.setMode({ kind: 'menu' });
      },
    });
    const sound = addSoundToggle(this, this.m).on('pointerup', () => this.consume());
    this.layer.add([menu, sound]);

    if (this.mode.kind === 'none' && this.time.now < this.hintUntil) this.drawHint();
    if (this.mode.kind === 'dialog') this.drawDialog(this.mode.dialog);
    if (this.mode.kind === 'board') this.drawBoard(this.mode.note);
    if (this.mode.kind === 'menu') this.drawMenu();
  }

  private drawHint() {
    const { cx, height, contentWidth, small } = this.m;
    const touch = this.sys.game.device.input.touch;
    const hint = this.add
      .text(cx, height - 16, t(touch ? 'village.hintTouch' : 'village.hintKeys'), {
        ...textStyle(small),
        align: 'center',
        wordWrap: { width: contentWidth - 24, useAdvancedWrap: true },
        backgroundColor: '#2b2745cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5, 1);
    this.layer!.add(hint);
  }

  private panel(x: number, y: number, w: number, h: number, fill: number = COLORS.panel) {
    const g = this.add.graphics();
    g.fillStyle(0x120f22, 0.45).fillRoundedRect(x + 3, y + 4, w, h, 10);
    g.fillStyle(fill, 0.96).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(3, COLORS.cream, 0.9).strokeRoundedRect(x, y, w, h, 10);
    return g;
  }

  /** Abdunkelnder Hintergrund, der Berührungen abfängt */
  private overlay(onTap?: () => void) {
    const { width, height } = this.m;
    const shade = this.add.rectangle(0, 0, width, height, 0x120f22, onTap ? 0.001 : 0.6).setOrigin(0).setInteractive();
    shade.on('pointerup', () => {
      this.consume();
      onTap?.();
    });
    return shade;
  }

  private drawDialog(dialog: Dialog) {
    const { width, height, contentWidth, font, small } = this.m;
    const line = dialog.lines[dialog.index];
    const pad = Math.round(font * 0.8);
    // Gesichtsbild in ganzzahliger Vergrößerung, damit die Pixel scharf bleiben
    let faceSize = 0;
    let faceScale = 1;
    if (dialog.portrait && this.textures.exists(dialog.portrait)) {
      const src = this.textures.get(dialog.portrait).getSourceImage().width;
      faceScale = Math.max(1, Math.round((font * 3.4) / src));
      faceSize = src * faceScale;
    }
    const textX = faceSize ? faceSize + pad * 2 : pad;
    const text = this.add.text(0, 0, line, {
      ...textStyle(font),
      wordWrap: { width: contentWidth - textX - pad, useAdvancedWrap: true },
      lineSpacing: 5,
    });
    const boxH = Math.max(Math.round(font * 4.4), text.height + pad * 2 + 6, faceSize + pad * 2);
    const x = (width - contentWidth) / 2;
    const y = height - boxH - 14;
    text.setPosition(x + textX, y + pad);

    const parts: Phaser.GameObjects.GameObject[] = [this.overlay(() => this.advance()), this.panel(x, y, contentWidth, boxH)];
    if (faceSize) {
      const frame = this.add.graphics();
      frame.fillStyle(COLORS.panelLight, 1).fillRoundedRect(x + pad - 3, y + pad - 3, faceSize + 6, faceSize + 6, 6);
      frame.lineStyle(2, COLORS.cream, 0.7).strokeRoundedRect(x + pad - 3, y + pad - 3, faceSize + 6, faceSize + 6, 6);
      const face = this.add.image(x + pad, y + pad, dialog.portrait!).setOrigin(0).setScale(faceScale);
      parts.push(frame, face);
    }
    if (dialog.speaker) {
      const name = this.add.text(0, 0, dialog.speaker, headingStyle(small)).setOrigin(0, 1);
      const tagW = name.width + pad * 1.6;
      const tagH = name.height + 8;
      const tag = this.panel(x + pad, y - tagH + 4, tagW, tagH, COLORS.panelLight);
      name.setPosition(x + pad * 1.8, y);
      parts.push(tag, name);
    }
    const arrow = this.add
      .text(x + contentWidth - pad, y + boxH - 8, '▼', textStyle(small, COLORS.textGold))
      .setOrigin(1, 1)
      .setVisible(dialog.typed);
    this.tweens.add({ targets: arrow, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    parts.push(text, arrow);
    this.layer!.add(parts);

    if (!dialog.typed) {
      this.typewriter = new Typewriter(this, text, line, () => {
        dialog.typed = true;
        arrow.setVisible(true);
      });
    }
  }

  private drawBoard(note?: string) {
    const { width, height, contentWidth, font, small, gap } = this.m;
    const save = getSave();
    const log = save.quests ?? {};
    const parts: Phaser.GameObjects.GameObject[] = [this.overlay()];
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
      const qTitle = this.add.text(tx, y + cardPad, t(`village.quests.${id}.title`), {
        ...headingStyle(font, COLORS.textGold),
        wordWrap: { width: tw, useAdvancedWrap: true },
      });
      y = qTitle.y + qTitle.height + 4;
      const body = this.add.text(tx, y, t(`village.quests.${id}.text`), {
        ...textStyle(small),
        wordWrap: { width: tw, useAdvancedWrap: true },
        lineSpacing: 3,
      });
      y = body.y + body.height + 4;
      const meta = this.add.text(
        tx,
        y,
        `${t('village.board.from', { from: t(`village.quests.${id}.from`) })}\n${t('village.board.reward', { reward: t(`village.quests.${id}.reward`) })}`,
        { ...textStyle(small, COLORS.textDim), wordWrap: { width: tw, useAdvancedWrap: true }, lineSpacing: 3 },
      );
      y = meta.y + meta.height + gap * 0.7;
      items.push(qTitle, body, meta);
      const btnH = Math.round(small * 2.2);
      if (status === 'open') {
        const accept = new Button(this, pad + innerW - cardPad - 80, y + btnH / 2, t('village.board.accept'), {
          width: 160,
          height: btnH,
          fontSize: small,
          fill: 0x4a6a3a,
          onClick: () => {
            this.consume();
            updateSave({ quests: acceptQuest(getSave().quests ?? {}, id) });
            this.setMode({ kind: 'board', note: t('village.board.acceptedNote') });
          },
        });
        items.push(accept);
      } else {
        const label = this.add
          .text(pad + innerW - cardPad, y + btnH / 2, t(status === 'done' ? 'village.board.done' : 'village.board.accepted'), headingStyle(small, '#bfe3a0'))
          .setOrigin(1, 0.5);
        items.push(label);
      }
      y += btnH + cardPad;
      card.fillStyle(COLORS.panelLight, 1).fillRoundedRect(pad, cardTop, innerW, y - cardTop, 8);
      card.lineStyle(2, COLORS.cream, 0.35).strokeRoundedRect(pad, cardTop, innerW, y - cardTop, 8);
      y += gap;
    }

    if (note) {
      const n = this.add
        .text(contentWidth / 2, y, note, { ...textStyle(small, COLORS.textGold), align: 'center', wordWrap: { width: innerW } })
        .setOrigin(0.5, 0);
      items.push(n);
      y += n.height + gap;
    }
    const closeH = Math.round(font * 2.2);
    const close = new Button(this, contentWidth / 2, y + closeH / 2, t('village.board.close'), {
      width: Math.min(innerW, 240),
      height: closeH,
      fontSize: font,
      onClick: () => {
        this.consume();
        this.setMode({ kind: 'none' });
      },
    });
    items.push(close);
    y += closeH + pad;

    const bg = this.panel(0, 0, contentWidth, y);
    panel.add([bg, ...items]);
    panel.y = Math.max(8, (height - y) / 2);
    parts.push(panel);
    this.layer!.add(parts);
  }

  private drawMenu() {
    const { width, height, font, small, gap } = this.m;
    const w = Math.min(this.m.contentWidth, 340);
    const pad = Math.round(font * 0.8);
    const parts: Phaser.GameObjects.GameObject[] = [this.overlay()];
    const panel = this.add.container((width - w) / 2, 0);
    const items: Phaser.GameObjects.GameObject[] = [];
    let y = pad;
    const title = this.add.text(w / 2, y, t('village.menu.title'), headingStyle(Math.round(font * 1.25))).setOrigin(0.5, 0);
    items.push(title);
    y += title.height + gap;
    const status = this.add
      .text(w / 2, 0, '', { ...textStyle(small, COLORS.textDim), align: 'center', wordWrap: { width: w - pad * 2 } })
      .setOrigin(0.5, 0);
    const add = (label: string, onClick: () => void) => {
      const h = Math.round(font * 2.3);
      const b = new Button(this, w / 2, y + h / 2, label, {
        width: w - pad * 2,
        height: h,
        fontSize: font,
        onClick: () => {
          this.consume();
          onClick();
        },
      });
      items.push(b);
      y += h + gap * 0.7;
    };
    add(t('village.menu.profile'), () => this.onLeave?.('Profile', { from: 'Village' }));
    add(t('village.menu.share'), () => void shareResult(status));
    add(t('village.menu.toTitle'), () => this.onLeave?.('Title'));
    add(t('village.menu.close'), () => this.setMode({ kind: 'none' }));
    status.y = y;
    items.push(status);
    y += Math.max(small * 2.6, status.height) + pad;
    // Platz für den Kopiertext beim Teilen lassen
    panel.add([this.panel(0, 0, w, y), ...items]);
    panel.y = Math.max(8, (height - y) / 2);
    parts.push(panel);
    this.layer!.add(parts);
  }
}
