/**
 * Deterministic pseudo-randomness for seed data.
 *
 * The demo seed must be byte-identical on the server and the client, otherwise
 * React hydration mismatches. `Math.random()` cannot be used while building the
 * seed — every generator below is a pure function of its string seed.
 */

/** FNV-1a — stable string → 32-bit hash. */
export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, deterministic PRNG. */
export function makeRandom(seed: string): () => number {
  let a = hashSeed(seed)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Picks `count` distinct items from `items`, deterministically. */
export function pickMany<T>(items: readonly T[], count: number, seed: string): T[] {
  const random = makeRandom(seed)
  const pool = [...items]
  const out: T[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return out
}

export function pickOne<T>(items: readonly T[], seed: string): T {
  return items[Math.floor(makeRandom(seed)() * items.length)]
}

/** Integer in [min, max], deterministic. */
export function randomInt(min: number, max: number, seed: string): number {
  return min + Math.floor(makeRandom(seed)() * (max - min + 1))
}
