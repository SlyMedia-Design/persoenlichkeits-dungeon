import { describe, expect, it } from 'vitest';
import bankJson from '../data/ipip50_de.json';
import { band, keyedValue, normalCdf, scaleMeans, score, selectItems, toZ } from '../src/core/scoring';
import { DIMENSIONS, type Answers, type ItemBank, type Norms } from '../src/core/types';

const bank = bankJson as ItemBank;

const norms: Norms = {
  dimensions: {
    O: { mean: 3, sd: 1 },
    C: { mean: 3, sd: 0.5 },
    E: { mean: 2, sd: 1 },
    A: { mean: 4, sd: 0.5 },
    N: { mean: 3, sd: 2 },
  },
  correlations: DIMENSIONS.map((_, i) => DIMENSIONS.map((__, j) => (i === j ? 1 : 0))),
};

const allAnswers = (value: number): Answers => Object.fromEntries(bank.items.map((i) => [i.id, value]));

describe('keyedValue', () => {
  it('lässt positiv gepolte Items unverändert', () => {
    expect(keyedValue(4, 1, { min: 1, max: 5 })).toBe(4);
  });
  it('polt negativ gepolte Items um', () => {
    expect(keyedValue(1, -1, { min: 1, max: 5 })).toBe(5);
    expect(keyedValue(4, -1, { min: 1, max: 5 })).toBe(2);
    expect(keyedValue(3, -1, { min: 1, max: 5 })).toBe(3);
  });
  it('lehnt Werte außerhalb der Skala ab', () => {
    expect(() => keyedValue(0, 1, { min: 1, max: 5 })).toThrow(RangeError);
    expect(() => keyedValue(6, 1, { min: 1, max: 5 })).toThrow(RangeError);
    expect(() => keyedValue(2.5, 1, { min: 1, max: 5 })).toThrow(RangeError);
  });
});

describe('scaleMeans', () => {
  it('ergibt überall 3, wenn alles mit 3 beantwortet wird', () => {
    const means = scaleMeans(bank, allAnswers(3));
    for (const d of DIMENSIONS) expect(means[d]).toBe(3);
  });

  it('bildet den Mittelwert aus 10 Items mit Umpolung', () => {
    // Alles "trifft voll zu": Mittelwert = (Anzahl+ · 5 + Anzahl− · 1) / 10
    const means = scaleMeans(bank, allAnswers(5));
    const expected = (d: string) => {
      const items = bank.items.filter((i) => i.dimension === d);
      const plus = items.filter((i) => i.keyed === 1).length;
      return (plus * 5 + (items.length - plus) * 1) / items.length;
    };
    for (const d of DIMENSIONS) expect(means[d]).toBeCloseTo(expected(d));
  });

  it('erreicht das Maximum 5, wenn jedes Item in Richtung der Dimension beantwortet wird', () => {
    const answers: Answers = Object.fromEntries(bank.items.map((i) => [i.id, i.keyed === 1 ? 5 : 1]));
    const means = scaleMeans(bank, answers);
    for (const d of DIMENSIONS) expect(means[d]).toBe(5);
  });

  it('wertet Emotionale-Stabilität-Items als Neurotizismus umgekehrt aus', () => {
    // Item 4: "gerate leicht in Stress." – im Original 4- (Stabilität), intern N+
    const item4 = bank.items.find((i) => i.id === 4)!;
    expect(item4.dimension).toBe('N');
    expect(item4.keyed).toBe(1);
    // Item 9: "bin die meiste Zeit entspannt." – im Original 4+, intern N−
    const item9 = bank.items.find((i) => i.id === 9)!;
    expect(item9.dimension).toBe('N');
    expect(item9.keyed).toBe(-1);
  });

  it('wirft, wenn Antworten fehlen', () => {
    const answers = allAnswers(3);
    delete answers[17];
    expect(() => scaleMeans(bank, answers)).toThrow(/17/);
  });
});

describe('toZ / score', () => {
  it('rechnet z = (Wert − Mittelwert) / SD', () => {
    const z = toZ({ O: 4, C: 3.5, E: 2, A: 3, N: 1 }, norms);
    expect(z.O).toBeCloseTo(1);
    expect(z.C).toBeCloseTo(1);
    expect(z.E).toBeCloseTo(0);
    expect(z.A).toBeCloseTo(-2);
    expect(z.N).toBeCloseTo(-1);
  });

  it('verwendet die Vergleichswerte statt der Skalenmitte', () => {
    const result = score(bank, allAnswers(3), norms);
    expect(result.z.E).toBeCloseTo(1); // 3 liegt über dem Normmittel 2
    expect(result.z.A).toBeCloseTo(-2); // 3 liegt unter dem Normmittel 4
  });
});

describe('normalCdf / band', () => {
  it('liefert bekannte Werte der Normalverteilung', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413, 4);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
  it('ordnet z-Werte grob ein', () => {
    expect(band(-1)).toBe('low');
    expect(band(0.2)).toBe('mid');
    expect(band(0.5)).toBe('high');
  });
});

describe('selectItems', () => {
  it('übernimmt Items in der gewünschten Reihenfolge', () => {
    const short = selectItems(bank, [9, 1, 17]);
    expect(short.items.map((i) => i.id)).toEqual([9, 1, 17]);
    expect(short.scale).toEqual(bank.scale);
  });
  it('lehnt unbekannte oder doppelte Items ab', () => {
    expect(() => selectItems(bank, [1, 99])).toThrow(/99/);
    expect(() => selectItems(bank, [1, 1])).toThrow();
  });
  it('bildet Mittelwerte nur über die ausgewählten Items', () => {
    const short = selectItems(bank, [1, 6]); // E+ und E−
    const answers: Answers = { 1: 5, 6: 1 };
    const sums = short.items.reduce((s, i) => s + keyedValue(answers[i.id], i.keyed, short.scale), 0);
    expect(sums / 2).toBe(5);
  });
});
