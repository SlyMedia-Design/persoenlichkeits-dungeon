import { describe, expect, it } from 'vitest';
import archetypesJson from '../data/archetypes.json';
import normsJson from '../data/norms.json';
import { cholesky, createProfileSampler, createRng, simulateDistribution } from '../src/core/simulation';
import { DIMENSIONS, type Archetype, type Norms } from '../src/core/types';

const archetypes = archetypesJson.archetypes as unknown as Archetype[];
const norms = normsJson as unknown as Norms;

describe('createRng', () => {
  it('ist reproduzierbar', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});

describe('cholesky', () => {
  it('zerlegt eine Matrix so, dass L·Lᵀ sie wieder ergibt', () => {
    const m = [
      [4, 2, 0.4],
      [2, 2, 0.5],
      [0.4, 0.5, 1],
    ];
    const l = cholesky(m);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += l[i][k] * l[j][k];
        expect(sum).toBeCloseTo(m[i][j]);
      }
  });
  it('lehnt nicht positiv definite Matrizen ab', () => {
    expect(() => cholesky([[1, 2], [2, 1]])).toThrow();
  });
});

describe('createProfileSampler', () => {
  it('erzeugt z-Profile mit Mittelwert ≈ 0, SD ≈ 1 und den Norm-Korrelationen', () => {
    const sample = createProfileSampler(norms, createRng(7));
    const n = 20000;
    const profiles = Array.from({ length: n }, sample);
    for (const d of DIMENSIONS) {
      const mean = profiles.reduce((s, p) => s + p[d], 0) / n;
      const sd = Math.sqrt(profiles.reduce((s, p) => s + (p[d] - mean) ** 2, 0) / n);
      expect(mean).toBeCloseTo(0, 1);
      expect(sd).toBeCloseTo(1, 1);
    }
    const [i, j] = [DIMENSIONS.indexOf('E'), DIMENSIONS.indexOf('N')];
    const r = profiles.reduce((s, p) => s + p.E * p.N, 0) / n;
    expect(r).toBeCloseTo(norms.correlations[i][j], 1);
  });
});

describe('simulateDistribution', () => {
  it('zählt jede simulierte Person genau einem Wesen zu', () => {
    const result = simulateDistribution(archetypes, norms, 1000, 3);
    const sum = Object.values(result.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1000);
    expect(Object.keys(result.counts).sort()).toEqual(archetypes.map((a) => a.id).sort());
  });
});
