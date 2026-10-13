import { describe, expect, it } from 'vitest';
import archetypesJson from '../data/archetypes.json';
import bankJson from '../data/ipip50_de.json';
import de from '../data/i18n/de.json';
import normsJson from '../data/norms.json';
import { DIMENSIONS, type Archetype, type ItemBank, type Norms } from '../src/core/types';

const bank = bankJson as ItemBank;
const archetypes = archetypesJson.archetypes as unknown as Archetype[];
const norms = normsJson as unknown as Norms;

describe('ipip50_de.json', () => {
  it('enthält 50 Items mit fortlaufender Nummer', () => {
    expect(bank.items.map((i) => i.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('hat 10 Items je Dimension', () => {
    for (const d of DIMENSIONS) expect(bank.items.filter((i) => i.dimension === d)).toHaveLength(10);
  });

  it('entspricht dem Schlüssel des englischen Originals', () => {
    // Anzahl positiv gepolter Items laut IPIP-Schlüssel: E 5, A 6, C 6, Stabilität 2 (→ N 8), O 7
    const plus = (d: string) => bank.items.filter((i) => i.dimension === d && i.keyed === 1).length;
    expect({ O: plus('O'), C: plus('C'), E: plus('E'), A: plus('A'), N: plus('N') }).toEqual({
      O: 7,
      C: 6,
      E: 5,
      A: 6,
      N: 8,
    });
    // Reihenfolge des Musterfragebogens: Faktor = (Nummer − 1) mod 5 + 1
    for (const item of bank.items) expect(item.ipipKey[0]).toBe(String(((item.id - 1) % 5) + 1));
  });

  it('übernimmt die Texte wortgetreu (Stichproben)', () => {
    expect(bank.items[0].text).toBe('bringe eine Party in Schwung.');
    expect(bank.items[13].text).toBe('grübel über Dinge');
    expect(bank.items[40].text).toBe('es macht mir nichts aus im Zentrum der Aufmerksamkeit zu stehen.');
  });
});

describe('norms.json', () => {
  it('hat plausible Werte für alle Dimensionen', () => {
    for (const d of DIMENSIONS) {
      const { mean, sd } = norms.dimensions[d];
      expect(mean).toBeGreaterThan(1);
      expect(mean).toBeLessThan(5);
      expect(sd).toBeGreaterThan(0.2);
      expect(sd).toBeLessThan(1.5);
    }
  });

  it('hat eine symmetrische 5×5-Korrelationsmatrix', () => {
    expect(norms.correlations).toHaveLength(5);
    norms.correlations.forEach((row, i) => {
      expect(row[i]).toBe(1);
      row.forEach((v, j) => expect(v).toBe(norms.correlations[j][i]));
    });
  });
});

describe('archetypes.json', () => {
  it('hat in jeder Dimension zwei hohe und zwei niedrige Wesen', () => {
    for (const d of DIMENSIONS) {
      const values = archetypes.map((a) => a.profile[d]).sort();
      expect(values).toEqual([-1, -1, 1, 1]);
    }
  });

  it('hat gültige 16×16-Sprites', () => {
    for (const a of archetypes) {
      expect(a.sprite.rows, a.id).toHaveLength(16);
      for (const row of a.sprite.rows) {
        expect(row, `${a.id}: "${row}"`).toHaveLength(16);
        for (const ch of row) if (ch !== '.') expect(a.sprite.palette, `${a.id}: ${ch}`).toHaveProperty(ch);
      }
    }
  });

  it('hat Texte für jedes Wesen', () => {
    const creatures = de.creatures as Record<string, Record<string, string>>;
    for (const a of archetypes) {
      for (const key of ['species', 'article', 'tagline', 'description']) expect(creatures[a.id]?.[key]).toBeTruthy();
    }
  });
});
