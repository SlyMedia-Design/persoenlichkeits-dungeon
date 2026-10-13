/**
 * Verteilungstest: Simuliert viele realistische Profile (multivariat normalverteilt mit den
 * Korrelationen aus data/norms.json) und zählt, wie oft jedes Wesen herauskommt.
 *
 *   npm run simulate                 (100 000 Profile)
 *   npm run simulate -- 500000 42    (Anzahl, Seed)
 */
import archetypesJson from '../data/archetypes.json';
import normsJson from '../data/norms.json';
import { simulateDistribution } from '../src/core/simulation';
import type { Archetype, Norms } from '../src/core/types';

const total = Number(process.argv[2] ?? 100_000);
const seed = Number(process.argv[3] ?? 1);
/** Erlaubte Abweichung vom Idealanteil (1/Anzahl Wesen), relativ: 0.25 = ±25 % */
const TOLERANCE = 0.25;

const archetypes = archetypesJson.archetypes as unknown as Archetype[];
const norms = normsJson as unknown as Norms;
const result = simulateDistribution(archetypes, norms, total, seed);
const ideal = 1 / archetypes.length;

console.log(`${total.toLocaleString('de-DE')} simulierte Profile, Seed ${seed}, Ideal je Wesen: ${(ideal * 100).toFixed(1)} %\n`);
let ok = true;
for (const a of archetypes) {
  const share = result.shares[a.id];
  const deviation = (share - ideal) / ideal;
  const inRange = Math.abs(deviation) <= TOLERANCE;
  ok &&= inRange;
  const bar = '█'.repeat(Math.round(share * 100));
  console.log(
    `${a.id.padEnd(10)} ${(share * 100).toFixed(1).padStart(5)} %  ${bar.padEnd(40)} ${inRange ? 'ok' : `⚠ ${deviation > 0 ? '+' : ''}${(deviation * 100).toFixed(0)} % vom Ideal`}`,
  );
}
console.log(ok ? '\nVerteilung ist ausgewogen.' : `\nMindestens ein Wesen weicht um mehr als ±${TOLERANCE * 100} % vom Ideal ab.`);
process.exitCode = ok ? 0 : 1;
