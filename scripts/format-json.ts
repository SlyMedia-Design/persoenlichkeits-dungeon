/**
 * Formatiert JSON-Datendateien lesbar: kleine Objekte und Listen aus einfachen Werten stehen in einer Zeile.
 *
 *   npx tsx scripts/format-json.ts data/tileset.json data/village.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const INLINE_MAX = 110;

function format(value: unknown, indent: string): string {
  const inline = JSON.stringify(value, null, 1).replace(/\s*\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']').replace(/\{ /g, '{ ').replace(/ \}/g, ' }');
  const simple = value === null || typeof value !== 'object' || inline.length + indent.length <= INLINE_MAX;
  if (simple) return typeof value === 'object' && value !== null ? inline : JSON.stringify(value);
  const next = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map((v) => next + format(v, next)).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${next}${JSON.stringify(k)}: ${format(v, next)}`);
  return `{\n${entries.join(',\n')}\n${indent}}`;
}

for (const file of process.argv.slice(2)) {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, format(data, '') + '\n');
  console.log(`formatiert: ${file}`);
}
