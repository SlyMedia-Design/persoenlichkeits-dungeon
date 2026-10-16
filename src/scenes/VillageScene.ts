import Phaser from 'phaser';
import { archetypeById, bonusDefs, dungeonContent, rewardTable, t, village, withNames } from '../content';
import { startRun } from '../core/dungeon/engine';
import { canStep, combineDirs, dirTo, findPath, horizontalOf, samePos, step, type Dir, type Pos } from '../core/grid';
import { randomStone } from '../core/dungeon/generate';
import { createRandom } from '../core/dungeon/random';
import { grantReward, rollReward } from '../core/rewards';
import { gardenUnlocked, harvest, isRipe, normalizeGarden, plant, runsLeft, type Garden } from '../core/garden';
import { acceptQuest, approachTiles, completeQuest, interactionAt, isWalkable, pickDialog, questMarker, type Placement } from '../core/village';
import { getSave, updateSave } from '../state';
import { ambient } from '../ui/ambient';
import { bagEntryName, groupEntries } from '../ui/items';
import { markerTexture } from '../ui/markers';
import { pixelZoom } from '../ui/camera';
import { bindFastForward } from '../ui/speed';
import { creatureTexture, fieldTexture, shadowTexture } from '../ui/sprites';
import { BORDER, TILE, actorFrame, actorKey, faceKey, itemKey, preloadTileset, tileTexture, tileset, villageMapTexture } from '../ui/tiles';
import { COLORS, FONT } from '../ui/theme';
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
  /** ! und ? über NPCs mit eigenem Auftrag */
  private markers = new Map<string, Phaser.GameObjects.Image>();
  /** Namensschilder über den Bewohnern (erscheinen, wenn man näher kommt) */
  private nameTags = new Map<string, Phaser.GameObjects.Text>();
  /** Pflanzen auf dem Beerenfeld */
  private plants: Phaser.GameObjects.GameObject[] = [];
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
  /** Kamerafahrt über das Dorf beim ersten Besuch (überspringbar) */
  private intro?: Phaser.Tweens.Tween;

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
    this.markers.clear();
    this.nameTags.clear();
    this.plants = [];
    ambient.setBrightness(1);
    this.cameras.main.setBackgroundColor(COLORS.night);

    const b = BORDER * TILE;
    this.add.image(-b, -b, villageMapTexture(this, village)).setOrigin(0).setDepth(-1);

    const def = village.def;
    // Ältere Spielstände können auf Feldern stehen, die es so nicht mehr gibt: dann zum Startpunkt
    const saved = save.village;
    const valid = saved && walkable(saved.player) && walkable(saved.partner);
    const start: Placement = valid ? saved.player : def.spawn;
    this.player = this.addCreature(start, start.facing, save.archetypeId);
    this.partner = this.addCreature(valid ? saved.partner : def.partnerSpawn, start.facing, save.partnerId);
    for (const npc of def.npcs) this.npcs.set(npc.id, this.addActor(npc, npc.facing, actorKey(npc.sprite)));
    [this.player, this.partner, ...this.npcs.values()].forEach((actor, i) => this.idle(actor, 200 + i * 350));
    this.drawGarden();
    for (const npc of def.npcs) this.addNameTag(npc.id);
    this.refreshMarkers();
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.npcLife() });

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

  /**
   * Erster Besuch: Der Partner will sein Dorf zeigen, die Kamera fährt einmal von links nach rechts
   * über das Dorf (überspringbar), danach erzählt der Partner weiter. Sonst nur der Steuerungshinweis.
   */
  private greet() {
    const save = getSave();
    // Zurück vom besänftigten Waldgeist: Ende des Prototyps mit Feedback-Knopf (einmalig)
    if (save.dungeonCleared && !save.prototypeEndSeen) {
      updateSave({ prototypeEndSeen: true });
      this.hud.openPrototypeEnd();
      return;
    }
    if (save.villageIntroSeen || !save.partnerId) {
      this.hud.showHint();
      return;
    }
    const portrait = creatureTexture(this, archetypeById(save.partnerId));
    this.hud.say(save.partnerName, t.list('village.arrival'), () =>
      this.introPan(() => {
        updateSave({ villageIntroSeen: true });
        this.hud.say(save.partnerName, t.list('village.arrivalAfter'), undefined, portrait);
        this.hud.showHint();
      }),
    portrait);
  }

  private introPan(onDone: () => void) {
    const cam = this.cameras.main;
    cam.stopFollow();
    const y = (village.height * TILE) / 2;
    const glide = { x: 0 };
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.intro?.stop();
      this.input.off('pointerup', finish);
      this.input.keyboard?.off('keydown', finish);
      this.hud.showBanner(undefined);
      cam.startFollow(this.player.body, true, 0.18, 0.18);
      // Erst im nächsten Moment freigeben, damit der Tipp zum Überspringen nicht gleich als Laufziel zählt
      this.time.delayedCall(80, () => (this.intro = undefined));
      onDone();
    };
    this.intro = this.tweens.add({
      targets: glide,
      x: village.width * TILE,
      duration: 7000,
      ease: 'Sine.easeInOut',
      onUpdate: () => cam.centerOn(glide.x, y),
      onComplete: finish,
    });
    this.hud.showBanner(t('village.intro.skip'));
    // Antippen oder eine Taste überspringt die Fahrt
    this.time.delayedCall(200, () => {
      this.input.once('pointerup', finish);
      this.input.keyboard?.once('keydown', finish);
    });
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
        if (this.intro || this.hud.busy || this.leaving) return;
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this.queuedAction = true;
        this.queuedVertical = vertical[e.code] ?? this.queuedVertical;
        this.queuedHorizontal = horizontal[e.code] ?? this.queuedHorizontal;
      });
    }
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      ambient.unlock();
      if (this.intro || this.hud.busy || this.hud.consumed(pointer) || this.leaving) return;
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
    if (!this.player || this.leaving || this.intro) return;
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
      const onDone = () => {
        // Erfüllter Auftrag: Nach dem Gespräch gibt es die zufällige Belohnung
        if (rule.complete) this.completeWithReward(rule.complete);
        // Auftrag, den der NPC selbst vergibt: Nach dem Gespräch ist er angenommen
        if (rule.accept) updateSave({ quests: acceptQuest(getSave().quests ?? {}, rule.accept) });
        this.refreshMarkers();
        this.drawGarden();
      };
      this.hud.say(t(`village.npcs.${interaction.npc.id}.name`), lines, onDone, faceKey(interaction.npc.sprite));
    } else if (interaction.kind === 'board') {
      this.hud.openBoard();
    } else if (interaction.kind === 'dungeon') {
      const level = { level: dungeonContent.dungeon.level, team: save.team?.player.level ?? dungeonContent.battle.startLevel };
      this.hud.choose(t('village.gate.prompt', level), [
        { label: t('village.gate.go'), onPick: () => this.enterDungeon() },
        { label: t('village.gate.stay'), onPick: () => {} },
      ]);
    } else if (interaction.kind === 'plot') {
      this.usePlot(interaction.index);
    } else {
      this.hud.say(undefined, [withNames(t(interaction.text), names)]);
    }
  }

  // ---------- Beerenfeld ----------

  private garden(): Garden {
    return normalizeGarden(village.def.garden, getSave().garden);
  }

  /** Samen, wachsende Sprossen oder reife Pflanze mit Beere je Beet */
  private drawGarden() {
    for (const p of this.plants) p.destroy();
    this.plants = [];
    const def = village.def.garden;
    if (!gardenUnlocked(def, getSave().quests ?? {})) return;
    this.garden().forEach((plot, i) => {
      if (!plot) return;
      const x = def.plots[i].x * TILE + TILE / 2;
      const y = def.plots[i].y * TILE + TILE / 2;
      const depth = y - 1;
      const sprouts = tileset.garden.sprouts;
      if (plot.runs === 0) {
        this.plants.push(this.add.image(x, y + 1, itemKey(tileset.garden.seeds[plot.berry])).setDepth(depth));
        return;
      }
      const stage = Math.min(sprouts.length - 1, Math.floor(((plot.runs - 1) * sprouts.length) / Math.max(1, def.growRuns - 1)));
      this.plants.push(this.add.image(x, y - 1, tileTexture(this, sprouts[isRipe(def, plot) ? sprouts.length - 1 : stage])).setDepth(depth));
      if (isRipe(def, plot)) {
        const berry = this.add.image(x, y - 4, itemKey(dungeonContent.dungeon.items[plot.berry].sprite)).setDepth(depth + 0.5).setScale(0.8);
        this.tweens.add({ targets: berry, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 200 });
        this.plants.push(berry);
      }
    });
  }

  private usePlot(index: number) {
    const def = village.def.garden;
    const save = getSave();
    if (!gardenUnlocked(def, save.quests ?? {})) return this.hud.say(undefined, [t('village.garden.fallow')]);
    const garden = this.garden();
    const plot = garden[index];
    const berryName = (id: string) => t(`dungeon.items.${id}.name`);
    if (!plot) {
      this.hud.choose(t('village.garden.choose'), [
        ...def.seeds.map((berry) => ({
          label: t('village.garden.seed', { berry: berryName(berry) }),
          onPick: () => {
            updateSave({ garden: plant(def, garden, index, berry) });
            this.drawGarden();
            this.hud.say(undefined, [t('village.garden.planted', { berry: berryName(berry), n: def.growRuns })]);
          },
        })),
        { label: t('village.garden.cancel'), onPick: () => {} },
      ]);
      return;
    }
    if (!isRipe(def, plot)) {
      const n = runsLeft(def, plot);
      return this.hud.say(undefined, [t(n === 1 ? 'village.garden.growingOne' : 'village.garden.growing', { berry: berryName(plot.berry), n })]);
    }
    const result = harvest(def, garden, index, save.bag ?? [], dungeonContent.dungeon.bag.size);
    if (result.picked === 0) return this.hud.say(undefined, [t('village.garden.bagFull')]);
    updateSave({ garden: result.garden, bag: result.bag });
    this.drawGarden();
    const lines = [t('village.garden.harvested', { n: result.picked, berry: berryName(plot.berry) })];
    if (result.left > 0) lines.push(t('village.garden.partial', { left: result.left }));
    this.hud.say(undefined, lines);
  }

