/**
 * Elemente und Typentabelle (Daten in data/elements.json).
 * Das Element hat nichts mit dem Persönlichkeitsprofil zu tun.
 */
export interface ElementChart {
  /** Alle Elemente in Anzeigereihenfolge */
  elements: string[];
  /** Angreifer-Element → Elemente, gegen die es stark ist. Die Schwäche ist die Gegenseite. */
  strongAgainst: Record<string, string[]>;
  /** Schadensfaktoren bei Stärke und Schwäche */
  factor: { strong: number; weak: number };
}

/**
 * Schadensfaktor, wenn eine Fähigkeit des Elements attack ein Wesen des Elements defend trifft.
 * Ohne Element (z. B. Grundangriff, Wurfsteine) ist alles neutral.
 */
export function elementFactor(chart: ElementChart, attack: string | undefined, defend: string | undefined): number {
  if (!attack || !defend) return 1;
  if (chart.strongAgainst[attack]?.includes(defend)) return chart.factor.strong;
  if (chart.strongAgainst[defend]?.includes(attack)) return chart.factor.weak;
  return 1;
}

/** Elemente, gegen die ein Wesen des Elements element schwach ist (die stark gegen es sind). */
export function weaknessesOf(chart: ElementChart, element: string): string[] {
  return chart.elements.filter((e) => chart.strongAgainst[e]?.includes(element));
}
