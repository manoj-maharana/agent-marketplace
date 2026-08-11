function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Deterministic pseudo-random number in [min, max] derived from a seed string. */
export function seededRange(seed: string, min: number, max: number): number {
  const h = hashString(seed);
  return min + (h % (max - min + 1));
}

export function seededRating(seed: string): number {
  return Math.round((4 + (hashString(seed) % 11) / 10) * 10) / 10;
}
