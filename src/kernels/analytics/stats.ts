// ANALYTIC-020 … ANALYTIC-026: descriptive statistics, correlation, regression, resampling, hypothesis tests,
// parameter estimation and information criteria. Definitions: SIGNAL_ANALYTICS.md §5.
// Correlation and regression quantify association only; they do not establish causal direction.
import { Rng } from '../core/prng';
import { luDecompose, luSolve } from '../solvers/ode';

// ── special functions ─────────────────────────────────────────────────────────

export function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularized incomplete beta function I_x(a, b) (continued fraction, Lentz's method). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx: number, aa: number, bb: number) => {
    const tiny = 1e-300;
    let c = 1, d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + num / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; h *= d * c;
      num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + num / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/** Two-sided p-value of Student's t with ν degrees of freedom. */
export const tTwoSidedP = (t: number, df: number) => (Number.isFinite(t) && df > 0 ? incompleteBeta(df / (df + t * t), df / 2, 0.5) : NaN);

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erfc, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp((-z * z) / 2);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  const q = p - 0.5, r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

// ── ANALYTIC-020 descriptive statistics and distribution fits ─────────────────

export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const pos = (n - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export interface Descriptive { n: number; mean: number; sd: number; sem: number; min: number; max: number; median: number; q1: number; q3: number; iqr: number; skewness: number; kurtosisExcess: number }

export function describe(x: ArrayLike<number>): Descriptive {
  const n = x.length;
  const s = Float64Array.from(x).sort();
  let mean = 0;
  for (const v of s) mean += v;
  mean /= n || 1;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of s) { const d = v - mean; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
  const sd = n > 1 ? Math.sqrt(m2 / (n - 1)) : NaN;
  const p2 = m2 / n;
  return {
    n, mean, sd, sem: sd / Math.sqrt(n), min: s[0] ?? NaN, max: s[n - 1] ?? NaN, median: quantile(s, 0.5), q1: quantile(s, 0.25), q3: quantile(s, 0.75),
    iqr: quantile(s, 0.75) - quantile(s, 0.25), skewness: p2 > 0 ? m3 / n / Math.pow(p2, 1.5) : NaN, kurtosisExcess: p2 > 0 ? m4 / n / (p2 * p2) - 3 : NaN,
  };
}

export function empiricalCdf(x: ArrayLike<number>): { x: Float64Array; p: Float64Array } {
  const s = Float64Array.from(x).sort();
  return { x: s, p: Float64Array.from(s, (_, i) => (i + 1) / s.length) };
}

export function histogram(x: ArrayLike<number>, bins = 30): { centers: Float64Array; counts: Float64Array; density: Float64Array; width: number } {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < x.length; i++) { if (x[i]! < lo) lo = x[i]!; if (x[i]! > hi) hi = x[i]!; }
  if (!(hi > lo)) { hi = lo + 1; }
  const width = (hi - lo) / bins;
  const counts = new Float64Array(bins);
  for (let i = 0; i < x.length; i++) { const b = Math.min(bins - 1, Math.floor((x[i]! - lo) / width)); counts[b] = counts[b]! + 1; }
  return { centers: Float64Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * width), counts, density: Float64Array.from(counts, (c) => c / (x.length * width)), width };
}

export type DistributionKind = 'gaussian' | 'exponential' | 'lognormal' | 'poisson';
export interface DistributionFit { kind: DistributionKind; params: Record<string, number>; logLikelihood: number; k: number; aic: number; bic: number; valid: boolean }

/** Maximum-likelihood fit of one parametric family with its log-likelihood and information criteria. */
export function fitDistribution(x: ArrayLike<number>, kind: DistributionKind): DistributionFit {
  const n = x.length;
  let ll = NaN, k = 2, valid = true;
  const params: Record<string, number> = {};
  if (kind === 'gaussian') {
    let m = 0; for (let i = 0; i < n; i++) m += x[i]!; m /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (x[i]! - m) ** 2; v /= n;
    params.mu = m; params.sigma = Math.sqrt(v);
    ll = -0.5 * n * (Math.log(2 * Math.PI * v) + 1);
  } else if (kind === 'exponential') {
    k = 1;
    let m = 0; for (let i = 0; i < n; i++) { m += x[i]!; if (x[i]! < 0) valid = false; } m /= n;
    params.rate = 1 / m;
    ll = valid ? n * Math.log(1 / m) - n : NaN;
  } else if (kind === 'lognormal') {
    let m = 0; for (let i = 0; i < n; i++) { if (x[i]! <= 0) valid = false; else m += Math.log(x[i]!); } m /= n;
    let v = 0, sl = 0; for (let i = 0; i < n; i++) if (x[i]! > 0) { v += (Math.log(x[i]!) - m) ** 2; sl += Math.log(x[i]!); } v /= n;
    params.mu = m; params.sigma = Math.sqrt(v);
    ll = valid ? -0.5 * n * (Math.log(2 * Math.PI * v) + 1) - sl : NaN;
  } else {
    k = 1;
    let m = 0; for (let i = 0; i < n; i++) { m += x[i]!; if (x[i]! < 0 || Math.abs(x[i]! - Math.round(x[i]!)) > 1e-9) valid = false; } m /= n;
    params.lambda = m;
    if (valid) { ll = 0; for (let i = 0; i < n; i++) ll += x[i]! * Math.log(m) - m - logGamma(x[i]! + 1); }
  }
  const ic = informationCriteria(ll, k, n);
  return { kind, params, logLikelihood: ll, k, aic: ic.aic, bic: ic.bic, valid };
}

