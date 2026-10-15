import Phaser from 'phaser';
import { t } from '../content';
import { addSoundToggle } from './BaseScene';
import { Button } from './Button';
import { isFastForwardToggled, toggleFastForward } from './speed';
import { Typewriter } from './typewriter';
import type { QuestLogEntry } from '../core/questlog';
import { COLORS, headingStyle, metrics, textStyle, type Metrics } from './theme';

export interface Dialog {
  speaker?: string;
  /** Textur des Gesichtsbilds neben dem Text */
  portrait?: string;
  lines: string[];
  index: number;
  /** Aktuelle Zeile ist fertig geschrieben (bei Neuaufbau nicht erneut tippen) */
  typed: boolean;
  onDone?: () => void;
}

export interface Choice {
  label: string;
  onPick: () => void;
}

type BaseMode =
  | { kind: 'none' }
  | { kind: 'dialog'; dialog: Dialog }
  | { kind: 'choice'; prompt: string; options: Choice[]; cancel?: () => void };

/** Baukasten für ein Panel in der Bildschirmmitte */
export interface PanelBuilder {
  readonly width: number;
  readonly pad: number;
  text(text: string, style?: Phaser.Types.GameObjects.Text.TextStyle, align?: 'left' | 'center'): Phaser.GameObjects.Text;
  button(label: string, onClick: () => void, opts?: { fill?: number; fontSize?: number; enabled?: boolean; align?: 'left' | 'center' }): Button;
  gap(size?: number): void;
  add(obj: Phaser.GameObjects.GameObject, height: number): void;
  /** Aktuelle Höhe (für eigene Elemente) */
  readonly y: number;
}

const HINT_MS = 8000;

/**
 * Gemeinsame Bedienoberfläche über Dorf und Dungeon: Dialoge mit Gesichtsbild, Auswahlfragen,
 * Panels, Hinweis und Musik-Schalter. Läuft als eigene Szene, unabhängig vom Kamera-Zoom der Karte.
 */
