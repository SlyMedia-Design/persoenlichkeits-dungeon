import Phaser from 'phaser';

/** Schreibt Text Zeichen für Zeichen; finish() zeigt sofort alles an. */
export class Typewriter {
  private timer?: Phaser.Time.TimerEvent;
  private shown = 0;
  done = false;

  constructor(
    scene: Phaser.Scene,
    private target: Phaser.GameObjects.Text,
    private full: string,
    private onDone?: () => void,
    msPerChar = 28,
  ) {
    target.setText('');
    this.timer = scene.time.addEvent({
      delay: msPerChar,
      loop: true,
      callback: () => {
        this.shown++;
        target.setText(full.slice(0, this.shown));
        if (this.shown >= full.length) this.finish();
      },
    });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.timer?.remove();
    this.target.setText(this.full);
    this.onDone?.();
  }

  destroy() {
    this.timer?.remove();
  }
}
