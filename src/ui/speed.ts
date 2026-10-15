import Phaser from 'phaser';

/** Wie viel schneller die Welt beim Vorspulen läuft */
export const FAST_FORWARD = 2.5;

/**
 * Vorspulen: Solange Shift gehalten wird, laufen alle Tweens und Zeitgeber der Szene schneller –
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
  const onUpdate = () => apply(shift?.isDown ? FAST_FORWARD : 1);
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => {
    scene.events.off('update', onUpdate);
    apply(1);
  });
}
