/** Big-Five-Dimensionen nach OCEAN. N = Neurotizismus (im Spiel „Feingefühl“). */
export type Dimension = 'O' | 'C' | 'E' | 'A' | 'N';

export const DIMENSIONS: readonly Dimension[] = ['O', 'C', 'E', 'A', 'N'] as const;

export type Profile = Record<Dimension, number>;

export interface Item {
  id: number;
  code: string;
  ipipKey: string;
  dimension: Dimension;
  /** +1: Zustimmung erhöht den Wert der Dimension, -1: Item wird umgepolt. */
  keyed: 1 | -1;
  text: string;
  textEn: string;
}

export interface ItemBank {
  scale: { min: number; max: number };
  items: Item[];
}

export interface NormStat {
  mean: number;
  sd: number;
}

export interface Norms {
  dimensions: Record<Dimension, NormStat>;
  /** Korrelationsmatrix der Skalenwerte in der Reihenfolge von DIMENSIONS. */
  correlations: number[][];
}

/** item-id → Antwort (1–5) */
export type Answers = Record<number, number>;

export interface PixelSprite {
  palette: Record<string, string>;
  rows: string[];
}

export interface Archetype {
  id: string;
  /** Ziel-z-Profil */
  profile: Profile;
  color: string;
  aura: string;
  /** 16×16 fürs Spielfeld */
  sprite: PixelSprite;
  /** 32×32 für Menüs und Szenen */
  portrait: PixelSprite;
}

export interface ScoreResult {
  /** Mittelwert je Dimension auf der Antwortskala (1–5), nach Umpolung */
  means: Profile;
  /** z-Werte relativ zu den Vergleichswerten */
  z: Profile;
}
