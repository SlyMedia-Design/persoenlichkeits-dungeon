/**
 * Berechnet data/norms.json aus dem offenen IPIP-50-Datensatz von openpsychometrics.org.
 *
 *   1. https://openpsychometrics.org/_rawdata/BIG5.zip herunterladen und entpacken
 *   2. npm run norms -- <pfad/zu/BIG5/data.csv>
 *
 * Ausgewertet werden Personen mit Englisch als Muttersprache aus englischsprachigen
 * Ländern, Alter 16–80, alle 50 Items beantwortet. Gerechnet wird mit genau der
 * Auswertung des Spiels (src/core/scoring.ts): die 20 Mini-IPIP-Items aus
 * data/mini_ipip20.json mit den Schlüsseln aus data/ipip50_de.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bank from '../data/ipip50_de.json';
import shortForm from '../data/mini_ipip20.json';
import { scaleMeans, selectItems } from '../src/core/scoring';
import { DIMENSIONS, type Answers, type Dimension, type ItemBank, type Profile } from '../src/core/types';

const input = process.argv[2];
if (!input) {
  console.error('Aufruf: npm run norms -- <pfad/zu/data.csv>');
  process.exit(1);
}

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'NZ', 'IE'];
const MIN_AGE = 16;
const MAX_AGE = 80;

// Spalten im Datensatz: E1..E10, N1..N10, A1..A10, C1..C10, O1..O10.
// Sie entsprechen den IPIP-Items in der Reihenfolge des Musterfragebogens:
// Faktor-Offset (E=1, A=2, C=3, N=4, O=5) + 5·(k−1).
const OFFSET: Record<Dimension, number> = { E: 1, A: 2, C: 3, N: 4, O: 5 };

const lines = readFileSync(input, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
const header = lines[0].split('\t');
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Spalte ${name} fehlt`);
  return i;
};

const itemBank = selectItems(bank as ItemBank, shortForm.itemIds);
const profiles: Profile[] = [];
let total = 0;

for (const line of lines.slice(1)) {
  total++;
  const cells = line.split('\t');
  const age = Number(cells[col('age')]);
  if (cells[col('engnat')] !== '1') continue;
  if (!COUNTRIES.includes(cells[col('country')])) continue;
  if (!(age >= MIN_AGE && age <= MAX_AGE)) continue;

  const answers: Answers = {};
  let complete = true;
  for (const d of DIMENSIONS) {
    for (let k = 1; k <= 10; k++) {
      const v = Number(cells[col(`${d}${k}`)]);
      if (!(v >= 1 && v <= 5)) complete = false;
      answers[OFFSET[d] + 5 * (k - 1)] = v;
    }
  }
  if (!complete) continue;
  profiles.push(scaleMeans(itemBank, answers));
}

const n = profiles.length;
const mean = (d: Dimension) => profiles.reduce((s, p) => s + p[d], 0) / n;
const means = Object.fromEntries(DIMENSIONS.map((d) => [d, mean(d)])) as Profile;
const sd = (d: Dimension) => Math.sqrt(profiles.reduce((s, p) => s + (p[d] - means[d]) ** 2, 0) / (n - 1));
const sds = Object.fromEntries(DIMENSIONS.map((d) => [d, sd(d)])) as Profile;
const corr = (a: Dimension, b: Dimension) =>
  profiles.reduce((s, p) => s + (p[a] - means[a]) * (p[b] - means[b]), 0) / ((n - 1) * sds[a] * sds[b]);

const round = (x: number, digits = 3) => Number(x.toFixed(digits));

const norms = {
  description:
    'Vergleichswerte (Mittelwert und Standardabweichung der Skalen-Mittelwerte, Antwortskala 1–5) für die Berechnung der z-Werte. N = Neurotizismus (im Spiel „Feingefühl“).',
  source: {
    dataset: 'Open-Source Psychometrics Project: „Answers to the IPIP Big Five Factor Markers“ (BIG5.zip, erhoben ca. 2012 über einen Online-Test)',
    url: 'https://openpsychometrics.org/_rawdata/',
    file: 'https://openpsychometrics.org/_rawdata/BIG5.zip',
    instrument: 'IPIP 50-Item Big-Five Factor Markers (englisches Original, Goldberg 1992), Ich-Form, Skala 1 = Disagree … 5 = Agree',
    scoring: 'Mini-IPIP (Donnellan et al. 2006): Mittelwert aus den 4 Mini-IPIP-Items je Dimension, siehe data/mini_ipip20.json',
    filter: `Englisch als Muttersprache, Land ∈ {${COUNTRIES.join(', ')}}, Alter ${MIN_AGE}–${MAX_AGE}, alle 50 Items beantwortet`,
    n,
    nTotal: total,
    computedWith: 'scripts/compute-norms.ts',
    computed: new Date().toISOString().slice(0, 10),
  },
  caveats: [
    'Selbstselektierte Online-Stichprobe, keine repräsentative Bevölkerungsnorm.',
    'Englischsprachige Personen und englische Items; das Spiel nutzt die deutsche Übersetzung.',
    'Antwortanker im Datensatz: Disagree/Agree statt „trifft zu“. Die Skala ist in beiden Fällen 1–5.',
    'Vorläufige Werte: Sie sollen später mit freiwillig geteilten Ergebnissen aus dem Freundeskreis nachjustiert werden.',
  ],
  dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d, { mean: round(means[d]), sd: round(sds[d]) }])),
  correlationOrder: DIMENSIONS,
  correlations: DIMENSIONS.map((a) => DIMENSIONS.map((b) => (a === b ? 1 : round(corr(a, b))))),
};

const target = resolve(import.meta.dirname, '../data/norms.json');
writeFileSync(target, JSON.stringify(norms, null, 2) + '\n', 'utf8');
console.log(`n = ${n} von ${total} Datensätzen → ${target}`);
console.table(norms.dimensions);
