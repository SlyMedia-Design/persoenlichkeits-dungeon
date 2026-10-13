import { matchArchetype } from './matching';
import { DIMENSIONS, type Archetype, type Norms, type Profile } from './types';

/** Reproduzierbarer Zufallsgenerator (mulberry32), liefert Zahlen in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standardnormalverteilte Zufallszahl (Box-Muller). */
export function gaussian(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Cholesky-Zerlegung einer symmetrischen, positiv definiten Matrix: M = L·Lᵀ. */
export function cholesky(m: number[][]): number[][] {
  const n = m.length;
  const l = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = m[i][j];
      for (let k = 0; k < j; k++) sum -= l[i][k] * l[j][k];
      if (i === j) {
        if (sum <= 0) throw new Error('Matrix ist nicht positiv definit');
        l[i][j] = Math.sqrt(sum);
      } else {
        l[i][j] = sum / l[j][j];
      }
    }
  }
  return l;
}

/**
 * Zieht ein realistisches z-Profil: multivariat normalverteilt mit den
 * Korrelationen der Dimensionen aus den Vergleichswerten.
 */
export function createProfileSampler(norms: Norms, rng: () => number): () => Profile {
  const l = cholesky(norms.correlations);
  return () => {
    const e = DIMENSIONS.map(() => gaussian(rng));
    const profile = {} as Profile;
    DIMENSIONS.forEach((d, i) => {
      let v = 0;
      for (let k = 0; k <= i; k++) v += l[i][k] * e[k];
      profile[d] = v;
    });
    return profile;
  };
}

export interface DistributionResult {
  total: number;
  counts: Record<string, number>;
  shares: Record<string, number>;
}

export function simulateDistribution(
  archetypes: readonly Archetype[],
  norms: Norms,
  total: number,
  seed = 1,
): DistributionResult {
  const sample = createProfileSampler(norms, createRng(seed));
  const counts: Record<string, number> = Object.fromEntries(archetypes.map((a) => [a.id, 0]));
  for (let i = 0; i < total; i++) counts[matchArchetype(sample(), archetypes).id] += 1;
  const shares = Object.fromEntries(Object.entries(counts).map(([id, c]) => [id, c / total]));
  return { total, counts, shares };
}