// ── ANALYTIC-021 correlation ──────────────────────────────────────────────────

export interface CorrelationResult { r: number; n: number; t: number; p: number; ciLow: number; ciHigh: number }

/** Pearson product-moment correlation with a t-test p-value and Fisher-z 95% confidence interval. */
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): CorrelationResult {
  const n = Math.min(x.length, y.length);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]!; my += y[i]!; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i]! - mx, b = y[i]! - my; sxy += a * b; sxx += a * a; syy += b * b; }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  const t = r * Math.sqrt((n - 2) / Math.max(1e-300, 1 - r * r));
  const z = Math.atanh(Math.max(-0.999999999, Math.min(0.999999999, r))), se = 1 / Math.sqrt(Math.max(1, n - 3));
  return { r, n, t, p: n > 2 ? tTwoSidedP(t, n - 2) : NaN, ciLow: Math.tanh(z - 1.959964 * se), ciHigh: Math.tanh(z + 1.959964 * se) };
}

/** Average ranks (ties share the mean rank). */
export function ranks(x: ArrayLike<number>): Float64Array {
  const n = x.length, idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a]! - x[b]!);
  const r = new Float64Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]!] === x[idx[i]!]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]!] = avg;
    i = j + 1;
  }
  return r;
}

/** Spearman rank correlation: Pearson correlation of the ranks. */
export const spearman = (x: ArrayLike<number>, y: ArrayLike<number>): CorrelationResult => pearson(ranks(x), ranks(y));

export function correlationMatrix(columns: ArrayLike<number>[], method: 'pearson' | 'spearman' = 'pearson'): Float64Array {
  const c = columns.length, m = new Float64Array(c * c);
  const cols = method === 'spearman' ? columns.map((x) => ranks(x)) : columns;
  for (let i = 0; i < c; i++) for (let j = i; j < c; j++) { const r = i === j ? 1 : pearson(cols[i]!, cols[j]!).r; m[i * c + j] = r; m[j * c + i] = r; }
  return m;
}

// ── ANALYTIC-022 ordinary least squares ───────────────────────────────────────

export interface RegressionResult {
  /** Coefficients β₀ … β_d of y = Σ β_k x^k. */
  coefficients: Float64Array;
  standardErrors: Float64Array;
  r2: number;
  adjustedR2: number;
  residuals: Float64Array;
  fitted: Float64Array;
  /** Durbin–Watson statistic (≈ 2 without lag-1 autocorrelation of residuals). */
  durbinWatson: number;
  residualSd: number;
  logLikelihood: number;
  n: number;
  k: number;
}