export abstract class HudScene<Extra extends { kind: string }> extends Phaser.Scene {
  protected mode: BaseMode | Extra = { kind: 'none' };
  protected layer?: Phaser.GameObjects.Container;
  protected m!: Metrics;
  private typewriter?: Typewriter;
  private hintUntil = 0;
  private hintPending = false;
  /** Zuletzt von der Oberfläche verbrauchte Berührung (dasselbe Browser-Ereignis sieht auch die Karte) */
  private consumedEvent?: Event;
  /** Wird von der Kartenszene gesetzt: Szene verlassen (Profil, Titel …) */
  onLeave?: (key: string, data?: object) => void;

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
      if (e.code === 'Escape') this.escape();
    });
  }

  /** Text des Steuerungshinweises (Touch oder Tastatur) */
  protected abstract hintText(touch: boolean): string;
  /** Dauerhafte Elemente (Knöpfe, Anzeigen) */
  protected abstract drawTop(): void;
  /** Eigene Ansichten der Unterklasse */
  protected abstract drawMode(mode: Extra): void;
  /** Escape ohne offene Ansicht */
  protected escapeIdle() {}

  /** Jemand spricht: mehrere Sätze nacheinander, weiter per Tippen oder Leertaste. */
  say(speaker: string | undefined, lines: string[], onDone?: () => void, portrait?: string) {
    this.setMode({ kind: 'dialog', dialog: { speaker, portrait, lines, index: 0, typed: false, onDone } });
  }

  /** Frage mit Antwortknöpfen; Escape wählt cancel */
  choose(prompt: string, options: Choice[], cancel?: () => void) {
    this.setMode({ kind: 'choice', prompt, options, cancel });
  }

  close() {
    this.setMode({ kind: 'none' });
  }

  /** Steuerungshinweis für einige Sekunden (wartet, bis nichts anderes offen ist). */
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

  protected setMode(mode: BaseMode | Extra) {
    this.mode = mode;
    this.render();
    if (mode.kind === 'none' && this.hintPending) {
      this.hintPending = false;
      this.showHint();
    }
  }

  protected consume() {
    this.consumedEvent = this.input.activePointer.event;
  }

  /** Hat die Oberfläche diese Berührung schon verarbeitet? */
  consumed(pointer: Phaser.Input.Pointer): boolean {
    return !!pointer.event && pointer.event === this.consumedEvent;
  }

  private escape() {
    const mode = this.mode;
    if (mode.kind === 'dialog') this.endDialog((mode as { dialog: Dialog }).dialog);
    else if (mode.kind === 'choice') {
      const cancel = (mode as { cancel?: () => void }).cancel;
      this.close();
      cancel?.();
    } else if (mode.kind === 'none') this.escapeIdle();
    else this.close();
  }

  private advance() {
    if (this.mode.kind !== 'dialog') return;
    const dialog = (this.mode as { dialog: Dialog }).dialog;
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
    this.close();
    dialog.onDone?.();
  }

  /** Baut die ganze Oberfläche neu auf (auch nach Größenänderung). */
  protected render() {
    this.typewriter?.destroy();
    this.typewriter = undefined;
    // Endlos-Animationen (z. B. Pfeil im Dialog) gehören zu den alten Elementen
    this.tweens.killAll();
    this.layer?.destroy(true);
    this.m = metrics(this);
    this.layer = this.add.container();
    this.drawTop();
    const sound = addSoundToggle(this, this.m).on('pointerup', () => this.consume());
    this.layer.add(sound);
    if (this.sys.game.device.input.touch) this.drawFastForward(sound);
    const mode = this.mode;
    if (mode.kind === 'none') {
      if (this.time.now < this.hintUntil) this.drawHint();
    } else if (mode.kind === 'dialog') this.drawDialog((mode as { dialog: Dialog }).dialog);
    else if (mode.kind === 'choice') this.drawChoice(mode as Extract<BaseMode, { kind: 'choice' }>);
    else this.drawMode(mode as Extra);
  }

  /** Knopf, der die Berührung für die Karte verbraucht */
  protected button(x: number, y: number, label: string, opts: { width: number; height?: number; fontSize?: number; fill?: number; align?: 'left' | 'center' }, onClick: () => void): Button {
    const fontSize = opts.fontSize ?? this.m.font;
    const button = new Button(this, x, y, label, {
      width: opts.width,
      height: opts.height,
      fontSize,
      fill: opts.fill,
      align: opts.align,
      onClick: () => {
        this.consume();
        onClick();
      },
    });
    // Ein einzelnes Wort soll nicht umbrechen: notfalls die Schrift etwas verkleinern
    let size = fontSize;
    while (!label.includes(' ') && button.label.height > size * 1.8 && size > 11) button.label.setFontSize(--size);
    return button;
  }

  /** Shift-Knopf für Touch-Geräte links neben dem Musik-Schalter: schaltet das Vorspulen ein und aus */
  private drawFastForward(sound: Phaser.GameObjects.Text) {
    const { small } = this.m;
    const w = Math.round(small * 4.2);
    const h = Math.round(small * 1.9);
    const button = this.button(sound.x - sound.width - 6 - w / 2, 8 + h / 2, t('common.fastForward'), { width: w, height: h, fontSize: small }, () =>
      button.setSelected(toggleFastForward()),
    );
    button.setSelected(isFastForwardToggled());
    this.layer!.add(button);
  }

  private drawHint() {
    const { cx, height, contentWidth, small } = this.m;
    const hint = this.add
      .text(cx, height - this.hintBottom(), this.hintText(this.sys.game.device.input.touch), {
        ...textStyle(small),
        align: 'center',
        wordWrap: { width: contentWidth - 24, useAdvancedWrap: true },
        backgroundColor: '#2b2745cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5, 1);
    this.layer!.add(hint);
  }

  /** Abstand des Hinweises vom unteren Rand (Platz für Knopfleisten) */
  protected hintBottom(): number {
    return 16;
  }

  protected panel(x: number, y: number, w: number, h: number, fill: number = COLORS.panel) {
    const g = this.add.graphics();
    g.fillStyle(0x120f22, 0.45).fillRoundedRect(x + 3, y + 4, w, h, 10);
    g.fillStyle(fill, 0.96).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(3, COLORS.cream, 0.9).strokeRoundedRect(x, y, w, h, 10);
    return g;
  }

  /** Abdunkelnder Hintergrund, der Berührungen abfängt */
  protected overlay(onTap?: () => void) {
    const { width, height } = this.m;
    const shade = this.add.rectangle(0, 0, width, height, 0x120f22, onTap ? 0.001 : 0.6).setOrigin(0).setInteractive();
    shade.on('pointerup', () => {
      this.consume();
      onTap?.();
    });
    return shade;
  }

  /** Panel mit Titel in der Bildschirmmitte, Inhalt über den Baukasten */
  protected drawPanel(title: string, build: (b: PanelBuilder) => void, maxWidth = 380) {
    const { width, height, font, small, gap } = this.m;
    const w = Math.min(this.m.contentWidth, maxWidth);
    const pad = Math.round(font * 0.8);
    const container = this.add.container((width - w) / 2, 0);
    const items: Phaser.GameObjects.GameObject[] = [];
    let y = pad;
    const titleText = this.add.text(w / 2, y, title, { ...headingStyle(Math.round(font * 1.2)), align: 'center', wordWrap: { width: w - pad * 2, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    items.push(titleText);
    y += titleText.height + gap;
    const builder: PanelBuilder = {
      width: w,
      pad,
      get y() {
        return y;
      },
      text: (text, style, align = 'center') => {
        const obj = this.add
          .text(align === 'center' ? w / 2 : pad, y, text, { ...textStyle(small), align, wordWrap: { width: w - pad * 2, useAdvancedWrap: true }, lineSpacing: 3, ...style })
          .setOrigin(align === 'center' ? 0.5 : 0, 0);
        items.push(obj);
        y += obj.height + gap * 0.6;
        return obj;
      },
      button: (label, onClick, opts = {}) => {
        const fontSize = opts.fontSize ?? font;
        const h = Math.round(fontSize * 2.3);
        const b = this.button(w / 2, y + h / 2, label, { width: w - pad * 2, height: h, fontSize, fill: opts.fill, align: opts.align }, onClick);
        if (opts.enabled === false) b.setAlpha(0.45).disableInteractive();
        items.push(b);
        y += h + gap * 0.6;
        return b;
      },
      gap: (size = gap) => {
        y += size;
      },
      add: (obj, h) => {
        items.push(obj);
        y += h;
      },
    };
    build(builder);
    y += pad - gap * 0.6;
    container.add([this.panel(0, 0, w, y), ...items]);
    container.y = Math.max(8, (height - y) / 2);
    this.layer!.add([this.overlay(), container]);
    return container;
  }

/** Questlog: angenommene Aufträge mit dem nächsten Schritt, erledigte gedimmt darunter */
  protected drawQuestLog(entries: QuestLogEntry[], onBack: () => void) {
    this.drawPanel(t('village.questlog.title'), (b) => {
      if (entries.length === 0) b.text(t('village.questlog.empty'), { color: COLORS.textDim });
      for (const e of entries) {
        const done = e.status === 'done';
        b.text(t(`village.quests.${e.id}.title`), headingStyle(this.m.small, done ? COLORS.textDim : COLORS.textGold), 'left');
        const step = t(e.step, e.vars);
        b.text(done ? `${t('village.questlog.done')}: ${step}` : step, { color: done ? COLORS.textDim : COLORS.text }, 'left');
        b.gap(4);
      }
      b.button(t('village.menu.back'), onBack, { fontSize: this.m.small });
    }, 420);
  }

  private drawChoice(mode: Extract<BaseMode, { kind: 'choice' }>) {
    this.drawPanel(mode.prompt, (b) => {
      for (const option of mode.options) {
        b.button(option.label, () => {
          this.close();
          option.onPick();
        });
      }
    });
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
}
