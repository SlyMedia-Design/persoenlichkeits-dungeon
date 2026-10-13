import { DIMENSIONS, type Answers, type ItemBank, type Norms, type Profile, type ScoreResult } from './types';

export function emptyProfile(value = 0): Profile {
  return { O: value, C: value, E: value, A: value, N: value };
}

/** Wert eines Items nach Umpolung: bei -1 wird (min+max) - Antwort gerechnet. */
export function keyedValue(answer: number, keyed: 1 | -1, scale: ItemBank['scale']): number {
  if (!Number.isInteger(answer) || answer < scale.min || answer > scale.max) {
    throw new RangeError(`Antwort ${answer} liegt außerhalb der Skala ${scale.min}–${scale.max}`);
  }
  return keyed === 1 ? answer : scale.min + scale.max - answer;
}

export function isComplete(bank: ItemBank, answers: Answers): boolean {
  return bank.items.every((item) => answers[item.id] !== undefined);
}

/** Mittelwert je Dimension über alle (umgepolten) Items. Alle Items müssen beantwortet sein. */
export function scaleMeans(bank: ItemBank, answers: Answers): Profile {
  const sums = emptyProfile();
  const counts = emptyProfile();
  for (const item of bank.items) {
    const answer = answers[item.id];
    if (answer === undefined) throw new Error(`Item ${item.id} ist nicht beantwortet`);
    sums[item.dimension] += keyedValue(answer, item.keyed, bank.scale);
    counts[item.dimension] += 1;
  }
  const means = emptyProfile();
  for (const d of DIMENSIONS) {
    if (counts[d] === 0) throw new Error(`Keine Items für Dimension ${d}`);
    means[d] = sums[d] / counts[d];
  }
  return means;
}

export function toZ(means: Profile, norms: Norms): Profile {
  const z = emptyProfile();
  for (const d of DIMENSIONS) {
    const { mean, sd } = norms.dimensions[d];
    z[d] = (means[d] - mean) / sd;
  }
  return z;
}

export function score(bank: ItemBank, answers: Answers, norms: Norms): ScoreResult {
  const means = scaleMeans(bank, answers);
  return { means, z: toZ(means, norms) };
}

/** Standardnormalverteilung Φ(z) (Abramowitz/Stegun 7.1.26, Fehler < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Grobe Einordnung eines z-Werts für Texte im Spiel. */
export function band(z: number): 'low' | 'mid' | 'high' {
  if (z <= -0.5) return 'low';
  if (z >= 0.5) return 'high';
  return 'mid';
}