/** Polynomial OLS β̂ = (XᵀX)⁻¹ Xᵀ y via the normal equations (x is centred and scaled internally for conditioning). */
export function polynomialRegression(x: ArrayLike<number>, y: ArrayLike<number>, degree = 1): RegressionResult {
  const n = Math.min(x.length, y.length), p = degree + 1;
  if (n <= p) throw new Error(`Regression of degree ${degree} needs more than ${p} points.`);
  const X = (xi: number, k: number) => Math.pow(xi, k);
  const A = new Float64Array(p * p), b = new Float64Array(p);
  for (let i = 0; i < n; i++) for (let r = 0; r < p; r++) { b[r] = b[r]! + X(x[i]!, r) * y[i]!; for (let c = 0; c < p; c++) A[r * p + c] = A[r * p + c]! + X(x[i]!, r) * X(x[i]!, c); }
  const { lu, perm } = luDecompose(A, p);
  const beta = new Float64Array(p);
  luSolve(lu, perm, p, b, beta);
  const fitted = new Float64Array(n), residuals = new Float64Array(n);
  let my = 0;
  for (let i = 0; i < n; i++) my += y[i]!;
  my /= n;
  let sse = 0, sst = 0, dwNum = 0;
  for (let i = 0; i < n; i++) {
    let f = 0;
    for (let k = 0; k < p; k++) f += beta[k]! * X(x[i]!, k);
    fitted[i] = f; residuals[i] = y[i]! - f;
    sse += residuals[i]! ** 2; sst += (y[i]! - my) ** 2;
    if (i > 0) dwNum += (residuals[i]! - residuals[i - 1]!) ** 2;
  }
  const s2 = sse / (n - p);
  const se = new Float64Array(p), e = new Float64Array(p), col = new Float64Array(p);
  for (let k = 0; k < p; k++) { e.fill(0); e[k] = 1; luSolve(lu, perm, p, e, col); se[k] = Math.sqrt(Math.max(0, s2 * col[k]!)); }
  const r2 = sst > 0 ? 1 - sse / sst : NaN;
  return {
    coefficients: beta, standardErrors: se, r2, adjustedR2: 1 - ((1 - r2) * (n - 1)) / (n - p), residuals, fitted,
    durbinWatson: sse > 0 ? dwNum / sse : NaN, residualSd: Math.sqrt(s2), logLikelihood: -0.5 * n * (Math.log((2 * Math.PI * sse) / n) + 1), n, k: p + 1,
  };
}

// ── ANALYTIC-023 bootstrap ────────────────────────────────────────────────────

export interface BootstrapResult { estimate: number; ciLow: number; ciHigh: number; bcaLow: number; bcaHigh: number; standardError: number; replicates: number; distribution: Float64Array }

/** Nonparametric bootstrap (seeded) with percentile and bias-corrected accelerated (BCa) 95% intervals. */
export function bootstrapCI(x: ArrayLike<number>, statistic: (sample: Float64Array) => number, replicates = 2000, seed = 42, level = 0.95): BootstrapResult {
  const n = x.length, rng = new Rng(seed), data = Float64Array.from(x);
  const est = statistic(data);
  const dist = new Float64Array(replicates), sample = new Float64Array(n);
  for (let b = 0; b < replicates; b++) { for (let i = 0; i < n; i++) sample[i] = data[rng.int(n)]!; dist[b] = statistic(sample); }
  const sorted = Float64Array.from(dist).sort();
  const a2 = (1 - level) / 2;
  let m = 0;
  for (const v of dist) m += v;
  m /= replicates;
  let v2 = 0, below = 0;
  for (const v of dist) { v2 += (v - m) ** 2; if (v < est) below++; }
  // BCa: bias correction z₀ from the bootstrap distribution, acceleration from the jackknife.
  const z0 = normalInv(Math.min(1 - 1e-9, Math.max(1e-9, below / replicates)));
  const jack = new Float64Array(n), loo = new Float64Array(n - 1);
  let jm = 0;
  for (let i = 0; i < n; i++) { for (let k = 0, q = 0; k < n; k++) if (k !== i) loo[q++] = data[k]!; jack[i] = statistic(loo); jm += jack[i]!; }
  jm /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const d = jm - jack[i]!; num += d * d * d; den += d * d; }
  const acc = den > 0 ? num / (6 * Math.pow(den, 1.5)) : 0;
  const adj = (alpha: number) => { const z = normalInv(alpha); return normalCdf(z0 + (z0 + z) / (1 - acc * (z0 + z))); };
  return {
    estimate: est, ciLow: quantile(sorted, a2), ciHigh: quantile(sorted, 1 - a2), bcaLow: quantile(sorted, adj(a2)), bcaHigh: quantile(sorted, adj(1 - a2)),
    standardError: Math.sqrt(v2 / (replicates - 1)), replicates, distribution: sorted,
  };
}

// ── ANALYTIC-024 two-sample tests and FDR ─────────────────────────────────────

export interface TTestResult { t: number; df: number; p: number; meanDiff: number; cohenD: number }

/** Welch's unequal-variance t-test (two-sided). */
export function welchTTest(a: ArrayLike<number>, b: ArrayLike<number>): TTestResult {
  const da = describe(a), db = describe(b);
  const va = da.sd ** 2 / da.n, vb = db.sd ** 2 / db.n;
  const t = (da.mean - db.mean) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (da.n - 1) + vb ** 2 / (db.n - 1));
  const pooled = Math.sqrt(((da.n - 1) * da.sd ** 2 + (db.n - 1) * db.sd ** 2) / (da.n + db.n - 2));
  return { t, df, p: tTwoSidedP(t, df), meanDiff: da.mean - db.mean, cohenD: (da.mean - db.mean) / pooled };
}