/** Auftrag abschließen und die zufällige Belohnung (mit Mindestwert) in Beutel und Geldbörse legen */
  private completeWithReward(id: string) {
    const save = getSave();
    const log = save.quests ?? {};
    if (log[id] !== 'ready') return;
    const minValue = village.def.quests.find((q) => q.id === id)?.reward.minValue ?? 0;
    const rng = createRandom(Math.floor(Math.random() * 2 ** 31));
    const reward = rollReward(rewardTable, minValue, rng, (r) => randomStone(dungeonContent, r)!);
    const granted = grantReward(rewardTable, reward, save.bag ?? [], save.money ?? 0, dungeonContent.dungeon.bag.size);
    updateSave({ quests: completeQuest(log, id), bag: granted.bag, money: granted.money });
    const things = [...groupEntries(reward.items)].map(([item, n]) => (n.length > 1 ? `${n.length}× ${bagEntryName(item)}` : bagEntryName(item)));
    if (reward.money > 0) things.push(t('village.reward.money', { n: reward.money }));
    const lines = [t('village.reward.got', { list: things.join(', ') })];
    if (granted.converted.length > 0) lines.push(t('village.reward.converted', { items: granted.converted.map(bagEntryName).join(', ') }));
    // Die Münzanzeige zeichnet sich mit dem Dialog neu
    this.hud.say(undefined, lines);
  }

  private addNameTag(id: string) {
    const actor = this.npcs.get(id)!;
    const tag = this.add
      .text(0, 0, t(`village.npcs.${id}.name`), { fontFamily: FONT, fontSize: '6px', color: COLORS.text, backgroundColor: '#1a1830cc', padding: { x: 2, y: 1 }, resolution: 8 })
      .setOrigin(0.5, 1)
      .setAlpha(0);
    actor.body.add(tag);
    this.nameTags.set(id, tag);
  }

  /**
   * Bewohner wirken lebendig: Kommt man näher, drehen sie sich zu einem um und zeigen ihren Namen.
   * Sonst schauen sie ab und zu kurz umher und wippen dabei.
   */
  private npcLife() {
    if (!this.player || this.intro) return;
    for (const npc of village.def.npcs) {
      const actor = this.npcs.get(npc.id);
      const tag = this.nameTags.get(npc.id);
      if (!actor || !tag) continue;
      const dx = this.player.pos.x - actor.pos.x;
      const dy = this.player.pos.y - actor.pos.y;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const show = dist <= 3;
      if (show !== tag.getData('shown')) {
        tag.setData('shown', show);
        this.tweens.add({ targets: tag, alpha: show ? 1 : 0, duration: 250 });
      }
      if (this.hud.busy) continue;
      if (dist <= 2) {
        const toward: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (actor.facing !== toward) this.face(actor, toward);
      } else if (actor.facing !== npc.facing && !actor.body.getData('glancing')) {
        this.face(actor, npc.facing);
      } else if (Math.random() < 0.02 && !actor.body.getData('glancing')) {
        this.glance(actor, npc.facing);
      }
    }
  }

  /** Kurz in eine andere Richtung schauen und dabei leicht wippen */
  private glance(actor: Actor, home: Dir) {
    const options = (['down', 'left', 'right', 'up'] as const).filter((d) => d !== home);
    actor.body.setData('glancing', true);
    this.face(actor, options[Math.floor(Math.random() * options.length)]);
    this.tweens.add({ targets: actor.sprite, y: FEET_Y - 2, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
    this.time.delayedCall(1400, () => {
      actor.body.setData('glancing', false);
      this.face(actor, home);
    });
  }

  /** Namensschild über dem Zeichen ! oder ? (falls vorhanden), sonst direkt über dem Kopf */
  private placeNameTag(id: string) {
    const tag = this.nameTags.get(id);
    if (tag) tag.y = FEET_Y - 17 - (this.markers.has(id) ? 10 : 0);
  }

  /** Zeichen über NPCs mit eigenem Auftrag neu setzen (! offen, ? erfüllt) */
  private refreshMarkers() {
    const log = getSave().quests ?? {};
    for (const npc of village.def.npcs) {
      const actor = this.npcs.get(npc.id);
      if (!actor) continue;
      const mark = questMarker(npc, log, village.def.npcs);
      const old = this.markers.get(npc.id);
      if (old && (!mark || old.texture.key !== markerTexture(this, mark))) {
        old.destroy();
        this.markers.delete(npc.id);
      }
      this.placeNameTag(npc.id);
      if (!mark || this.markers.has(npc.id)) continue;
      const marker = this.add.image(0, FEET_Y - 19, markerTexture(this, mark)).setOrigin(0.5, 1);
      actor.body.add(marker);
      this.tweens.add({ targets: marker, y: marker.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.markers.set(npc.id, marker);
      this.placeNameTag(npc.id);
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
      questBag: save.questBag,
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
