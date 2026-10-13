import { browserStorage, clearSave, loadSave, newSave, writeSave, type SaveData } from './core/save';

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
