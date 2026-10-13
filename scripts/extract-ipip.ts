/**
 * Erzeugt data/ipip50_de.json aus der Original-HTML-Seite des IPIP.
 *
 *   npx tsx scripts/extract-ipip.ts <pfad/zu/German50-itemBigFiveFactorMarkers.htm>
 *
 * Quelle: https://ipip.ori.org/German50-itemBigFiveFactorMarkers.htm
 * Die Item-Texte werden unverändert übernommen (nur HTML-Entities dekodiert
 * und Leerraum am Rand entfernt).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Dimension } from '../src/core/types';

const input = process.argv[2];
if (!input) {
  console.error('Aufruf: npx tsx scripts/extract-ipip.ts <html-datei>');
  process.exit(1);
}

const html = readFileSync(input, 'utf8');

function clean(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// IPIP-Faktoren: 1 Extraversion, 2 Verträglichkeit, 3 Gewissenhaftigkeit,
// 4 Emotionale Stabilität, 5 Intellekt/Offenheit.
// Faktor 4 wird intern als Neurotizismus geführt, deshalb dreht sich dort die Polung.
const factorToDimension: Record<string, Dimension> = { '1': 'E', '2': 'A', '3': 'C', '4': 'N', '5': 'O' };

const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
  [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => clean(c[1])),
);

const items = rows
  .filter((cells) => cells.length >= 5 && /^\d+$/.test(cells[0]))
  .map((cells) => {
    const [no, code, key, de, en] = cells;
    const m = /^([1-5])([+-])$/.exec(key);
    if (!m) throw new Error(`Unbekannter Schlüssel in Item ${no}: "${key}"`);
    const dimension = factorToDimension[m[1]];
    let keyed: 1 | -1 = m[2] === '+' ? 1 : -1;
    if (m[1] === '4') keyed = keyed === 1 ? -1 : 1;
    return { id: Number(no), code, ipipKey: key, dimension, keyed, text: de, textEn: en };
  });

if (items.length !== 50) throw new Error(`Erwartet 50 Items, gefunden ${items.length}`);

const out = {
  title: 'IPIP 50-Item Big-Five Factor Markers – deutsche Fassung',
  source: {
    url: 'https://ipip.ori.org/German50-itemBigFiveFactorMarkers.htm',
    keyUrl: 'https://ipip.ori.org/new_ipip-50-item-scale.htm',
    translators:
      'Alois Angleitner, Susanne Hempel, Rika Langert, Frank Spinath (Universität Bielefeld); bereitgestellt von Fritz Ostendorf',
    license: 'Public Domain (International Personality Item Pool, https://ipip.ori.org/)',
    retrieved: new Date().toISOString().slice(0, 10),
  },
  notes: [
    'Item-Texte wortgetreu aus der Quelle übernommen (inkl. fehlender Satzzeichen und Schreibweisen wie „grübel“).',
    'Die Items sind Satzergänzungen zum Stamm „Ich …“ (Ich-Form laut IPIP-Übersetzungsseite).',
    'ipipKey = Original-Schlüssel (Faktor + Polung). Faktor 4 ist im Original Emotionale Stabilität.',
    'dimension/keyed = interne Auswertung nach OCEAN; N = Neurotizismus (im Spiel: „Feingefühl“), daher ist keyed bei Faktor 4 gegenüber dem Original umgedreht.',
  ],
  scale: { min: 1, max: 5 },
  items,
};

const target = resolve(import.meta.dirname, '../data/ipip50_de.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`${items.length} Items geschrieben nach ${target}`);
