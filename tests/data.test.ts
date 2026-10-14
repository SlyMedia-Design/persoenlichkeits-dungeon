import { describe, expect, it } from 'vitest';
import archetypesJson from '../data/archetypes.json';
import bankJson from '../data/ipip50_de.json';
import de from '../data/i18n/de.json';
import miniJson from '../data/mini_ipip20.json';
import normsJson from '../data/norms.json';
import { selectItems } from '../src/core/scoring';
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

describe('mini_ipip20.json', () => {
  const mini = selectItems(bank, miniJson.itemIds);

  it('enthält 20 Items, 4 je Dimension', () => {
    expect(mini.items).toHaveLength(20);
    for (const d of DIMENSIONS) expect(mini.items.filter((i) => i.dimension === d)).toHaveLength(4);
  });

  it('entspricht der veröffentlichten Mini-IPIP (Donnellan et al. 2006)', () => {
    // Englische Originaltexte und Polung nach Tabelle 3 in PMC6064137, R = umgepolt
    const published = [
      ['E', 'Am the life of the party.', 1], ['A', "Sympathize with others' feelings.", 1],
      ['C', 'Get chores done right away.', 1], ['N', 'Have frequent mood swings.', 1],
      ['O', 'Have a vivid imagination.', 1], ['E', "Don't talk a lot.", -1],
      ['A', "Am not interested in other people's problems.", -1], ['C', 'Often forget to put things back in their proper place.', -1],
      ['N', 'Am relaxed most of the time.', -1], ['O', 'Am not interested in abstract ideas.', -1],
      ['E', 'Talk to a lot of different people at parties.', 1], ['A', "Feel others' emotions.", 1],
      ['C', 'Like order.', 1], ['N', 'Get upset easily.', 1],
      ['O', 'Have difficulty understanding abstract ideas.', -1], ['E', 'Keep in the background.', -1],
      ['A', 'Am not really interested in others.', -1], ['C', 'Make a mess of things.', -1],
      ['N', 'Seldom feel blue.', -1], ['O', 'Do not have a good imagination.', -1],
    ];
    expect(mini.items.map((i) => [i.dimension, i.textEn, i.keyed])).toEqual(published);
  });
});

describe('Porträts', () => {
  it('sind gültige 32×32-Sprites', () => {
    for (const a of archetypes) {
      expect(a.portrait.rows, a.id).toHaveLength(32);
      for (const row of a.portrait.rows) {
        expect(row, `${a.id}: "${row}"`).toHaveLength(32);
        for (const ch of row) if (ch !== '.') expect(a.portrait.palette, `${a.id}: ${ch}`).toHaveProperty(ch);
      }
    }
  });
});
