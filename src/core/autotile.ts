/**
 * Wählt für ein Feld die passende Rand- oder Eckkachel, je nachdem, welche Nachbarn
 * zum selben Untergrund gehören (Weg, Wasser …). Ohne Phaser, damit es testbar bleibt.
 *
 * Aufbau im Tileset (relativ zum Ursprung des Autotiles), wie im Ninja Adventure Pack:
 *   3×3-Block (0..2, 0..2): Ecken, Kanten, Mitte
 *   Spalte 3: senkrechter Streifen (oben, Mitte, unten), Zeile 3: waagerechter Streifen, (3,3) Einzelfeld
 *   Innenecken: (5,1) fremd unten rechts, (6,1) unten links, (5,2) oben rechts, (6,2) oben links
 */
export interface Neighbors {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  ne: boolean;
  nw: boolean;
  se: boolean;
  sw: boolean;
}

export function autotileOffset(nb: Neighbors, innerCorners = true): { x: number; y: number } {
  const { n, e, s, w } = nb;
  if (!w && !e) {
    if (!n && !s) return { x: 3, y: 3 };
    return { x: 3, y: !n ? 0 : !s ? 2 : 1 };
  }
  if (!n && !s) return { x: !w ? 0 : !e ? 2 : 1, y: 3 };
  const x = !w ? 0 : !e ? 2 : 1;
  const y = !n ? 0 : !s ? 2 : 1;
  if (x === 1 && y === 1 && innerCorners) {
    if (!nb.se) return { x: 5, y: 1 };
    if (!nb.sw) return { x: 6, y: 1 };
    if (!nb.ne) return { x: 5, y: 2 };
    if (!nb.nw) return { x: 6, y: 2 };
  }
  return { x, y };
}
