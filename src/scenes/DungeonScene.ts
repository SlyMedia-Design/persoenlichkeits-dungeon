import Phaser from 'phaser';
import { archetypeById, dungeonContent as content, t, village } from '../content';
import { act, senses, teamSees, unitById } from '../core/dungeon/engine';
import { isFloorTile } from '../core/dungeon/generate';
import { settleRun } from '../core/dungeon/settle';
import type { Action, DungeonState, GameEvent, Unit } from '../core/dungeon/types';
import { combineDirs, dirTo, findPath, horizontalOf, samePos, type Dir, type Pos } from '../core/grid';
import { getSave, updateSave } from '../state';
import { ambient } from '../ui/ambient';
import { stoneTexture } from '../ui/elements';
import { bagEntryDef, bagEntryName } from '../ui/items';
import { pixelZoom } from '../ui/camera';
import { bindFastForward } from '../ui/speed';
import { creatureTexture, fieldTexture, shadowTexture } from '../ui/sprites';
import { BORDER, TILE, actorFrame, actorKey, dungeonFloorTexture, faceKey, fxKey, itemKey, preloadTileset, tileset } from '../ui/tiles';
import { COLORS } from '../ui/theme';
import type { DungeonHudScene } from './DungeonHudScene';

const MOVE_MS = 120;
const FEET_Y = 7;
const COMBINE_MS = 60;

interface View {
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  /** Unsere Wesen: [Stand, linker Fuß, rechter Fuß]; sonst Spritesheet mit Bildern je Richtung */
  walkFrames?: string[];
  boss: boolean;
}

const key = (p: Pos) => `${p.x},${p.y}`;
const center = (p: Pos) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });

/**
 * Der Flüsterwald. Jede Eingabe wird zu einem Zug (src/core/dungeon/engine), die Ereignisse
 * werden danach der Reihe nach animiert. Der Zustand liegt nach jedem Zug im Spielstand.
 */
export class DungeonScene extends Phaser.Scene {
  private state!: DungeonState;
  private hud!: DungeonHudScene;
  private views = new Map<string, View>();
  private items = new Map<string, Phaser.GameObjects.Image>();
  private traps = new Map<string, Phaser.GameObjects.Image>();
  private floorImage?: Phaser.GameObjects.Image;
  private fog!: Phaser.GameObjects.Graphics;
  private busy = false;
  private ended = false;
  private autoPath: Dir[] = [];
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private heldSince = 0;
  private queued?: Action;
  private names: Record<string, string> = {};

  constructor() {
    super('Dungeon');
  }

  preload() {
    preloadTileset(this);
  }

  create() {
    const save = getSave();
    if (!save.dungeon || !save.playerName || !save.partnerName) {
      this.scene.start('Title');
      return;
    }
    this.state = save.dungeon;
    this.busy = false;
    this.ended = false;
    this.autoPath = [];
    this.queued = undefined;
    this.heldSince = 0;
    this.names = { player: save.playerName, partner: save.partnerName, stups: t('dungeon.enemies.stups') };
    ambient.setBrightness(0.45);
    this.cameras.main.setBackgroundColor(0x0e1a12);

    if (!this.anims.exists('boss-idle')) {
      this.anims.create({ key: 'boss-idle', frames: this.anims.generateFrameNumbers(actorKey('forestSpirit'), {}), frameRate: 6, repeat: -1 });
    }
    this.fog = this.add.graphics().setDepth(500);
    this.buildFloor();

    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);
    this.setupInput();
    bindFastForward(this);

