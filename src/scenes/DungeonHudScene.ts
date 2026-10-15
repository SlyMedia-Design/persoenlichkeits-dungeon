import { dungeonContent, t } from '../content';
import { senses, teamSees } from '../core/dungeon/engine';
import { knows, parseBagEntry } from '../core/dungeon/stats';
import type { Action, DungeonState, Unit } from '../core/dungeon/types';
import { ELEMENT_ICON_SIZE, elementTexture } from '../ui/elements';
import { HudScene, type PanelBuilder } from '../ui/HudScene';
import { bagEntryDef, bagEntryInfo, bagEntryName, groupEntries } from '../ui/items';
import { COLORS, headingStyle, textStyle } from '../ui/theme';

/** info = Platz der Fähigkeit, deren Beschreibung gerade aufgeklappt ist */
type Mode = { kind: 'skills'; info?: number } | { kind: 'bag' } | { kind: 'bagItem'; index: number } | { kind: 'menu' };

const LOG_LINES = 3;
const LOG_MS = 6000;

/** Bedienoberfläche im Dungeon: Lebensbalken, Übersichtskarte, Kampfprotokoll, Fähigkeiten und Beutel. */
export class DungeonHudScene extends HudScene<Mode> {
  private state?: DungeonState;
  private names: Record<string, string> = {};
  private log: { text: string; at: number }[] = [];
  /** Wird von der Dungeon-Szene gesetzt */
  onAction?: (action: Action) => void;
  onGiveUp?: () => void;

  constructor() {
    super('DungeonHud');
  }

  create() {
    this.log = [];
    super.create();
  }

  /** Neuer Stand nach einem Zug (während eines Dialogs wird erst danach neu gezeichnet) */
  refresh(state: DungeonState, names: Record<string, string>) {
    this.state = state;
    this.names = names;
    if (this.mode.kind === 'none') this.render();
  }

  addLog(text: string) {
    this.log.push({ text, at: this.time.now });
    if (this.log.length > 12) this.log.shift();
    if (this.mode.kind === 'none') this.render();
  }

  openSkills() {
    if (!this.busy) this.setMode({ kind: 'skills' });
  }

  openBag() {
    if (!this.busy) this.setMode({ kind: 'bag' });
  }

  protected hintText(touch: boolean) {
    return t(touch ? 'dungeon.ui.hintTouch' : 'dungeon.ui.hintKeys');
  }

  protected hintBottom() {
    return this.barsHeight() + this.m.gap * 2 + this.m.small * 4.2;
  }

  /** Auf schmalen Bildschirmen stehen die vier Knöpfe in zwei Reihen, damit die Beschriftung lesbar bleibt */
  private columns() {
    return this.m.width < 720 ? 2 : 4;
  }

  private barsHeight() {
    const rows = 4 / this.columns();
    return rows * this.barHeight() + (rows - 1) * this.m.gap * 0.5 + 8;
  }

  protected escapeIdle() {
    this.setMode({ kind: 'menu' });
  }

  private barHeight() {
    return Math.round(this.m.font * 2.3);
  }

  private nameOf(u: Unit) {
    return this.names[u.id] ?? t(`dungeon.enemies.${u.species}`);
  }

