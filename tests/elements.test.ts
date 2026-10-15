import { describe, expect, it } from 'vitest';
import elementsJson from '../data/elements.json';
import { elementFactor, weaknessesOf, type ElementChart } from '../src/core/elements';

const chart = elementsJson as unknown as ElementChart;
const { strong, weak } = chart.factor;

describe('Typentabelle (CHECKLISTE.md)', () => {
  it('hat die Prototyp-Faktoren 1,1 und 0,9', () => {
    expect(strong).toBe(1.1);
    expect(weak).toBe(0.9);
  });

  it('kennt alle Stärken', () => {
    expect(elementFactor(chart, 'flut', 'glut')).toBe(strong);
    expect(elementFactor(chart, 'flut', 'fels')).toBe(strong);
    expect(elementFactor(chart, 'fels', 'glut')).toBe(strong);
    expect(elementFactor(chart, 'glut', 'ranke')).toBe(strong);
    expect(elementFactor(chart, 'ranke', 'flut')).toBe(strong);
    expect(elementFactor(chart, 'wind', 'ranke')).toBe(strong);
  });

  it('leitet die Schwächen aus der Gegenseite ab', () => {
    expect(elementFactor(chart, 'glut', 'flut')).toBe(weak);
    expect(elementFactor(chart, 'glut', 'fels')).toBe(weak);
    expect(elementFactor(chart, 'fels', 'flut')).toBe(weak);
    expect(elementFactor(chart, 'flut', 'ranke')).toBe(weak);
    expect(elementFactor(chart, 'ranke', 'glut')).toBe(weak);
    expect(elementFactor(chart, 'ranke', 'wind')).toBe(weak);
  });

  it('ist sonst neutral, auch ohne Element', () => {
    const special = new Set(['flut>glut', 'flut>fels', 'fels>glut', 'glut>ranke', 'ranke>flut', 'wind>ranke']);
    for (const a of chart.elements) {
      for (const d of chart.elements) {
        if (special.has(`${a}>${d}`) || special.has(`${d}>${a}`)) continue;
        expect(elementFactor(chart, a, d), `${a} gegen ${d}`).toBe(1);
      }
    }
    expect(elementFactor(chart, undefined, 'glut')).toBe(1);
    expect(elementFactor(chart, 'flut', undefined)).toBe(1);
  });

  it('Wind ist gegen alles neutral außer Ranke und hat keine Schwäche', () => {
    expect(weaknessesOf(chart, 'wind')).toEqual([]);
    for (const e of chart.elements) if (e !== 'ranke') expect(elementFactor(chart, 'wind', e)).toBe(1);
  });

  it('nennt die Schwächen jedes Elements', () => {
    expect(weaknessesOf(chart, 'glut')).toEqual(['fels', 'flut']);
    expect(weaknessesOf(chart, 'fels')).toEqual(['flut']);
    expect(weaknessesOf(chart, 'flut')).toEqual(['ranke']);
    expect(weaknessesOf(chart, 'ranke')).toEqual(['glut', 'wind']);
  });

  it('hat für jedes Element ein 16×16-Icon und eine Farbe', () => {
    const data = elementsJson as unknown as { icons: Record<string, { rows: string[] }>; colors: Record<string, string> };
    for (const e of chart.elements) {
      expect(data.colors[e]).toMatch(/^#[0-9a-f]{6}$/);
      expect(data.icons[e].rows).toHaveLength(16);
      for (const row of data.icons[e].rows) expect(row).toHaveLength(16);
    }
  });
});
