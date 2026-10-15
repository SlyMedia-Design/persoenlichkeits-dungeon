import Phaser from 'phaser';

/** Wie viel schneller die Welt beim Vorspulen läuft */
export const FAST_FORWARD = 2.5;

/** Vorspulen per Knopf (Touch-Ersatz für Shift); bleibt beim Szenenwechsel eingeschaltet */
let toggled = false;

export function isFastForwardToggled(): boolean {
  return toggled;
}

export function toggleFastForward(): boolean {
  toggled = !toggled;
  return toggled;
}

/**
 * Vorspulen: Solange Shift gehalten wird (oder der Shift-Knopf eingeschaltet ist), laufen alle Tweens und Zeitgeber der Szene schneller –
 * Spielfiguren, Gegner und Animationen gleichermaßen. Im Dungeon greift das, weil jeder Zug auf seine Animationen wartet.
 */
export function bindFastForward(scene: Phaser.Scene) {
  const shift = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
  const apply = (factor: number) => {
    scene.tweens.timeScale = factor;
    scene.time.timeScale = factor;
    // Bild-Animationen (z. B. der Waldgeist) laufen über den spielweiten Animations-Manager
    scene.anims.globalTimeScale = factor;
  };
  const onUpdate = () => apply(shift?.isDown || toggled ? FAST_FORWARD : 1);
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => {
    scene.events.off('update', onUpdate);
    apply(1);
  });
}