  protected drawTop() {
    const s = this.state;
    if (!s) return;
    const { width, height, small, gap } = this.m;
    const layer = this.layer!;

    // Etage
    const floorText = s.floor.boss ? t('dungeon.bossFloor') : t('dungeon.floor', { n: s.floor.number });
    layer.add(this.add.text(12, 10, floorText, headingStyle(small)));

    // Lebensbalken des Teams
    let y = 10 + small * 1.7;
    const barW = Math.min(150, width * 0.36);
    const members = s.units.filter((u) => u.side === 'team' || (u.side === 'escort' && s.escort === 'following'));
    for (const u of members) {
      const label = u.side === 'escort' ? this.nameOf(u) : `${this.nameOf(u)} ${t('dungeon.level', { level: u.level })}`;
      layer.add(this.add.text(12, y, label, textStyle(small)));
      y += small * 1.25;
      const g = this.add.graphics();
      const ratio = u.hp / u.maxHp;
      g.fillStyle(0x120f22, 0.75).fillRoundedRect(12, y, barW, 8, 3);
      g.fillStyle(ratio > 0.5 ? 0x7fd16b : ratio > 0.25 ? 0xf2c14e : 0xe0605a, 1).fillRoundedRect(12, y, Math.max(2, barW * ratio), 8, 3);
      layer.add(g);
      layer.add(this.add.text(12 + barW + 6, y - 4, `${u.hp}/${u.maxHp}`, textStyle(Math.round(small * 0.85), COLORS.textDim)));
      y += 8 + gap * 0.6;
    }

    this.drawMinimap(s);

    // Kampfprotokoll
    // Bei offenem Dialog oder Panel stört das Protokoll nur
    const recent = this.mode.kind === 'none' ? this.log.filter((l) => this.time.now - l.at < LOG_MS).slice(-LOG_LINES) : [];
    const logBottom = height - this.barsHeight() - gap;
    if (recent.length > 0) {
      const text = this.add
        .text(12, logBottom, recent.map((l) => l.text).join('\n'), {
          ...textStyle(small),
          wordWrap: { width: this.m.contentWidth, useAdvancedWrap: true },
          backgroundColor: '#1a183088',
          padding: { x: 8, y: 6 },
          lineSpacing: 3,
        })
        .setOrigin(0, 1);
      layer.add(text);
      const oldest = Math.min(...recent.map((l) => l.at));
      this.time.delayedCall(LOG_MS - (this.time.now - oldest) + 50, () => this.mode.kind === 'none' && this.render());
    }

    // Knopfleiste
    const labels: [string, () => void][] = [
      [t('dungeon.ui.skills'), () => this.setMode({ kind: 'skills' })],
      [t('dungeon.ui.bag'), () => this.setMode({ kind: 'bag' })],
      [t('dungeon.ui.wait'), () => this.onAction?.({ type: 'wait' })],
      [t('dungeon.ui.menu'), () => this.setMode({ kind: 'menu' })],
    ];
    const cols = this.columns();
    const total = Math.min(width - 16, cols === 2 ? 560 : 680);
    const bw = (total - gap * (cols - 1)) / cols;
    const bh = this.barHeight();
    const top = height - this.barsHeight();
    labels.forEach(([label, onClick], i) => {
      const x = (width - total) / 2 + bw / 2 + (i % cols) * (bw + gap);
      const y = top + bh / 2 + Math.floor(i / cols) * (bh + gap * 0.5);
      layer.add(
        this.button(x, y, label, { width: bw, height: bh, fontSize: small }, () => {
          if (!this.busy) onClick();
        }),
      );
    });
  }

