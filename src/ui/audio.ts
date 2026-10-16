import Phaser from 'phaser';
import audioJson from '../../data/audio.json';
import { ambient } from './ambient';

interface Track {
  file: string;
  volume: number;
}

const audio = audioJson as unknown as { boss: { music: Track; warning: Track } };
const MUSIC = 'boss-music';
const WARNING = 'boss-warning';

/** Lädt Boss-Musik und Warnton (aus data/audio.json). */
export function preloadBossAudio(scene: Phaser.Scene) {
  const base = import.meta.env.BASE_URL;
  if (!scene.cache.audio.exists(MUSIC)) scene.load.audio(MUSIC, base + audio.boss.music.file);
  if (!scene.cache.audio.exists(WARNING)) scene.load.audio(WARNING, base + audio.boss.warning.file);
}

/**
 * Boss-Musik: Die leise Hintergrundmusik weicht, ein kurzer Warnton erklingt (beim ersten Erscheinen),
 * danach läuft das bedrohliche Stück in Schleife. Der Lautstärkeregler gilt auch hier.
 */
export function startBossMusic(scene: Phaser.Scene, warning: boolean) {
  ambient.duck(true);
  scene.sound.volume = ambient.volume;
  if (warning && scene.cache.audio.exists(WARNING)) scene.sound.play(WARNING, { volume: audio.boss.warning.volume });
  if (!scene.cache.audio.exists(MUSIC) || scene.sound.get(MUSIC)?.isPlaying) return;
  const music = scene.sound.add(MUSIC, { loop: true, volume: 0 });
  music.play({ delay: warning ? 0.8 : 0 });
  scene.tweens.add({ targets: music, volume: audio.boss.music.volume, duration: 1500 });
}

/** Boss-Musik ausblenden und die Hintergrundmusik zurückholen. */
export function stopBossMusic(scene: Phaser.Scene, fadeMs = 1200) {
  const music = scene.sound.get(MUSIC) as Phaser.Sound.WebAudioSound | null;
  if (music) {
    scene.tweens.add({ targets: music, volume: 0, duration: fadeMs, onComplete: () => music.destroy() });
  }
  ambient.duck(false);
}