/** Mann–Whitney U test (normal approximation with tie and continuity correction, two-sided). */
export function mannWhitneyU(a: ArrayLike<number>, b: ArrayLike<number>): { u: number; z: number; p: number; rankBiserial: number } {
  const n1 = a.length, n2 = b.length;
  const all = new Float64Array(n1 + n2);
  for (let i = 0; i < n1; i++) all[i] = a[i]!;
  for (let i = 0; i < n2; i++) all[n1 + i] = b[i]!;
  const r = ranks(all);
  let r1 = 0;
  for (let i = 0; i < n1; i++) r1 += r[i]!;
  const u1 = r1 - (n1 * (n1 + 1)) / 2, u = Math.min(u1, n1 * n2 - u1);
  const sorted = Float64Array.from(all).sort();
  let tie = 0;
  for (let i = 0; i < sorted.length;) { let j = i; while (j + 1 < sorted.length && sorted[j + 1] === sorted[i]) j++; const t = j - i + 1; tie += t * t * t - t; i = j + 1; }
  const N = n1 + n2, mu = (n1 * n2) / 2, sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
  const z = sigma > 0 ? (Math.abs(u1 - mu) - 0.5) / sigma : 0;
  return { u, z, p: sigma > 0 ? Math.min(1, 2 * (1 - normalCdf(Math.max(0, z)))) : 1, rankBiserial: 1 - (2 * u) / (n1 * n2) };
}

/** Monte-Carlo permutation test on the difference of means (seeded, two-sided, with the +1 correction). */
export function permutationTest(a: ArrayLike<number>, b: ArrayLike<number>, permutations = 5000, seed = 42): { observed: number; p: number; permutations: number } {
  const n1 = a.length, n2 = b.length, N = n1 + n2, rng = new Rng(seed);
  const pool = new Float64Array(N);
  let s1 = 0, total = 0;
  for (let i = 0; i < n1; i++) { pool[i] = a[i]!; s1 += a[i]!; total += a[i]!; }
  for (let i = 0; i < n2; i++) { pool[n1 + i] = b[i]!; total += b[i]!; }
  const diff = (sum1: number) => sum1 / n1 - (total - sum1) / n2;
  const obs = Math.abs(diff(s1));
  let extreme = 0;
  for (let k = 0; k < permutations; k++) {
    let s = 0;
    for (let i = 0; i < n1; i++) { const j = i + rng.int(N - i); const t = pool[i]!; pool[i] = pool[j]!; pool[j] = t; s += pool[i]!; }
    if (Math.abs(diff(s)) >= obs - 1e-12) extreme++;
  }
  return { observed: diff(s1), p: (extreme + 1) / (permutations + 1), permutations };
}

/** Benjamini–Hochberg FDR: adjusted p-values (q) and rejection mask at level q*. */
export function benjaminiHochberg(pValues: ArrayLike<number>, q = 0.05): { adjusted: Float64Array; rejected: Uint8Array; discoveries: number; threshold: number } {
  const m = pValues.length, order = Array.from({ length: m }, (_, i) => i).sort((i, j) => pValues[i]! - pValues[j]!);
  const adjusted = new Float64Array(m), rejected = new Uint8Array(m);
  let prev = 1, kMax = -1;
  for (let r = m - 1; r >= 0; r--) { const i = order[r]!; prev = Math.min(prev, (pValues[i]! * m) / (r + 1)); adjusted[i] = prev; if (kMax < 0 && pValues[i]! <= ((r + 1) / m) * q) kMax = r; }
  for (let r = 0; r <= kMax; r++) rejected[order[r]!] = 1;
  return { adjusted, rejected, discoveries: kMax + 1, threshold: kMax >= 0 ? pValues[order[kMax]!]! : 0 };
}

// ── ANALYTIC-025 parameter estimation and sensitivity ─────────────────────────

export interface FitResult { params: Float64Array; sse: number; iterations: number; converged: boolean }

