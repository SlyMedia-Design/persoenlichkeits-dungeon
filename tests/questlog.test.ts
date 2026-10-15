import { describe, expect, it } from 'vitest';
import de from '../data/i18n/de.json';
import villageJson from '../data/village.json';
import { createTranslator, type Dictionary } from '../src/core/i18n';
import { questLogEntries } from '../src/core/questlog';

const quests = villageJson.quests;
const t = createTranslator(de as Dictionary);
const progress = { moss: 0, mossNeeded: 3 };

describe('Questlog', () => {
  it('zeigt nur angenommene, erfüllte und erledigte Aufträge', () => {
    expect(questLogEntries(quests, {}, progress)).toEqual([]);
    expect(questLogEntries(quests, { leuchtmoos: 'accepted' }, progress).map((e) => e.id)).toEqual(['leuchtmoos']);
  });

  it('nennt beim Leuchtmoos den Stand der Sammlung', () => {
    const [entry] = questLogEntries(quests, { leuchtmoos: 'accepted' }, { moss: 2, mossNeeded: 3 });
    expect(t(entry.step, entry.vars)).toBe('Sammelt Leuchtmoos im Flüsterwald: 2/3.');
  });

  it('verfolgt Stups im Dungeon: wartend, folgend, in Sicherheit', () => {
    const step = (escort?: 'waiting' | 'following' | 'rescued') => questLogEntries(quests, { verirrt: 'accepted' }, { ...progress, escort })[0].step;
    expect(step()).toBe('village.quests.verirrt.log.accepted');
    expect(step('waiting')).toBe('village.quests.verirrt.log.accepted');
    expect(step('following')).toBe('village.quests.verirrt.log.following');
    expect(step('rescued')).toBe('village.quests.verirrt.log.rescued');
  });

  it('erledigte Aufträge stehen am Ende', () => {
    const entries = questLogEntries(quests, { verirrt: 'done', leuchtmoos: 'ready' }, progress);
    expect(entries.map((e) => e.status)).toEqual(['ready', 'done']);
  });

  it('alle Schritte haben Texte in de.json', () => {
    for (const q of quests) {
      for (const status of ['accepted', 'ready', 'done'] as const) {
        for (const escort of [undefined, 'following', 'rescued'] as const) {
          const entry = questLogEntries([q], { [q.id]: status }, { ...progress, escort })[0];
          expect(t(entry.step, entry.vars), entry.step).not.toMatch(/^\[/);
        }
      }
    }
  });
});
