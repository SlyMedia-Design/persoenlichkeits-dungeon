import { describe, expect, it } from 'vitest';
import archetypesJson from '../data/archetypes.json';
import battleJson from '../data/battle.json';
import elementsJson from '../data/elements.json';
import type { ElementChart } from '../src/core/elements';
import { distance, matchArchetype, rankArchetypes, suggestPartner, type CreatureElements } from '../src/core/matching';
import type { Archetype, Profile } from '../src/core/types';

const archetypes = archetypesJson.archetypes as unknown as Archetype[];
const byId = (id: string) => archetypes.find((a) => a.id === id)!;
const elements: CreatureElements = {
  chart: elementsJson as unknown as ElementChart,
  of: Object.fromEntries(Object.entries(battleJson.team).map(([id, def]) => [id, def.element])),
};
/** Ohne Elementschwächen: nur die Persönlichkeit zählt */
const noElements: CreatureElements = { chart: { ...elements.chart, strongAgainst: {} }, of: elements.of };

describe('distance', () => {
  it('ist die euklidische Distanz', () => {
    const a: Profile = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const b: Profile = { O: 1, C: 1, E: 1, A: 1, N: 1 };
    expect(distance(a, b)).toBeCloseTo(Math.sqrt(5));
    expect(distance(a, a)).toBe(0);
  });
});

describe('matchArchetype', () => {
  it('findet jedes Wesen über sein eigenes Zielprofil', () => {
    for (const a of archetypes) expect(matchArchetype(a.profile, archetypes).id).toBe(a.id);
  });

  it('findet das nächste Wesen auch bei abgeschwächten Profilen', () => {
    const z: Profile = { O: 0.6, C: -0.3, E: 0.9, A: 0.4, N: -0.2 };
    expect(matchArchetype(z, archetypes).id).toBe('otter');
    const z2: Profile = { O: -0.4, C: 0.8, E: 0.5, A: -0.6, N: 0.3 };
    expect(matchArchetype(z2, archetypes).id).toBe('dachs');
  });

  it('sortiert alle Wesen nach Distanz', () => {
    const ranked = rankArchetypes(byId('eule').profile, archetypes);
    expect(ranked.map((r) => r.archetype.id)[0]).toBe('eule');
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].distance).toBeGreaterThanOrEqual(ranked[i - 1].distance);
  });
});

describe('suggestPartner', () => {
  it('schlägt nie das ähnlichste andere Wesen vor', () => {
    // Jedes Wesen unterscheidet sich von zwei anderen in 4 Dimensionen und vom dritten in 2.
    const near: Record<string, string> = { otter: 'capybara', capybara: 'otter', eule: 'dachs', dachs: 'eule' };
    for (const a of archetypes) expect(suggestPartner(a.profile, archetypes, a.id, elements).id).not.toBe(near[a.id]);
  });

  it('entscheidet bei gleich weit entfernten Wesen nach den genauen Werten', () => {
    const geselligerOtter: Profile = { O: 1, C: -1, E: 1.5, A: 1, N: -1 };
    expect(suggestPartner(geselligerOtter, archetypes, 'otter', elements).id).toBe('eule');
    const neugierigerOtter: Profile = { O: 1.5, C: -1, E: 1, A: 1, N: -1 };
    expect(suggestPartner(neugierigerOtter, archetypes, 'otter', elements).id).toBe('dachs');
    const stilleEule: Profile = { O: 1, C: 1, E: -1.5, A: -1, N: 1 };
    expect(suggestPartner(stilleEule, archetypes, 'eule', elements).id).toBe('otter');
    const ruhigeCapybara: Profile = { O: -1, C: -1, E: -1.5, A: 1, N: -1 };
    expect(suggestPartner(ruhigeCapybara, archetypes, 'capybara', noElements).id).toBe('dachs');
  });

  it('nimmt nur Wesen ohne gemeinsame Elementschwäche (Hauptkriterium)', () => {
    // Capybara (Fels) und Dachs (Glut) sind beide schwach gegen Flut
    const ruhigeCapybara: Profile = { O: -1, C: -1, E: -1.5, A: 1, N: -1 };
    expect(suggestPartner(ruhigeCapybara, archetypes, 'capybara', elements).id).toBe('eule');
    for (const z of [byId('capybara').profile, byId('otter').profile, byId('eule').profile, byId('dachs').profile]) {
      expect(suggestPartner(z, archetypes, 'capybara', elements).id).not.toBe('dachs');
      expect(suggestPartner(z, archetypes, 'dachs', elements).id).not.toBe('capybara');
    }
  });

  it('entscheidet ohne Schwäche des Spielers (Eule/Wind) allein nach der Persönlichkeit', () => {
    for (const a of archetypes) {
      expect(suggestPartner(a.profile, archetypes, 'eule', elements).id).toBe(suggestPartner(a.profile, archetypes, 'eule', noElements).id);
    }
  });

  it('wählt unter den passenden Elementen das fernste Profil', () => {
    // Dachs (Glut): Otter und Eule passen; das eigene Profil liegt vom Otter am weitesten weg
    expect(suggestPartner(byId('dachs').profile, archetypes, 'dachs', elements).id).toBe('otter');
    // Otter (Flut, schwach gegen Ranke): alle passen, also zählt nur die Persönlichkeit
    expect(suggestPartner(byId('otter').profile, archetypes, 'otter', elements).id).toBe(suggestPartner(byId('otter').profile, archetypes, 'otter', noElements).id);
  });

  it('schlägt nie das eigene Wesen vor', () => {
    const z: Profile = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    for (const a of archetypes) expect(suggestPartner(z, archetypes, a.id, elements).id).not.toBe(a.id);
  });
});
