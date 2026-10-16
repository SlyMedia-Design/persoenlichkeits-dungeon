/**
 * Leise, prozedural erzeugte Hintergrundmusik (WebAudio, keine Audiodateien):
 * weiche Flächenakkorde und vereinzelte Glockentöne. Startet erst nach einer
 * Nutzeraktion, weil Browser vorher keinen Ton erlauben.
 */
const MUTE_KEY = 'persoenlichkeits-dungeon.muted';
const VOLUME_KEY = 'persoenlichkeits-dungeon.volume';
/** Lautstärke der Hintergrundmusik bei vollem Regler */
const FULL = 0.2;

// Fmaj7 – Cmaj7/E – Dm9 – Am7 (Frequenzen in Hz)
const CHORDS = [
  [174.61, 220.0, 261.63, 329.63],
  [164.81, 196.0, 246.94, 329.63],
  [146.83, 220.0, 261.63, 329.63],
  [110.0, 196.0, 261.63, 329.63],
];
// C-Dur-Pentatonik, hohe Lage
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

const CHORD_SECONDS = 8;

class Ambient {
  private ctx?: AudioContext;
  private master?: GainNode;
  private filter?: BiquadFilterNode;
  private echo?: DelayNode;
  private timers: number[] = [];
  private chordIndex = 0;
  private brightness = 0.3;
  /** Gesamtlautstärke 0–1 (0 = aus), gilt auch für Boss-Musik und Warnton */
  volume = readVolume();
  /** Ausgeblendet, solange eigene Musik läuft (z. B. beim Boss) */
  private ducked = false;

  /** Muss aus einem Klick-/Touch-Handler aufgerufen werden. */
  get muted() {
    return this.volume === 0;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) this.build();
    void this.ctx?.resume();
  }

  setVolume(value: number) {
    const wasMuted = this.muted;
    this.volume = Math.min(1, Math.max(0, Math.round(value * 20) / 20));
    writeVolume(this.volume);
    if (this.muted) {
      this.fadeTo(0, 0.4);
      window.setTimeout(() => this.muted && void this.ctx?.suspend(), 500);
    } else {
      this.unlock();
      if (!this.ducked) this.fadeTo(this.level(), wasMuted ? 1.2 : 0.15);
    }
  }

  private level() {
    return FULL * this.volume;
  }

  /** Hintergrundmusik aus- bzw. wieder einblenden, z. B. für die Boss-Musik. */
  duck(on: boolean) {
    this.ducked = on;
    if (!this.muted) this.fadeTo(on ? 0 : this.level(), on ? 1 : 2.5);
  }

  /** 0 = gedämpft und dunkel, 1 = hell und offen. */
  setBrightness(value: number) {
    this.brightness = Math.min(1, Math.max(0, value));
    if (this.ctx && this.filter) {
      this.filter.frequency.setTargetAtTime(500 + this.brightness * 2200, this.ctx.currentTime, 2);
    }
  }

  private build() {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.4;
    this.filter.connect(this.master);
    this.setBrightness(this.brightness);

    // Einfaches Echo für Weite
    this.echo = ctx.createDelay(1.5);
    this.echo.delayTime.value = 0.45;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    this.echo.connect(feedback);
    feedback.connect(this.echo);
    this.echo.connect(this.filter);

    if (!this.ducked) this.fadeTo(this.level(), 3);
    this.playChord();
    this.timers.push(window.setInterval(() => this.playChord(), CHORD_SECONDS * 1000));
    this.scheduleBell();
  }

  private fadeTo(value: number, seconds: number) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(value, now + seconds);
  }

  private playChord() {
    const ctx = this.ctx;
    if (!ctx || !this.filter || ctx.state !== 'running') return;
    const chord = CHORDS[this.chordIndex % CHORDS.length];
    this.chordIndex++;
    const now = ctx.currentTime;
    const length = CHORD_SECONDS + 3;
    for (const freq of chord) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 2.5);
        gain.gain.setValueAtTime(0.05, now + length - 3.5);
        gain.gain.linearRampToValueAtTime(0, now + length);
        osc.connect(gain);
        gain.connect(this.filter);
        osc.start(now);
        osc.stop(now + length + 0.1);
      }
    }
  }

  private scheduleBell() {
    const delay = 2500 + Math.random() * 4500;
    this.timers.push(
      window.setTimeout(() => {
        this.playBell();
        this.scheduleBell();
      }, delay),
    );
  }

  private playBell() {
    const ctx = this.ctx;
    if (!ctx || !this.filter || !this.echo || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BELLS[Math.floor(Math.random() * BELLS.length)];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06 + this.brightness * 0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    osc.connect(gain);
    gain.connect(this.filter);
    gain.connect(this.echo);
    osc.start(now);
    osc.stop(now + 3);
  }
}

/** Gespeicherte Lautstärke; ältere Spielstände kannten nur „Ton aus“ */
function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    if (stored !== null && !Number.isNaN(Number(stored))) return Math.min(1, Math.max(0, Number(stored)));
    return localStorage.getItem(MUTE_KEY) === '1' ? 0 : 0.8;
  } catch {
    return 0.8;
  }
}

function writeVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Speicher blockiert: Einstellung gilt nur für diese Sitzung
  }
}

export const ambient = new Ambient();
