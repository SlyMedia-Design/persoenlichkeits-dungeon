import { DIMENSIONS, type Archetype, type Profile } from './types';

export function distance(a: Profile, b: Profile): number {
  let sum = 0;
  for (const d of DIMENSIONS) sum += (a[d] - b[d]) ** 2;
  return Math.sqrt(sum);
}

export interface RankedArchetype {
  archetype: Archetype;
  distance: number;
}

/** Alle Wesen, sortiert vom nächsten zum fernsten (bei Gleichstand: Reihenfolge der Daten). */
export function rankArchetypes(z: Profile, archetypes: readonly Archetype[]): RankedArchetype[] {
  if (archetypes.length === 0) throw new Error('Keine Wesen definiert');
  return archetypes
    .map((archetype, index) => ({ archetype, distance: distance(z, archetype.profile), index }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map(({ archetype, distance }) => ({ archetype, distance }));
}

/** Das Wesen, dessen Zielprofil dem z-Profil am nächsten liegt. */
export function matchArchetype(z: Profile, archetypes: readonly Archetype[]): Archetype {
  return rankArchetypes(z, archetypes)[0].archetype;
}

/**
 * Partnervorschlag: das Wesen, das vom Spielerprofil am weitesten entfernt ist (Ergänzung).
 * Das eigene Wesen ist ausgeschlossen.
 */
export function suggestPartner(z: Profile, archetypes: readonly Archetype[], ownId: string): Archetype {
  const candidates = rankArchetypes(z, archetypes).filter((r) => r.archetype.id !== ownId);
  if (candidates.length === 0) throw new Error('Kein möglicher Partner vorhanden');
  return candidates[candidates.length - 1].archetype;
}