/** Nelder–Mead simplex minimization. */
export function nelderMead(f: (p: Float64Array) => number, start: ArrayLike<number>, opts: { maxIter?: number; tol?: number; step?: number } = {}): { x: Float64Array; value: number; iterations: number; converged: boolean } {
  const n = start.length, maxIter = opts.maxIter ?? 2000, tol = opts.tol ?? 1e-12;
  const simplex: Float64Array[] = [Float64Array.from(start)];
  for (let i = 0; i < n; i++) { const v = Float64Array.from(start); v[i] = v[i]! !== 0 ? v[i]! * (1 + (opts.step ?? 0.1)) : opts.step ?? 0.1; simplex.push(v); }
  let vals = simplex.map(f);
  let it = 0, converged = false;
  const centroid = new Float64Array(n);
  const combine = (a: Float64Array, b: Float64Array, t: number) => Float64Array.from(a, (v, i) => v + t * (b[i]! - v));
  for (; it < maxIter; it++) {
    const order = vals.map((_, i) => i).sort((i, j) => vals[i]! - vals[j]!);
    const s = order.map((i) => simplex[i]!), v = order.map((i) => vals[i]!);
    for (let i = 0; i <= n; i++) simplex[i] = s[i]!;
    vals = v;
    if (Math.abs(vals[n]! - vals[0]!) <= tol * (Math.abs(vals[0]!) + tol)) { converged = true; break; }
    centroid.fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) centroid[k] = centroid[k]! + simplex[i]![k]! / n;
    const worst = simplex[n]!;
    const refl = combine(centroid, worst, -1), fr = f(refl);
    if (fr < vals[0]!) {
      const exp = combine(centroid, worst, -2), fe = f(exp);
      if (fe < fr) { simplex[n] = exp; vals[n] = fe; } else { simplex[n] = refl; vals[n] = fr; }
    } else if (fr < vals[n - 1]!) { simplex[n] = refl; vals[n] = fr; }
    else {
      const con = fr < vals[n]! ? combine(centroid, worst, -0.5) : combine(centroid, worst, 0.5), fc = f(con);
      if (fc < Math.min(fr, vals[n]!)) { simplex[n] = con; vals[n] = fc; }
      else for (let i = 1; i <= n; i++) { simplex[i] = combine(simplex[0]!, simplex[i]!, 0.5); vals[i] = f(simplex[i]!); }
    }
  }
  let best = 0;
  for (let i = 1; i <= n; i++) if (vals[i]! < vals[best]!) best = i;
  return { x: simplex[best]!, value: vals[best]!, iterations: it, converged };
}

/** Nonlinear least squares: minimizes Σ (y_i − model(x_i, p))² with Nelder–Mead. */
export function fitCurve(x: ArrayLike<number>, y: ArrayLike<number>, model: (x: number, p: Float64Array) => number, start: ArrayLike<number>): FitResult {
  const sse = (p: Float64Array) => { let s = 0; for (let i = 0; i < x.length; i++) { const d = y[i]! - model(x[i]!, p); s += d * d; } return Number.isFinite(s) ? s : 1e300; };
  const r = nelderMead(sse, start);
  return { params: r.x, sse: r.value, iterations: r.iterations, converged: r.converged };
}

/** Normalized one-at-a-time sensitivity S = (p₀ / M(p₀)) · [M(p₀ + Δ) − M(p₀ − Δ)] / (2Δ) with Δ = 5% of p₀. */
export function sensitivityIndex(metric: (value: number) => number, p0: number, relStep = 0.05): { index: number; base: number; plus: number; minus: number } {
  const d = relStep * (p0 !== 0 ? Math.abs(p0) : 1);
  const base = metric(p0), plus = metric(p0 + d), minus = metric(p0 - d);
  return { index: base !== 0 ? (p0 / base) * ((plus - minus) / (2 * d)) : NaN, base, plus, minus };
}

// ── ANALYTIC-026 information criteria ─────────────────────────────────────────

/** AIC = 2k − 2 ln L̂, BIC = k ln n − 2 ln L̂. */
export function informationCriteria(logLikelihood: number, k: number, n: number): { aic: number; bic: number; aicc: number } {
  const aic = 2 * k - 2 * logLikelihood;
  return { aic, bic: k * Math.log(n) - 2 * logLikelihood, aicc: n - k - 1 > 0 ? aic + (2 * k * (k + 1)) / (n - k - 1) : NaN };
}

/** Akaike weights for a set of candidate models. */
export function akaikeWeights(aics: ArrayLike<number>): Float64Array {
  let min = Infinity;
  for (let i = 0; i < aics.length; i++) if (Number.isFinite(aics[i]!) && aics[i]! < min) min = aics[i]!;
  const w = Float64Array.from(aics, (a) => (Number.isFinite(a) ? Math.exp(-0.5 * (a - min)) : 0));
  let s = 0;
  for (const v of w) s += v;
  return w.map((v) => (s > 0 ? v / s : 0));
}
