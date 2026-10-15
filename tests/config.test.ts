import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import audioJson from '../data/audio.json';
import configJson from '../data/config.json';

describe('Einstellungen', () => {
  it('der Feedback-Link führt zu einem Google-Formular (ohne Daten im Link)', () => {
    const url = new URL(configJson.feedbackUrl);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('docs.google.com');
    expect(url.pathname).toMatch(/^\/forms\//);
    // Es werden keine Werte vorausgefüllt mitgeschickt
    expect(url.search).toBe('');
  });

  it('Boss-Musik und Warnton liegen in public/', () => {
    for (const track of [audioJson.boss.music, audioJson.boss.warning]) {
      expect(existsSync(resolve(import.meta.dirname, '../public', track.file)), track.file).toBe(true);
    }
  });
});
