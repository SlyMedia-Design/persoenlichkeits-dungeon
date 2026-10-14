import { clearSave, loadSave, newSave, writeSave, type SaveData, type StorageLike } from './core/save';

/** localStorage, falls verfügbar (kann in privaten Fenstern o. Ä. werfen). */
export function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Der aktuelle Spielstand im Speicher; jede Änderung wird sofort lokal gesichert. */
let current: SaveData = loadSave(browserStorage()) ?? newSave();

export function getSave(): SaveData {
  return current;
}

export function updateSave(patch: Partial<SaveData>): SaveData {
  current = { ...current, ...patch };
  writeSave(browserStorage(), current);
  return current;
}

export function resetSave(): SaveData {
  clearSave(browserStorage());
  current = newSave();
  return current;
}