    this.scene.launch('DungeonHud');
    this.hud = this.scene.get('DungeonHud') as DungeonHudScene;
    this.hud.onAction = (action) => this.perform(action);
    this.hud.onGiveUp = () => this.perform({ type: 'giveUp' });
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.scene.stop('DungeonHud');
    });
    this.cameras.main.fadeIn(500, 14, 26, 18);
    this.time.delayedCall(450, () => this.arrive());
  }

  /** Beim Betreten: Einleitung bzw. Boss-Begrüßung, Hinweis zur Steuerung */
  private async arrive() {
    this.hud.refresh(this.state, this.names);
    if (this.state.turn === 0 && this.state.floor.number === 1) {
      this.hud.addLog(t('dungeon.floorIntro.first'));
      this.hud.showHint();
    }
    if (this.state.floor.boss && this.state.turn === 0) await this.bossIntro();
    // Spielstand mit offener Wahl (z. B. nach dem Neuladen)
    if (this.state.pendingLearn?.length) this.askLearn();
  }

  private async bossIntro() {
    this.busy = true;
    const cam = this.cameras.main;
    const boss = center(unitById(this.state, 'boss')!.pos);
    // Kamera kurz zum Waldgeist schwenken (die Verfolgung der Spielfigur würde den Schwenk überschreiben)
    cam.stopFollow();
    const from = { x: cam.midPoint.x, y: cam.midPoint.y };
    const glide = { t: 0 };
    await this.tween({
      targets: glide,
      t: 1,
      duration: 700,
      ease: 'Sine.easeInOut',
      onUpdate: () => cam.centerOn(from.x + (boss.x - from.x) * glide.t, from.y + (boss.y + TILE - from.y) * glide.t),
    });
    await this.say(t('dungeon.enemies.waldgeist'), t.list('dungeon.boss.intro'), faceKey('forestSpirit'));
    cam.startFollow(this.views.get('player')!.body, true, 0.2, 0.2);
    this.busy = false;
  }

  // ---------- Aufbau ----------

  private buildFloor() {
    for (const v of this.views.values()) v.body.destroy();
    this.views.clear();
    for (const i of this.items.values()) i.destroy();
    this.items.clear();
    for (const i of this.traps.values()) i.destroy();
    this.traps.clear();
    this.floorImage?.destroy();

    const f = this.state.floor;
    const b = BORDER * TILE;
    const id = `${f.number}-${f.boss ? 'boss' : f.tiles.join('').length}-${f.stairs ? key(f.stairs) : ''}-${this.state.nextId}`;
    this.floorImage = this.add.image(-b, -b, dungeonFloorTexture(this, f, id)).setOrigin(0).setDepth(-10);
    for (const it of f.items) this.addItem(it.pos, it.item);
    for (const trap of f.traps) this.addTrap(trap.pos, trap.kind, trap.revealed);
    for (const u of this.state.units) if (u.hp > 0) this.addView(u);

    const cam = this.cameras.main;
    cam.setBounds(-b, -b, f.width * TILE + 2 * b, f.height * TILE + 2 * b);
    cam.startFollow(this.views.get('player')!.body, true, 0.2, 0.2);
    this.applyZoom();
    this.refreshVisibility();
  }

  private applyZoom() {
    this.cameras.main.setZoom(pixelZoom(this.scale.width, this.scale.height));
  }

  private addItem(p: Pos, item: string) {
    const def = bagEntryDef(item);
    const texture = def.use === 'learn' && def.element ? stoneTexture(this, def.element) : itemKey(def.sprite);
    const img = this.add.image(center(p).x, center(p).y, texture).setDepth(-5);
    img.setScale(Math.min(1, 12 / Math.max(img.width, img.height)));
    this.items.set(key(p), img);
  }

  private addTrap(p: Pos, kind: string, revealed: boolean) {
    const img = this.add.image(center(p).x, center(p).y, itemKey(content.dungeon.traps[kind].sprite)).setDepth(-6).setVisible(revealed);
    img.setScale(Math.min(1, 12 / Math.max(img.width, img.height)));
    this.traps.set(key(p), img);
  }

  private addView(u: Unit): View {
    const shadow = this.add.image(0, 6, shadowTexture(this));
    let sprite: Phaser.GameObjects.Sprite;
    let walkFrames: string[] | undefined;
    const boss = !!u.boss;
    if (u.side === 'team') {
      const archetype = archetypeById(u.species);
      walkFrames = ([0, 1, 2] as const).map((w) => fieldTexture(this, archetype, w));
      sprite = this.add.sprite(0, FEET_Y, walkFrames[0]).setOrigin(0.5, 1);
    } else {
      const spriteId = u.side === 'escort' ? content.dungeon.quests.verirrt.escort.sprite : (content.battle.enemies[u.species] ?? content.battle.boss[u.species]).sprite!;
      sprite = this.add.sprite(0, FEET_Y, actorKey(spriteId), 0).setOrigin(0.5, 1);
      if (boss) {
        sprite.play('boss-idle');
        shadow.setScale(2.4, 2);
      }
    }
    const body = this.add.container(center(u.pos).x, center(u.pos).y, [shadow, sprite]);
    body.setDepth(1000 + body.y);
    const view: View = { body, sprite, walkFrames, boss };
    this.views.set(u.id, view);
    this.face(view, u.facing);
    if (walkFrames) this.tweens.add({ targets: sprite, scaleY: 0.94, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 400 });
    return view;
  }

  private face(view: View, dir: Dir) {
    const horizontal = horizontalOf(dir);
    if (view.boss) return;
    if (view.walkFrames) {
      if (horizontal) view.sprite.setFlipX(horizontal === 'left');
      return;
    }
    view.sprite.setFrame(actorFrame(horizontal ?? (dir as 'up' | 'down')));
  }

  /** Nebel über Unbekanntem, Halbdunkel über Bekanntem außer Sicht; Gegner nur sichtbar, wenn gesehen oder erspürt */
  private refreshVisibility() {
    const s = this.state;
    const f = s.floor;
    this.fog.clear();
    // Alles Unbekannte (auch der Wald rund um die Karte) liegt im Dunkeln, Bekanntes außer Sicht im Halbdunkel
    for (let y = -BORDER; y < f.height + BORDER; y++) {
      for (let x = -BORDER; x < f.width + BORDER; x++) {
        const inside = x >= 0 && y >= 0 && x < f.width && y < f.height;
        if (!inside || f.explored[y][x] !== '1') this.fog.fillStyle(0x050a07, 0.94).fillRect(x * TILE, y * TILE, TILE, TILE);
        else if (!teamSees(content, s, { x, y })) this.fog.fillStyle(0x050a07, 0.5).fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    for (const u of s.units) {
      const view = this.views.get(u.id);
      if (!view) continue;
      if (u.side !== 'enemy') view.body.setVisible(true).setAlpha(1);
      else if (teamSees(content, s, u.pos)) view.body.setVisible(true).setAlpha(1);
      else if (senses(s, u.pos)) view.body.setVisible(true).setAlpha(0.45);
      else view.body.setVisible(false);
    }
    for (const trap of f.traps) this.traps.get(key(trap.pos))?.setVisible(trap.revealed);
  }

  // ---------- Eingabe ----------

  private setupInput() {
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as typeof this.keys;
      kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
      const vertical: Record<string, 'up' | 'down'> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
      const horizontal: Record<string, 'left' | 'right'> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
      kb.on('keydown', (e: KeyboardEvent) => {
        if (this.hud.busy || this.ended) return;
        if (e.code === 'Space') this.queued = { type: 'attack' };
        else if (e.code === 'KeyQ') this.queued = { type: 'wait' };
        else if (e.code === 'KeyB' || e.code === 'KeyI') this.hud.openBag();
        else if (e.code === 'KeyF') this.hud.openSkills();
        else if (e.code === 'Enter') this.stairsPrompt();
        else if (/^Digit[1-4]$/.test(e.code)) this.queued = { type: 'skill', index: Number(e.code.slice(5)) - 1 };
        else if (vertical[e.code] || horizontal[e.code]) {
          // Kurzer Tastendruck ohne Halten: trotzdem einen Schritt machen
          const dir = combineDirs(vertical[e.code], horizontal[e.code]);
          if (dir && !this.heldDir()) this.queued = { type: 'move', dir };
        }
      });
    }
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      ambient.unlock();
      if (this.hud.busy || this.hud.consumed(pointer) || this.ended || pointer.getDistance() > 12) return;
      this.tapTile({ x: Math.floor(pointer.worldX / TILE), y: Math.floor(pointer.worldY / TILE) });
    });
  }

  private heldDir(): Dir | undefined {
    const k = this.keys;
    if (!k) return undefined;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    return combineDirs(up === down ? undefined : up ? 'up' : 'down', left === right ? undefined : left ? 'left' : 'right');
  }

  private tapTile(tile: Pos) {
    if (this.busy) return;
    const player = unitById(this.state, 'player')!;
    if (samePos(tile, player.pos)) return this.stairsPrompt();
    const dir = dirTo(player.pos, tile);
    if (dir) {
      this.autoPath = [];
      return void this.perform({ type: 'move', dir });
    }
    // Weiter weg: über bekannte Felder hinlaufen, Schritt für Schritt
    const f = this.state.floor;
    if (!isFloorTile(f, tile) || f.explored[tile.y][tile.x] !== '1') return;
    const blocked = new Set(this.state.units.filter((u) => u.side === 'enemy' && u.hp > 0).map((u) => key(u.pos)));
    const path = findPath(player.pos, [tile], (p) => isFloorTile(f, p) && f.explored[p.y][p.x] === '1' && !blocked.has(key(p)), 4000);
    if (path && path.length > 0) {
      this.autoPath = path;
      this.marker(tile);
    }
  }

  private marker(tile: Pos) {
    const r = this.add.rectangle(center(tile).x, center(tile).y, TILE - 2, TILE - 2).setStrokeStyle(1, 0xfff8ea, 0.9).setDepth(400);
    this.tweens.add({ targets: r, alpha: 0, scale: 0.6, duration: 450, onComplete: () => r.destroy() });
  }

  private stairsPrompt() {
    const f = this.state.floor;
    const player = unitById(this.state, 'player')!;
    if (this.busy || !f.stairs || !samePos(f.stairs, player.pos)) return;
    this.hud.choose(t('dungeon.ui.stairsPrompt'), [
      { label: t('dungeon.ui.stairsGo'), onPick: () => this.perform({ type: 'stairs' }) },
      { label: t('dungeon.ui.stairsStay'), onPick: () => {} },
    ]);
  }

  update(time: number) {
    if (!this.state || this.busy || this.ended) return;
    if (this.hud?.busy) {
      this.queued = undefined;
      this.autoPath = [];
      return;
    }
    const held = this.heldDir();
    if (!held) this.heldSince = 0;
    else if (!this.heldSince) this.heldSince = time;
    if (held) {
      // Aus dem Stand kurz warten, ob noch eine zweite Taste für einen Schrägschritt kommt
      if (!held.includes('-') && time - this.heldSince < COMBINE_MS) return;
      this.autoPath = [];
      this.queued = undefined;
      return void this.perform({ type: 'move', dir: held });
    }
    if (this.queued) {
      const action = this.queued;
      this.queued = undefined;
      return void this.perform(action);
    }
    const next = this.autoPath.shift();
    if (next) void this.perform({ type: 'move', dir: next }, true);
  }

  // ---------- Züge ----------

  private visibleEnemies(): number {
    return this.state.units.filter((u) => u.side === 'enemy' && u.hp > 0 && teamSees(content, this.state, u.pos)).length;
  }

  /** Führt eine Aktion aus, sichert den Stand und spielt die Ereignisse ab. */
  private async perform(action: Action, auto = false) {
    if (this.busy || this.ended) return;
    const enemiesBefore = this.visibleEnemies();
    const events = act(content, this.state, action);
    if (events.length === 0) {
      this.autoPath = [];
      return;
    }
    updateSave({ dungeon: this.state });
    this.busy = true;
    await this.play(events);
    this.busy = false;
    if (this.ended) return;
    this.syncViews();
    this.refreshVisibility();
    this.hud.refresh(this.state, this.names);
    // Automatisches Laufen stoppt, sobald etwas passiert
    const quiet = events.every((e) => e.type === 'move' || e.type === 'face');
    if (auto && (!quiet || this.visibleEnemies() > enemiesBefore)) this.autoPath = [];
    if (this.state.pendingLearn?.length) {
      this.autoPath = [];
      this.askLearn();
    } else if (events.some((e) => e.type === 'onStairs')) {
      this.autoPath = [];
      this.stairsPrompt();
    }
  }

  /** Neue Fähigkeit aus einem Stufenaufstieg bei 4 aktiven: Was wird verlernt? */
  private askLearn() {
    const pending = this.state.pendingLearn?.[0];
    if (!pending) return;
    const unit = unitById(this.state, pending.id);
    if (!unit) return;
    this.hud.askForget(this.nameOf(unit.id), unit.moves.map((m) => m.id), pending.move, (forget) => void this.perform({ type: 'learn', forget }));
  }

  /** Sicherheitsnetz: Ansichten exakt an den Zustand angleichen */
  private syncViews() {
    for (const [id, view] of this.views) {
      const u = unitById(this.state, id);
      if (!u || u.hp <= 0) {
        if (u?.side !== 'team') {
          view.body.destroy();
          this.views.delete(id);
        }
        continue;
      }
      const c = center(u.pos);
      view.body.setPosition(c.x, c.y).setDepth(1000 + c.y);
    }
    for (const u of this.state.units) if (u.hp > 0 && !this.views.has(u.id)) this.addView(u);
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private say(speaker: string | undefined, lines: string[], portrait?: string): Promise<void> {
    return new Promise((resolve) => this.hud.say(speaker, lines, resolve, portrait));
  }

  private nameOf(id: string): string {
    const u = unitById(this.state, id);
    return this.names[id] ?? (u ? t(`dungeon.enemies.${u.species}`) : '');
  }

  private log(keyName: string, vars: Record<string, string | number> = {}) {
    this.hud.addLog(t(`dungeon.log.${keyName}`, vars));
  }

  /** Spielt die Ereignisse eines Zuges nacheinander ab; Bewegungen laufen gleichzeitig. */
  private async play(events: GameEvent[]) {
    let i = 0;
    while (i < events.length) {
      if (events[i].type === 'move') {
        const moves: Extract<GameEvent, { type: 'move' }>[] = [];
        while (i < events.length && events[i].type === 'move') moves.push(events[i++] as Extract<GameEvent, { type: 'move' }>);
        await Promise.all(moves.map((m) => this.animateMove(m.id, m.to)));
        continue;
      }
      await this.playOne(events[i++]);
    }
  }

  private async animateMove(id: string, to: Pos) {
    const view = this.views.get(id);
    if (!view) return;
    const from = { x: Math.floor(view.body.x / TILE), y: Math.floor(view.body.y / TILE) };
    const dir = dirTo(from, to);
    if (dir) this.face(view, dir);
    const c = center(to);
    if (view.walkFrames) {
      view.sprite.setTexture(view.walkFrames[1 + (Math.round(c.x + c.y) / TILE) % 2]);
      this.time.delayedCall(MOVE_MS * 0.6, () => view.sprite.setTexture(view.walkFrames![0]));
    } else if (!view.boss && dir) {
      const col = actorFrame(horizontalOf(dir) ?? (dir as 'up' | 'down'));
      view.sprite.setFrame(col + 4);
      this.time.delayedCall(MOVE_MS * 0.6, () => view.sprite.setFrame(col));
    }
    await this.tween({ targets: view.body, x: c.x, y: c.y, duration: MOVE_MS, onUpdate: () => view.body.setDepth(1000 + view.body.y) });
  }

  private fx(id: string, at: { x: number; y: number }) {
    const def = tileset.fx[id] ?? tileset.fx.cut;
    const animKey = `fxanim-${id}`;
    if (!this.anims.exists(animKey)) this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(fxKey(id in tileset.fx ? id : 'cut'), { start: 0, end: def.frames - 1 }), frameRate: 22 });
    const sprite = this.add.sprite(at.x, at.y, fxKey(id in tileset.fx ? id : 'cut')).setDepth(3000).setScale(0.6);
    sprite.play(animKey);
    sprite.once('animationcomplete', () => sprite.destroy());
  }

  private floatText(id: string, text: string, color: string) {
    const view = this.views.get(id);
    if (!view) return;
    const label = this.add
      .text(view.body.x, view.body.y - 10, text, { fontFamily: '"Dorfschrift", sans-serif', fontSize: '10px', color, stroke: '#120f22', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5)
      .setDepth(3100);
    this.tweens.add({ targets: label, y: label.y - 10, alpha: 0, duration: 700, delay: 200, onComplete: () => label.destroy() });
  }

  private async playOne(e: GameEvent) {
    const s = this.state;
    switch (e.type) {
      case 'face': {
        const view = this.views.get(e.id);
        if (view) this.face(view, e.dir);
        return;
      }
      case 'use': {
        if (e.move === 'attack') this.log('attack', { name: this.nameOf(e.id) });
        else this.log('use', { name: this.nameOf(e.id), move: t(`moves.${e.move}.name`) });
        const view = this.views.get(e.id);
        const u = unitById(s, e.id);
        if (view && u) {
          const target = center({ x: u.pos.x + (u.facing.includes('left') ? -1 : u.facing.includes('right') ? 1 : 0), y: u.pos.y + (u.facing.startsWith('up') ? -1 : u.facing.startsWith('down') ? 1 : 0) });
          const back = { x: view.body.x, y: view.body.y };
          await this.tween({ targets: view.body, x: back.x + (target.x - back.x) * 0.3, y: back.y + (target.y - back.y) * 0.3, duration: 70, yoyo: true });
        }
        return;
      }
      case 'projectile': {
        const from = center(e.from);
        const to = center(e.to);
        const ball = this.add.circle(from.x, from.y, 3, e.fx === 'water' ? 0x7cc4e0 : e.fx === 'plant' ? 0x8fd06b : e.fx === 'rock' ? 0xa89a8a : 0xfff2b0).setDepth(2500);
        const dist = Math.max(Math.abs(e.to.x - e.from.x), Math.abs(e.to.y - e.from.y));
        await this.tween({ targets: ball, x: to.x, y: to.y, duration: 40 + dist * 35 });
        ball.destroy();
        return;
      }
      case 'hit': {
        const view = this.views.get(e.id);
        if (view) {
          this.fx(e.fx, { x: view.body.x, y: view.body.y - 4 });
          view.sprite.setTint(0xff8080);
          this.time.delayedCall(140, () => view.sprite.clearTint());
          this.floatText(e.id, `${e.amount}`, e.crit ? '#ffd27a' : '#fff8ea');
        }
        if (e.crit) this.log('crit');
        this.log('hit', { name: this.nameOf(e.id), amount: e.amount });
        await this.wait(160);
        return;
      }
      case 'miss':
        this.log(e.air ? 'missAir' : 'miss', { name: this.nameOf(e.id) });
        this.floatText(e.id, '–', COLORS.textDim);
        await this.wait(90);
        return;
      case 'heal':
        if (e.amount > 0) {
          this.floatText(e.id, `+${e.amount}`, '#9fe58a');
          this.log('heal', { name: this.nameOf(e.id), amount: e.amount });
        } else {
          this.log('ppRestored', { name: this.nameOf(e.id) });
        }
        await this.wait(120);
        return;
      case 'status': {
        const view = this.views.get(e.id);
        if (view && (e.status === 'guard' || e.status === 'focus')) this.fx(e.status === 'guard' ? 'shield' : 'boost', { x: view.body.x, y: view.body.y - 4 });
        this.hud.addLog(t(`dungeon.log.statusOn.${e.status}`, { name: this.nameOf(e.id) }));
        await this.wait(100);
        return;
      }
      case 'statusEnd':
        this.hud.addLog(t(`dungeon.log.statusOff.${e.status}`, { name: this.nameOf(e.id) }));
        return;
      case 'asleep':
        this.floatText(e.id, 'Zzz', '#c8d4ff');
        this.log('asleep', { name: this.nameOf(e.id) });
        await this.wait(120);
        return;
      case 'noPp':
        this.log('noPp');
        return;
      case 'faint': {
        const u = unitById(s, e.id);
        this.log(u?.side === 'enemy' ? 'faintEnemy' : 'faintTeam', { name: this.nameOf(e.id) });
        const view = this.views.get(e.id);
        if (view && u?.side !== 'team') {
          await this.tween({ targets: view.body, alpha: 0, scale: 0.6, duration: 260 });
          view.body.destroy();
          this.views.delete(e.id);
        }
        return;
      }
      case 'xp':
        if (e.id === 'player') this.log('xp', { name: this.nameOf(e.id), amount: e.amount });
        return;
      case 'levelUp': {
        const view = this.views.get(e.id);
        if (view) this.fx('boost', { x: view.body.x, y: view.body.y - 4 });
        this.log('levelUp', { name: this.nameOf(e.id), level: e.level });
        if (e.learned) this.log('learned', { name: this.nameOf(e.id), move: t(`moves.${e.learned}.name`) });
        await this.wait(300);
        return;
      }
      case 'learned': {
        const view = this.views.get(e.id);
        if (view) this.fx('boost', { x: view.body.x, y: view.body.y - 4 });
        this.log('learned', { name: this.nameOf(e.id), move: t(`moves.${e.move}.name`) });
        if (e.forgot) this.log('forgot', { name: this.nameOf(e.id), move: t(`moves.${e.forgot}.name`) });
        await this.wait(300);
        return;
      }
      case 'learnSkipped':
        this.log('skipped', { name: this.nameOf(e.id), move: t(`moves.${e.move}.name`) });
        return;
      case 'pickup': {
        const p = unitById(s, e.id)!.pos;
        this.items.get(key(p))?.destroy();
        this.items.delete(key(p));
        this.log('pickup', { item: bagEntryName(e.item) });
        return;
      }
      case 'bagFull':
        this.log('bagFull', { item: bagEntryName(e.item) });
        return;
      case 'itemUsed': {
        const item = bagEntryName(e.item);
        const def = bagEntryDef(e.item);
        if (def.use === 'throw') this.log('itemThrow', { name: this.nameOf(e.id), item });
        else if (e.target === 'player') this.log('itemSelf', { name: this.nameOf(e.id), item });
        else this.log('itemGive', { name: this.nameOf(e.id), target: this.nameOf(e.target), item });
        return;
      }
      case 'trap': {
        const p = unitById(s, e.id)!.pos;
        this.traps.get(key(p))?.setVisible(true);
        const view = this.views.get(e.id);
        if (view) this.fx('claw', { x: view.body.x, y: view.body.y });
        this.floatText(e.id, `${e.amount}`, '#fff8ea');
        this.log('trap', { name: this.nameOf(e.id), amount: e.amount });
        await this.wait(200);
        return;
      }
      case 'onStairs':
        return;
      case 'join':
        await this.say(this.nameOf(e.id), t.list('dungeon.stups.found'), faceKey('axolotl'));
        return;
      case 'rescued':
        await this.say(t('dungeon.enemies.stups'), t.list('dungeon.stups.rescued'), faceKey('axolotl'));
        return;
      case 'escortLost':
        this.log('escortLost');
        return;
      case 'floor':
        await this.changeFloor();
        return;
      case 'summon':
        this.log('summon');
        for (const id of e.ids) {
          const u = unitById(s, id);
          if (u) {
            const view = this.addView(u);
            this.fx('spark', { x: view.body.x, y: view.body.y - 4 });
          }
        }
        await this.wait(300);
        return;
      case 'spawn': {
        const u = unitById(s, e.id);
        if (u) this.addView(u).body.setVisible(false);
        return;
      }
      case 'bossCalm': {
        const view = this.views.get('boss');
        if (view) await this.tween({ targets: view.sprite, alpha: 0.5, duration: 500 });
        await this.say(t('dungeon.enemies.waldgeist'), t.list('dungeon.boss.calm'), faceKey('forestSpirit'));
        return;
      }
      case 'cleared':
        await this.finish(t.list('dungeon.cleared'));
        return;
      case 'defeated':
        await this.finish(t.list('dungeon.defeated'));
        return;
    }
  }

  private async changeFloor() {
    const cam = this.cameras.main;
    await new Promise<void>((resolve) => {
      cam.fadeOut(300, 14, 26, 18);
      cam.once('camerafadeoutcomplete', () => resolve());
    });
    this.buildFloor();
    this.hud.refresh(this.state, this.names);
    cam.fadeIn(400, 14, 26, 18);
    this.hud.addLog(this.state.floor.boss ? t('dungeon.bossFloor') : t('dungeon.floor', { n: this.state.floor.number }));
    if (this.state.floor.boss) {
      await this.wait(400);
      this.busy = true;
      await this.bossIntro();
    }
  }

  /** Ende des Durchgangs: Ergebnis ins Dorf übernehmen und heimkehren. */
  private async finish(lines: string[]) {
    this.ended = true;
    // Offene Fähigkeiten aus dem letzten Kampf (z. B. Aufstieg nach dem Boss) erst entscheiden, dann heimkehren
    while (this.state.pendingLearn?.length) {
      const { id, move } = this.state.pendingLearn[0];
      const unit = unitById(this.state, id)!;
      const forget = await new Promise<number | null>((resolve) => this.hud.askForget(this.nameOf(id), unit.moves.map((m) => m.id), move, resolve));
      const events = act(content, this.state, { type: 'learn', forget });
      if (events.length === 0) break;
      await this.play(events);
    }
    const save = getSave();
    const result = settleRun(content, this.state, save.quests ?? {});
    updateSave({
      dungeon: undefined,
      team: result.team,
      bag: result.bag,
      quests: result.quests,
      dungeonCleared: save.dungeonCleared || result.cleared,
      village: { player: { ...village.def.gateExit }, partner: { ...village.def.gatePartner } },
    });
    const extra = result.moss > 0 ? [t('village.afterDungeon.mossMissing', { n: result.moss, needed: content.dungeon.quests.leuchtmoos.needed })] : [];
    await this.say(undefined, [...lines, ...extra], creatureTexture(this, archetypeById(save.partnerId!)));
    this.scene.stop('DungeonHud');
    this.cameras.main.fadeOut(500, 26, 24, 48);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Village'));
  }
}
