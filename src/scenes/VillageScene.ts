import Phaser from 'phaser';
import { archetypeById, bonusDefs, dungeonContent, t, village, withNames } from '../content';
import { startRun } from '../core/dungeon/engine';
import { canStep, combineDirs, dirTo, findPath, horizontalOf, samePos, step, type Dir, type Pos } from '../core/grid';
import { approachTiles, completeQuest, interactionAt, isWalkable, pickDialog, type Placement } from '../core/village';
import { getSave, updateSave } from '../state';
import { ambient } from '../ui/ambient';
import { pixelZoom } from '../ui/camera';
import { bindFastForward } from '../ui/speed';
import { creatureTexture, fieldTexture, shadowTexture } from '../ui/sprites';
import { BORDER, TILE, actorFrame, actorKey, faceKey, preloadTileset, villageMapTexture } from '../ui/tiles';
import { COLORS } from '../ui/theme';
import type { VillageHudScene } from './VillageHudScene';

/** Dauer eines Schritts in Millisekunden */
const STEP_MS = 190;
/** Schräge Schritte sind länger und dauern entsprechend etwas länger */
const DIAGONAL_MS = Math.round(STEP_MS * 1.3);
/** Fußpunkt der Figuren relativ zur Feldmitte */
const FEET_Y = 7;
/** Wartezeit nach dem ersten Tastendruck, damit zwei Tasten gemeinsam einen Schrägschritt ergeben */
const COMBINE_MS = 60;

interface Actor {
  pos: Pos;
  facing: Dir;
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  /** Laufbilder [Stand, linker Fuß, rechter Fuß] unserer Wesen; Pack-Figuren haben Bilder je Richtung */
  walkFrames?: string[];
  steps: number;
}

const walkable = (p: Pos) => isWalkable(village, p);

/**
 * Das begehbare Dorf. Bewegung auf dem Raster (auch schräg), flüssig animiert, ohne Züge.
 * Die Regeln (Begehbarkeit, Wegsuche, Dialogauswahl) liegen in src/core.
 */
export class VillageScene extends Phaser.Scene {
  private player!: Actor;
  private partner!: Actor;
  private npcs = new Map<string, Actor>();
  private hud!: VillageHudScene;
  private moving = false;
  private path: Dir[] = [];
  private pendingTarget?: Pos;
  private leaving = false;
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  /** Kurze Tastendrücke merken, damit keiner verloren geht (auch wenn er kürzer als ein Bild ist) */
  private queuedAction = false;
  private queuedVertical?: 'up' | 'down';
  private queuedHorizontal?: 'left' | 'right';
  /** Seit wann eine Richtungstaste gehalten wird (0 = keine) */
  private heldSince = 0;

  constructor() {
    super('Village');
  }

  preload() {
    preloadTileset(this);
  }

  create() {
    const save = getSave();
    if (!save.archetypeId || !save.partnerId || !save.playerName || !save.partnerName) {
      this.scene.start('Title');
      return;
    }
    this.leaving = false;
    this.moving = false;
    this.path = [];
    this.pendingTarget = undefined;
    this.heldSince = 0;
    this.npcs.clear();
    ambient.setBrightness(1);
    this.cameras.main.setBackgroundColor(COLORS.night);

    const b = BORDER * TILE;
    this.add.image(-b, -b, villageMapTexture(this, village)).setOrigin(0).setDepth(-1);

    const def = village.def;
    const start: Placement = save.village?.player ?? def.spawn;
    this.player = this.addCreature(start, start.facing, save.archetypeId);
    this.partner = this.addCreature(save.village?.partner ?? def.partnerSpawn, start.facing, save.partnerId);
    for (const npc of def.npcs) this.npcs.set(npc.id, this.addActor(npc, npc.facing, actorKey(npc.sprite)));
    [this.player, this.partner, ...this.npcs.values()].forEach((actor, i) => this.idle(actor, 200 + i * 350));

    const cam = this.cameras.main;
    cam.setBounds(-b, -b, village.width * TILE + 2 * b, village.height * TILE + 2 * b);
    cam.startFollow(this.player.body, true, 0.18, 0.18);
    this.applyZoom();
    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);

