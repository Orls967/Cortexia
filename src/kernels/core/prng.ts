// Deterministic PRNG (MATHEMATICAL_CONVENTIONS §4): Mulberry32 with Box–Muller normal variates.
// Identical seeds reproduce bit-identical trajectories.

export class Rng {
  private s: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.s = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal via Box–Muller. */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    while (u <= 1e-300) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Poisson variate. Knuth multiplication for small means, normal approximation with continuity correction above 30. */
  poisson(mean: number): number {
    if (mean <= 0) return 0;
    if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * this.normal()));
    const limit = Math.exp(-mean);
    let k = 0;
    let p = this.next();
    while (p > limit) {
      k++;
      p *= this.next();
    }
    return k;
  }

  /** Fisher–Yates partial shuffle: k distinct integers from [0, n). */
  sample(n: number, k: number, exclude = -1): Uint32Array {
    const out = new Uint32Array(k);
    const pool = new Uint32Array(n);
    for (let i = 0; i < n; i++) pool[i] = i;
    let size = n;
    if (exclude >= 0 && exclude < n) {
      pool[exclude] = pool[n - 1]!;
      size = n - 1;
    }
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.next() * (size - i));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
      out[i] = pool[i]!;
    }
    return out;
  }
}
