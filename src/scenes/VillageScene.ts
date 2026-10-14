import Phaser from 'phaser';
import { archetypeById, t, village, withNames } from '../content';
import { dirTo, findPath, samePos, step, type Dir, type Pos } from '../core/grid';
import { approachTiles, interactionAt, isWalkable, pickDialog, type Placement } from '../core/village';
import { getSave, updateSave } from '../state';
import { ambient } from '../ui/ambient';
import { fieldTexture, npcTexture, shadowTexture } from '../ui/sprites';
import { TILE, forestTexture, villageMapTexture } from '../ui/tiles';
import { COLORS } from '../ui/theme';
import type { VillageHudScene } from './VillageHudScene';

/** Dauer eines Schritts in Millisekunden */
const STEP_MS = 170;
/** Fußpunkt der Figuren relativ zur Feldmitte */
const FEET_Y = 7;
/** Waldrand um die Karte (in Feldern), damit die Figuren am Rand nicht hinter dem Dialog verschwinden */
const BORDER = 4;

interface Actor {
  pos: Pos;
  facing: Dir;
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
}

/**
 * Das begehbare Dorf. Bewegung auf dem Raster, flüssig animiert, ohne Züge.
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
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  /** Kurze Tastendrücke merken, damit keiner verloren geht (auch wenn er kürzer als ein Bild ist) */
  private queuedAction = false;
  private queuedDir?: Dir;

  constructor() {
    super('Village');
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
    this.npcs.clear();
    ambient.setBrightness(1);
    this.cameras.main.setBackgroundColor(COLORS.night);

    const b = BORDER * TILE;
    this.add
      .tileSprite(-b, -b, village.width * TILE + 2 * b, village.height * TILE + 2 * b, forestTexture(this))
      .setOrigin(0)
      .setDepth(-2);
    this.add.image(0, 0, villageMapTexture(this, village)).setOrigin(0).setDepth(-1);

    const def = village.def;
    const start: Placement = save.village?.player ?? def.spawn;
    const partnerStart = save.village?.partner ?? def.partnerSpawn;
    this.player = this.addActor(start, start.facing, fieldTexture(this, archetypeById(save.archetypeId)));
    this.partner = this.addActor(partnerStart, start.facing, fieldTexture(this, archetypeById(save.partnerId)));
    for (const npc of def.npcs) this.npcs.set(npc.id, this.addActor(npc, npc.facing, npcTexture(this, npc.id, npc.color)));
    this.idle(this.partner, 300);
    let delay = 600;
    for (const npc of this.npcs.values()) this.idle(npc, (delay += 350));

    const cam = this.cameras.main;
    cam.setBounds(-b, -b, village.width * TILE + 2 * b, village.height * TILE + 2 * b);
    cam.startFollow(this.player.body, true, 0.18, 0.18);
    this.applyZoom();
    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);

    this.setupInput();

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
    if (!save.villageIntroSeen) {
      this.hud.say(save.partnerName, t.list('village.arrival'), () => updateSave({ villageIntroSeen: true }));
    }
    this.hud.showHint();
  }

  /** Ganzzahliger Zoom, damit die Pixel scharf bleiben: am Handy ca. 8, am Desktop ca. 16 Felder breit */
  private applyZoom() {
    const { width, height } = this.scale;
    const zoom = Math.max(2, Math.round(Math.min(width / (8 * TILE), height / (10 * TILE))));
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.player.body.x, this.player.body.y);
  }

  private addActor(pos: Pos, facing: Dir, texture: string): Actor {
    const shadow = this.add.image(0, 6, shadowTexture(this));
    // Füße auf der unteren Feldkante, damit das Atmen von unten nach oben wirkt
    const sprite = this.add.image(0, FEET_Y, texture).setOrigin(0.5, 1);
    const body = this.add.container(0, 0, [shadow, sprite]);
    const actor: Actor = { pos: { x: pos.x, y: pos.y }, facing, body, sprite };
    this.place(actor);
    this.face(actor, facing);
    return actor;
  }

  private place(actor: Actor) {
    actor.body.setPosition(actor.pos.x * TILE + TILE / 2, actor.pos.y * TILE + TILE / 2);
    actor.body.setDepth(actor.body.y);
  }

  private face(actor: Actor, dir: Dir) {
    actor.facing = dir;
    if (dir === 'left') actor.sprite.setFlipX(true);
    if (dir === 'right') actor.sprite.setFlipX(false);
  }

  /** Leichtes Atmen im Stand */
  private idle(actor: Actor, delay: number) {
    this.tweens.add({ targets: actor.sprite, scaleY: 0.93, duration: 800, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private setupInput() {
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as typeof this.keys;
      const dirs: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
      kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
      kb.on('keydown', (e: KeyboardEvent) => {
        // Bei offenem Dialog gehört die Taste der Oberfläche
        if (this.hud.busy || this.leaving) return;
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this.queuedAction = true;
        else if (dirs[e.code]) this.queuedDir = dirs[e.code];
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

  private heldDir(): Dir | undefined {
    if (!this.keys) return undefined;
    const k = this.keys;
    if (k.up.isDown || k.w.isDown) return 'up';
    if (k.down.isDown || k.s.isDown) return 'down';
    if (k.left.isDown || k.a.isDown) return 'left';
    if (k.right.isDown || k.d.isDown) return 'right';
    return undefined;
  }

  update() {
    if (!this.player || this.leaving) return;
    if (this.hud?.busy) {
      this.queuedAction = false;
      this.queuedDir = undefined;
      return;
    }
    if (this.moving) return;

    const held = this.heldDir() ?? this.queuedDir;
    this.queuedDir = undefined;
    const action = this.queuedAction;
    this.queuedAction = false;
    if (held) {
      this.path = [];
      this.pendingTarget = undefined;
      this.tryStep(held);
      return;
    }
    if (action) {
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
      const dir = dirTo(this.player.pos, target);
      if (dir) {
        this.face(this.player, dir);
        this.interact(target);
      }
    }
  }

  private tapTile(tile: Pos) {
    if (samePos(tile, this.player.pos)) return;
    const interaction = interactionAt(village, tile);
    if (interaction) {
      const dir = dirTo(this.player.pos, tile);
      if (dir) {
        this.path = [];
        this.face(this.player, dir);
        this.interact(tile);
        return;
      }
      const path = findPath(this.player.pos, approachTiles(village, tile), (p) => isWalkable(village, p));
      if (path) {
        this.path = path;
        this.pendingTarget = tile;
        this.marker(tile);
      }
      return;
    }
    if (!isWalkable(village, tile)) return;
    const path = findPath(this.player.pos, [tile], (p) => isWalkable(village, p));
    if (path) {
      this.path = path;
      this.pendingTarget = undefined;
      this.marker(tile);
    }
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
    const target = step(this.player.pos, dir);
    if (!isWalkable(village, target)) return false;
    const previous = { ...this.player.pos };
    this.moving = true;
    this.move(this.player, target, () => {
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

  private move(actor: Actor, to: Pos, onDone?: () => void) {
    // Partner, der zu weit weg steht (z. B. nach Tausch), springt einfach mit
    const far = Math.abs(actor.pos.x - to.x) + Math.abs(actor.pos.y - to.y) > 1;
    actor.pos = { ...to };
    const x = to.x * TILE + TILE / 2;
    const y = to.y * TILE + TILE / 2;
    this.tweens.add({
      targets: actor.body,
      x,
      y,
      duration: far ? 1 : STEP_MS,
      onUpdate: () => actor.body.setDepth(actor.body.y),
      onComplete: () => onDone?.(),
    });
    // Kleiner Hüpfer pro Schritt
    this.tweens.add({ targets: actor.sprite, y: FEET_Y - 3, duration: STEP_MS / 2, yoyo: true, ease: 'Sine.easeOut' });
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
      const lines = t.list(pickDialog(interaction.npc, save.quests ?? {})).map((l) => withNames(l, names));
      this.hud.say(t(`village.npcs.${interaction.npc.id}.name`), lines);
    } else if (interaction.kind === 'board') {
      this.hud.openBoard();
    } else {
      this.hud.say(undefined, [withNames(t(interaction.text), names)]);
    }
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
