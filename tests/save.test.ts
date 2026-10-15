import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, clearSave, loadSave, newSave, shareText, writeSave, type StorageLike } from '../src/core/save';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('blockiert');
  },
  setItem: () => {
    throw new Error('blockiert');
  },
  removeItem: () => {
    throw new Error('blockiert');
  },
};

describe('Spielstand', () => {
  it('speichert und lädt', () => {
    const storage = memoryStorage();
    const save = { ...newSave(), answers: { 1: 4, 2: 2 }, current: 2, playerName: 'Julian' };
    expect(writeSave(storage, save)).toBe(true);
    expect(loadSave(storage)).toEqual(save);
  });

  it('übersteht blockierten Speicher', () => {
    expect(writeSave(throwingStorage, newSave())).toBe(false);
    expect(loadSave(throwingStorage)).toBeNull();
    expect(() => clearSave(throwingStorage)).not.toThrow();
    expect(loadSave(undefined)).toBeNull();
  });

  it('ignoriert kaputte oder veraltete Daten', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{kaputt');
    expect(loadSave(storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 0, answers: {}, current: 0 }));
    expect(loadSave(storage)).toBeNull();
  });

  it('übernimmt fertige Ergebnisse aus Version 1 (50 Fragen)', () => {
    const storage = memoryStorage();
    const result = { means: { O: 3, C: 3, E: 3, A: 3, N: 3 }, z: { O: 0, C: 0, E: 0, A: 0, N: 0 } };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, answers: { 1: 3 }, current: 50, result, archetypeId: 'eule', playerName: 'Ada' }));
    const loaded = loadSave(storage);
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.archetypeId).toBe('eule');
    expect(loaded?.playerName).toBe('Ada');
  });

  it('verwirft halb ausgefüllte Tests aus Version 1', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, answers: { 1: 3, 2: 4 }, current: 2 }));
    expect(loadSave(storage)).toBeNull();
  });

  it('benennt alte Fähigkeiten des Dachses in einem laufenden Dungeon um', () => {
    const storage = memoryStorage();
    const slot = (id: string) => ({ id, pp: 5, maxPp: 10 });
    const dungeon = { units: [{ id: 'player', moves: [slot('kratzer'), slot('steinkralle'), slot('erzpanzer'), slot('erdstoss')] }] };
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newSave(), archetypeId: 'dachs', dungeon }));
    const ids = loadSave(storage)?.dungeon?.units[0].moves.map((m) => m.id);
    expect(ids).toEqual(['kratzer', 'glutkralle', 'glutpanzer', 'glutstoss']);
  });

  it('löscht den Spielstand', () => {
    const storage = memoryStorage();
    writeSave(storage, newSave());
    clearSave(storage);
    expect(loadSave(storage)).toBeNull();
  });
});

describe('shareText', () => {
  it('enthält nur die fünf Mittelwerte', () => {
    const text = shareText(
      { O: 3.8, C: 3.25, E: 2.9, A: 4.1, N: 2.7 },
      { O: 'O', C: 'C', E: 'E', A: 'A', N: 'N' },
      'Ergebnis',
    );
    expect(text).toContain('O 3.80 | C 3.25 | E 2.90 | A 4.10 | N 2.70');
  });
});
