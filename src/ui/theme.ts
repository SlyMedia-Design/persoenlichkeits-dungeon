import Phaser from 'phaser';

export const FONT = '"Dorfschrift", "Trebuchet MS", sans-serif';

export const COLORS = {
  night: 0x1a1830,
  dusk: 0x2b2745,
  panel: 0x2b2745,
  panelLight: 0x3a3560,
  cream: 0xf2e3c6,
  gold: 0xffd27a,
  rose: 0xf49a8a,
  text: '#fff8ea',
  textDim: '#e2d9ee',
  textGold: '#ffd27a',
};

/** Hintergrund-Verlauf: von tiefer Nacht (0) bis zur warmen Morgendämmerung (1). */
export const SKY = {
  top: [0x141226, 0x2f2850, 0x5a3a66],
  bottom: [0x1f1b38, 0x553f6e, 0xb06a5e],
};

/** Grundmaße abhängig von der Bildschirmgröße, damit Handy und Desktop gut aussehen. */
export function metrics(scene: Phaser.Scene) {
  const { width, height } = scene.scale;
  const contentWidth = Math.min(width - 32, 640);
  const base = Phaser.Math.Clamp(Math.min(width / 20, height / 32), 17, 24);
  return {
    width,
    height,
    cx: width / 2,
    contentWidth,
    left: (width - contentWidth) / 2,
    font: base,
    small: Math.round(base * 0.86),
    large: Math.round(base * 1.35),
    huge: Math.round(base * 2),
    gap: Math.round(base * 0.7),
  };
}

export type Metrics = ReturnType<typeof metrics>;

export function textStyle(size: number, color = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    resolution: Math.min(window.devicePixelRatio || 1, 3),
    shadow: { offsetX: 2, offsetY: 2, color: '#120f22', blur: 0, fill: true },
    ...extra,
  } satisfies Phaser.Types.GameObjects.Text.TextStyle;
}

/** Verkleinert einen einzeiligen Text, bis er in die verfügbare Breite passt. */
export function fitWidth<T extends Phaser.GameObjects.Text>(text: T, maxWidth: number): T {
  if (text.width > maxWidth) {
    const size = parseFloat(String(text.style.fontSize));
    text.setFontSize(Math.floor((size * maxWidth) / text.width));
  }
  return text;
}

/** Überschriften: fetter Schnitt der Dorfschrift */
export function headingStyle(size: number, color = COLORS.textGold, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return textStyle(size, color, { fontStyle: 'bold', ...extra });
}

export function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** Farbe auf einer Skala aus mehreren Stützstellen (t von 0 bis 1). */
export function rampColor(stops: number[], t: number): number {
  const clamped = Phaser.Math.Clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(clamped), stops.length - 2);
  return lerpColor(stops[i], stops[i + 1], clamped - i);
}

export function hexToInt(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}