  /** Übersichtskarte oben rechts: erkundete Felder, Treppe, Team und sichtbare Gegner */
  private drawMinimap(s: DungeonState) {
    const { width, small } = this.m;
    const f = s.floor;
    const cell = Math.max(2, Math.floor(Math.min(width * 0.32, 170) / f.width));
    const x0 = width - f.width * cell - 12;
    const y0 = 10 + small * 2.4;
    const g = this.add.graphics().setAlpha(0.85);
    g.fillStyle(0x120f22, 0.55).fillRect(x0 - 3, y0 - 3, f.width * cell + 6, f.height * cell + 6);
    g.fillStyle(0xcbe6b0, 0.75);
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) if (f.explored[y][x] === '1' && f.tiles[y][x] === '.') g.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
    }
    const dot = (p: { x: number; y: number }, color: number) => g.fillStyle(color, 1).fillRect(x0 + p.x * cell - 1, y0 + p.y * cell - 1, cell + 2, cell + 2);
    if (f.stairs && f.explored[f.stairs.y][f.stairs.x] === '1') dot(f.stairs, 0xffd27a);
    for (const it of f.items) if (f.explored[it.pos.y][it.pos.x] === '1') dot(it.pos, 0x7fb8ff);
    for (const trap of f.traps) if (trap.revealed) dot(trap.pos, 0xb07ad0);
    for (const u of s.units) {
      if (u.hp <= 0) continue;
      if (u.side === 'enemy') {
        if (teamSees(dungeonContent, s, u.pos)) dot(u.pos, 0xe0605a);
        else if (senses(s, u.pos)) dot(u.pos, 0xf0a0b0);
      } else if (u.side === 'escort') dot(u.pos, 0xffffff);
      else dot(u.pos, u.id === 'player' ? 0xfff8ea : 0x8fd0ff);
    }
    this.layer!.add(g);
  }

  protected drawMode(mode: Mode) {
    const s = this.state;
    if (!s) return;
    if (mode.kind === 'skills') this.drawSkills(s, mode.info);
    else if (mode.kind === 'bag') this.drawBag(s);
    else if (mode.kind === 'bagItem') this.drawBagItem(s, mode.index);
    else this.drawMenu();
  }

  private act(action: Action) {
    this.close();
    this.onAction?.(action);
  }

  /** Kompaktes Fähigkeiten-Menü: Elementsymbol, Name und Energie; die Beschreibung klappt per Info-Knopf auf */
  private drawSkills(s: DungeonState, info?: number) {
    const player = s.units.find((u) => u.id === 'player')!;
    const { small } = this.m;
    this.drawPanel(t('dungeon.ui.skills'), (b) => {
      b.button(t('moves.attack.name'), () => this.act({ type: 'attack' }), { fontSize: small });
      const rowH = Math.round(small * 2.3);
      const infoW = rowH;
      const skillW = b.width - b.pad * 2 - infoW - 6;
      player.moves.forEach((m, i) => {
        const top = b.y;
        const label = `${t(`moves.${m.id}.name`)}  ${t('dungeon.ui.ppShort', { pp: m.pp, max: m.maxPp })}`;
        const skill = this.button(b.pad + skillW / 2, top + rowH / 2, label, { width: skillW, height: rowH, fontSize: small, align: 'left' }, () => this.act({ type: 'skill', index: i }));
        if (m.pp <= 0) skill.setAlpha(0.45).disableInteractive();
        b.add(skill, 0);
        const element = dungeonContent.moves.moves[m.id]?.element;
        if (element) {
          // Elementsymbol links im Knopf, der Name rückt daneben
          const icon = this.add.image(b.pad + Math.round(small * 0.6), top + rowH / 2, elementTexture(this, element)).setOrigin(0, 0.5).setScale(2).setAlpha(m.pp > 0 ? 1 : 0.45);
          skill.label.x += ELEMENT_ICON_SIZE * 2 + 2;
          b.add(icon, 0);
        }
        const toggle = this.button(b.width - b.pad - infoW / 2, top + rowH / 2, '?', { width: infoW, height: rowH, fontSize: small }, () =>
          this.setMode({ kind: 'skills', info: info === i ? undefined : i }),
        );
        toggle.setSelected(info === i);
        b.add(toggle, rowH + this.m.gap * 0.6);
        if (info === i) b.text(t(`moves.${m.id}.info`), { color: COLORS.textDim, fontSize: `${Math.round(small * 0.9)}px` });
      });
      b.gap(4);
      b.button(t('dungeon.ui.close'), () => this.close(), { fontSize: small });
    }, 360);
  }

  /** Volle Plätze: Welche Fähigkeit wird für die neue verlernt? onPick(null) = nicht lernen */
  askForget(name: string, moves: string[], newMove: string, onPick: (forget: number | null) => void) {
    const move = t(`moves.${newMove}.name`);
    const options = moves.map((id, i) => ({ label: t(`moves.${id}.name`), onPick: () => onPick(i) }));
    options.push({ label: t('dungeon.ui.dontLearn', { move }), onPick: () => onPick(null) });
    // Escape öffnet die Frage erneut: Die Entscheidung soll bewusst fallen
    this.choose(t('dungeon.ui.forgetPrompt', { name, move }), options, () => this.askForget(name, moves, newMove, onPick));
  }

  private drawBag(s: DungeonState) {
    const size = dungeonContent.dungeon.bag.size;
    this.drawPanel(t('dungeon.ui.bagCount', { n: s.bag.length, max: size }), (b) => {
      if (s.bag.length === 0) b.text(t('dungeon.ui.bagEmpty'));
      // Gleiche Gegenstände zusammenfassen
      for (const [item, indices] of groupEntries(s.bag)) {
        const label = `${bagEntryName(item)}${indices.length > 1 ? `  ×${indices.length}` : ''}`;
        b.button(label, () => this.setMode({ kind: 'bagItem', index: indices[0] }), { fontSize: this.m.small });
      }
      // Quest-Tasche: Auftragsgegenstände, getrennt vom Beutel
      const quest = s.questBag ?? [];
      if (quest.length > 0) {
        b.gap(4);
        b.text(t('dungeon.ui.questBag'), headingStyle(this.m.small));
        const lines = [...groupEntries(quest)].map(([item, indices]) => `${bagEntryName(item)}${indices.length > 1 ? `  ×${indices.length}` : ''}`);
        b.text(lines.join('\n'), { color: COLORS.textDim });
      }
      b.gap(4);
      b.button(t('dungeon.ui.close'), () => this.close(), { fontSize: this.m.small });
    });
  }

  private drawBagItem(s: DungeonState, index: number) {
    const item = s.bag[index];
    const def = bagEntryDef(item);
    this.drawPanel(bagEntryName(item), (b) => {
      b.text(bagEntryInfo(item, s.bonuses.healing));
      if (def.use === 'heal' || def.use === 'pp') {
        b.button(t('dungeon.ui.useSelf'), () => this.act({ type: 'item', index, target: 'player' }), { fontSize: this.m.small });
        b.button(t('dungeon.ui.usePartner', { partner: this.names.partner ?? '' }), () => this.act({ type: 'item', index, target: 'partner' }), { fontSize: this.m.small });
      } else if (def.use === 'throw') {
        b.button(t('dungeon.ui.throw'), () => this.act({ type: 'item', index, target: 'player' }), { fontSize: this.m.small });
      } else if (def.use === 'learn') {
        this.learnButtons(b, s, index);
      } else {
        b.text(t('dungeon.ui.questItem'), { color: COLORS.textGold });
      }
      b.button(t('dungeon.ui.close'), () => this.setMode({ kind: 'bag' }), { fontSize: this.m.small });
    });
  }

  /** Fähigkeitsstein: für Spieler oder Partner; bei 4 aktiven Fähigkeiten wird erst gefragt, welche verlernt wird */
  private learnButtons(b: PanelBuilder, s: DungeonState, index: number) {
    const move = parseBagEntry(s.bag[index]).move;
    if (!move) return;
    for (const id of ['player', 'partner'] as const) {
      const unit = s.units.find((u) => u.id === id);
      if (!unit) continue;
      const label = id === 'player' ? t('dungeon.ui.learnSelf') : t('dungeon.ui.learnPartner', { partner: this.names.partner ?? '' });
      if (knows(unit, move)) {
        b.button(label, () => {}, { fontSize: this.m.small, enabled: false });
        b.text(t('dungeon.ui.alreadyKnows', { name: this.nameOf(unit), move: t(`moves.${move}.name`) }), { color: COLORS.textDim });
        continue;
      }
      b.button(label, () => {
        if (unit.moves.length < dungeonContent.battle.maxMoves) this.act({ type: 'item', index, target: id });
        else this.askForget(this.nameOf(unit), unit.moves.map((m) => m.id), move, (forget) => {
          if (forget === null) this.setMode({ kind: 'bagItem', index });
          else this.act({ type: 'item', index, target: id, forget });
        });
      }, { fontSize: this.m.small });
    }
  }

  private drawMenu() {
    this.drawPanel(t('dungeon.ui.menu'), (b) => {
      b.button(t('dungeon.ui.resume'), () => this.close());
      b.button(t('dungeon.ui.giveUp'), () =>
        this.choose(t('dungeon.ui.giveUpConfirm'), [
          { label: t('dungeon.ui.giveUp'), onPick: () => this.onGiveUp?.() },
          { label: t('dungeon.ui.resume'), onPick: () => {} },
        ]),
      );
    });
  }
}