    this.setupInput();
    bindFastForward(this);

    this.scene.launch('VillageHud');
    this.hud = this.scene.get('VillageHud') as VillageHudScene;
    this.hud.onLeave = (key, data) => this.leave(key, data);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.scene.stop('VillageHud');
    });

    cam.fadeIn(500, 26, 24, 48);
    // Die HUD-Szene ist erst im nächsten Bild bereit
    this.time.delayedCall(450, () => this.greet());
  }

  /** Begrüßung beim ersten Besuch, danach der Steuerungshinweis */
  private greet() {
    const save = getSave();
    if (!save.villageIntroSeen && save.partnerId) {
      const portrait = creatureTexture(this, archetypeById(save.partnerId));
      this.hud.say(save.partnerName, t.list('village.arrival'), () => updateSave({ villageIntroSeen: true }), portrait);
    }
    this.hud.showHint();
  }

  private applyZoom() {
    this.cameras.main.setZoom(pixelZoom(this.scale.width, this.scale.height));
    this.cameras.main.centerOn(this.player.body.x, this.player.body.y);
  }

  private addCreature(pos: Pos, facing: Dir, archetypeId: string): Actor {
    const archetype = archetypeById(archetypeId);
    const frames = ([0, 1, 2] as const).map((walk) => fieldTexture(this, archetype, walk));
    return this.addActor(pos, facing, frames[0], frames);
  }

  private addActor(pos: Pos, facing: Dir, texture: string, walkFrames?: string[]): Actor {
    const shadow = this.add.image(0, 6, shadowTexture(this));
    // Füße auf der unteren Feldkante, damit Atmen und Watscheln von unten aus wirken
    const sprite = this.add.image(0, FEET_Y, texture).setOrigin(0.5, 1);
    const body = this.add.container(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, [shadow, sprite]);
    body.setDepth(body.y);
    const actor: Actor = { pos: { x: pos.x, y: pos.y }, facing, body, sprite, walkFrames, steps: 0 };
    this.face(actor, facing);
    return actor;
  }

  /** Blickrichtung: unsere Wesen werden gespiegelt, Pack-Figuren haben ein Bild je Richtung. */
  private face(actor: Actor, dir: Dir) {
    actor.facing = dir;
    const horizontal = horizontalOf(dir);
    if (!actor.walkFrames) {
      actor.sprite.setFrame(actorFrame(horizontal ?? (dir as 'up' | 'down')));
      return;
    }
    if (horizontal) actor.sprite.setFlipX(horizontal === 'left');
  }

  /** Leichtes Atmen im Stand */
  private idle(actor: Actor, delay: number) {
    this.tweens.add({ targets: actor.sprite, scaleY: 0.94, duration: 800, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private setupInput() {
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as typeof this.keys;
      kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
      const vertical: Record<string, 'up' | 'down'> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
      const horizontal: Record<string, 'left' | 'right'> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
      kb.on('keydown', (e: KeyboardEvent) => {
        // Bei offenem Dialog gehört die Taste der Oberfläche
        if (this.hud.busy || this.leaving) return;
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this.queuedAction = true;
        this.queuedVertical = vertical[e.code] ?? this.queuedVertical;
        this.queuedHorizontal = horizontal[e.code] ?? this.queuedHorizontal;
      });
    }
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      ambient.unlock();
      if (this.hud.busy || this.hud.consumed(pointer) || this.leaving) return;
      // Ziehen (z. B. Scrollen) ist kein Antippen
      if (pointer.getDistance() > 12) return;
      this.tapTile({ x: Math.floor(pointer.worldX / TILE), y: Math.floor(pointer.worldY / TILE) });
    });
  }

  /** Gehaltene Richtungstasten; zwei Tasten zusammen (z. B. W + A) ergeben eine Schrägrichtung. */
  private heldDir(): Dir | undefined {
    const k = this.keys;
    if (!k) return undefined;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    return combineDirs(up === down ? undefined : up ? 'up' : 'down', left === right ? undefined : left ? 'left' : 'right');
  }

  private clearQueue() {
    this.queuedAction = false;
    this.queuedVertical = undefined;
    this.queuedHorizontal = undefined;
  }

  update(time: number) {
    if (!this.player || this.leaving) return;
    if (this.hud?.busy) {
      this.clearQueue();
      return;
    }
    const held = this.heldDir();
    if (!held) this.heldSince = 0;
    else if (!this.heldSince) this.heldSince = time;
    if (this.moving) return;

    const dir = held ?? combineDirs(this.queuedVertical, this.queuedHorizontal);
    if (dir) {
      // Aus dem Stand kurz warten, ob noch eine zweite Taste für einen Schrägschritt kommt
      if (held && !held.includes('-') && time - this.heldSince < COMBINE_MS) return;
      this.clearQueue();
      this.path = [];
      this.pendingTarget = undefined;
      this.tryStep(dir);
      return;
    }
    if (this.queuedAction) {
      this.clearQueue();
      this.interact(step(this.player.pos, this.player.facing));
      return;
    }
    const next = this.path.shift();
    if (next) {
      // Der Weg kann inzwischen blockiert sein: dann einfach stehen bleiben
      if (!this.tryStep(next)) this.path = [];
      return;
    }
    if (this.pendingTarget) {
      const target = this.pendingTarget;
      this.pendingTarget = undefined;
      const toTarget = dirTo(this.player.pos, target);
      if (toTarget) {
        this.face(this.player, toTarget);
        this.interact(target);
      }
    }
  }

  private tapTile(tile: Pos) {
    if (samePos(tile, this.player.pos)) return;
    let targets = [tile];
    let pending: Pos | undefined;
    if (interactionAt(village, tile)) {
      const dir = dirTo(this.player.pos, tile);
      if (dir) {
        this.path = [];
        this.face(this.player, dir);
        this.interact(tile);
        return;
      }
      targets = approachTiles(village, tile);
      pending = tile;
    } else if (!walkable(tile)) {
      return;
    }
    const path = findPath(this.player.pos, targets, walkable);
    if (!path) return;
    this.path = path;
    this.pendingTarget = pending;
    this.marker(tile);
  }

  /** Kurzes Aufleuchten des angetippten Ziels */
  private marker(tile: Pos) {
    const r = this.add
      .rectangle(tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2, TILE - 2, TILE - 2)
      .setStrokeStyle(1, 0xfff8ea, 0.9)
      .setDepth(-0.5);
    this.tweens.add({ targets: r, alpha: 0, scale: 0.6, duration: 450, onComplete: () => r.destroy() });
  }

  /** Ein Schritt; der Partner läuft auf das Feld, das der Spieler gerade verlassen hat. */
  private tryStep(dir: Dir): boolean {
    this.face(this.player, dir);
    if (!canStep(this.player.pos, dir, walkable)) return false;
    const previous = { ...this.player.pos };
    this.moving = true;
    this.move(this.player, step(previous, dir), () => {
      this.moving = false;
      this.saveState();
    });
    if (!samePos(this.partner.pos, previous)) {
      const partnerDir = dirTo(this.partner.pos, previous);
      if (partnerDir) this.face(this.partner, partnerDir);
      this.move(this.partner, previous);
    }
    return true;
  }

  /** Laufen: gleiten mit wechselndem Fuß und leichtem Watscheln */
  private move(actor: Actor, to: Pos, onDone?: () => void) {
    const dx = Math.abs(actor.pos.x - to.x);
    const dy = Math.abs(actor.pos.y - to.y);
    // Steht der Partner zu weit weg (z. B. alter Spielstand), springt er direkt hinterher
    const far = Math.max(dx, dy) > 1;
    const duration = far ? 1 : dx && dy ? DIAGONAL_MS : STEP_MS;
    actor.pos = { ...to };
    this.tweens.add({
      targets: actor.body,
      x: to.x * TILE + TILE / 2,
      y: to.y * TILE + TILE / 2,
      duration,
      onUpdate: () => actor.body.setDepth(actor.body.y),
      onComplete: () => onDone?.(),
    });
    if (!actor.walkFrames || far) return;
    const frames = actor.walkFrames;
    actor.steps++;
    const side = actor.steps % 2 === 0 ? 1 : -1;
    actor.sprite.setTexture(frames[side === 1 ? 1 : 2]);
    this.time.delayedCall(duration * 0.55, () => actor.sprite.setTexture(frames[0]));
    this.tweens.add({ targets: actor.sprite, angle: 4 * side, duration: duration / 2, yoyo: true, ease: 'Sine.easeInOut' });
  }

  private saveState() {
    updateSave({
      village: {
        player: { ...this.player.pos, facing: this.player.facing },
        partner: { ...this.partner.pos },
      },
    });
  }

  private interact(tile: Pos) {
    const interaction = interactionAt(village, tile);
    if (!interaction) return;
    const save = getSave();
    const names = { player: save.playerName, partner: save.partnerName };
    if (interaction.kind === 'npc') {
      const npc = this.npcs.get(interaction.npc.id);
      const back = dirTo(tile, this.player.pos);
      if (npc && back) this.face(npc, back);
      const rule = pickDialog(interaction.npc, save.quests ?? {});
      const lines = t.list(rule.lines).map((l) => withNames(l, names));
      // Erfüllter Auftrag: Nach dem Gespräch ist die Belohnung übergeben
      const onDone = rule.complete ? () => updateSave({ quests: completeQuest(getSave().quests ?? {}, rule.complete!) }) : undefined;
      this.hud.say(t(`village.npcs.${interaction.npc.id}.name`), lines, onDone, faceKey(interaction.npc.sprite));
    } else if (interaction.kind === 'board') {
      this.hud.openBoard();
    } else if (interaction.kind === 'dungeon') {
      const level = { level: dungeonContent.dungeon.level, team: save.team?.player.level ?? dungeonContent.battle.startLevel };
      this.hud.choose(t('village.gate.prompt', level), [
        { label: t('village.gate.go'), onPick: () => this.enterDungeon() },
        { label: t('village.gate.stay'), onPick: () => {} },
      ]);
    } else {
      this.hud.say(undefined, [withNames(t(interaction.text), names)]);
    }
  }

  /** Neuer Durchgang durch den Flüsterwald: Stufen, Beutel und Aufträge kommen aus dem Spielstand. */
  private enterDungeon() {
    const save = getSave();
    if (!save.result || !save.archetypeId || !save.partnerId) return;
    const start = { level: dungeonContent.battle.startLevel, xp: 0 };
    const quests = save.quests ?? {};
    const dungeon = startRun(dungeonContent, {
      seed: Math.floor(Math.random() * 2 ** 31),
      player: { species: save.archetypeId, ...(save.team?.player ?? start) },
      partner: { species: save.partnerId, ...(save.team?.partner ?? start) },
      z: save.result.z,
      bonusDefs,
      // Für den allerersten Ausflug gibt Oma Wurzel zwei Heilbeeren mit
      bag: save.bag ?? ['heilbeere', 'heilbeere'],
      escort: quests.verirrt === 'accepted',
      moss: quests.leuchtmoos === 'accepted',
    });
    updateSave({ dungeon });
    this.leave('Dungeon');
  }

  private leave(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    this.saveState();
    this.scene.stop('VillageHud');
    this.cameras.main.fadeOut(350, 26, 24, 48);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
