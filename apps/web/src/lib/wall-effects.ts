// How a wall card's posters arrive. Each row of cards shares one effect.
export const WALL_EFFECTS = ["sweep", "doors", "pull", "deal"] as const;
export type WallEffect = (typeof WALL_EFFECTS)[number];

/** The effect for a row: neighbouring rows differ, and the order changes with the seed. */
export function wallEffect(row: number, seed: number): WallEffect {
  const order: WallEffect[] = [...WALL_EFFECTS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = (seed >>> (i * 5)) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[row % order.length];
}
