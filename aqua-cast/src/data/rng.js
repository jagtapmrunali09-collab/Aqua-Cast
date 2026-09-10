/**
 * rng.js — deterministic PRNG (mulberry32) so the mock dataset and radar
 * feed look identical on every reload/demo run instead of reshuffling.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rand, min, max) {
  return min + rand() * (max - min);
}
