// ANALYTIC-009 … ANALYTIC-015: spike-train statistics, synchrony, phase locking and coherence.
// Definitions: docs/08-neural-data-and-analytics/SIGNAL_ANALYTICS.md §3. Spike times are in milliseconds.
import { fftInPlace, makeWindow } from './fft';
import { analyticSignal } from './spectral';

/** Splits a flat (times, ids) raster into per-neuron sorted spike-time arrays. */
export function groupSpikes(times: ArrayLike<number>, ids: ArrayLike<number>, n: number): Float64Array[] {
  const counts = new Uint32Array(n);
  for (let i = 0; i < ids.length; i++) if (ids[i]! < n) counts[ids[i]!] = counts[ids[i]!]! + 1;
  const out = Array.from(counts, (c) => new Float64Array(c));
  const fill = new Uint32Array(n);
  for (let i = 0; i < ids.length; i++) { const id = ids[i]!; if (id < n) { out[id]![fill[id]!] = times[i]!; fill[id] = fill[id]! + 1; } }
  for (const a of out) a.sort();
  return out;
}

/** ANALYTIC-009: mean firing rates r_i = N_sp,i / T (Hz). */
export function firingRates(trains: ArrayLike<number>[], durationMs: number): Float64Array {
  return Float64Array.from(trains, (t) => (t.length * 1000) / durationMs);
}

/** ANALYTIC-009: Gaussian-kernel population rate R(t) = (1/N) Σ K_σ(t − t_i^f), in Hz. */
export function populationRate(times: ArrayLike<number>, nNeurons: number, durationMs: number, sigmaMs = 5, binMs = 1): { t: Float64Array; rate: Float64Array } {
  const nb = Math.max(1, Math.ceil(durationMs / binMs));
  const counts = new Float64Array(nb);
  for (let i = 0; i < times.length; i++) { const b = Math.floor(times[i]! / binMs); if (b >= 0 && b < nb) counts[b] = counts[b]! + 1; }
  const half = Math.max(1, Math.ceil((4 * sigmaMs) / binMs));
  const kernel = new Float64Array(2 * half + 1);
  let ks = 0;
  for (let k = -half; k <= half; k++) { kernel[k + half] = Math.exp(-0.5 * ((k * binMs) / sigmaMs) ** 2); ks += kernel[k + half]!; }
  const rate = new Float64Array(nb), t = new Float64Array(nb);
  const scale = 1000 / (binMs * Math.max(1, nNeurons) * ks);
  for (let i = 0; i < nb; i++) {
    let s = 0;
    for (let k = -half; k <= half; k++) { const j = i + k; if (j >= 0 && j < nb) s += counts[j]! * kernel[k + half]!; }
    rate[i] = s * scale;
    t[i] = (i + 0.5) * binMs;
  }
  return { t, rate };
}

export interface IsiResult {
  intervals: Float64Array;
  mean: number;
  sd: number;
  /** CV_ISI = σ_ISI / μ_ISI (0 periodic, 1 Poisson). */
  cv: number;
  /** Mean local variation CV₂ = ⟨2|Δt_{k+1} − Δt_k| / (Δt_{k+1} + Δt_k)⟩. */
  cv2: number;
  histogram: { centers: Float64Array; counts: Float64Array; binMs: number };
}

/** ANALYTIC-010: inter-spike-interval distribution, CV and CV₂ pooled over the supplied trains. */
export function isiAnalysis(trains: ArrayLike<number>[], binMs = 2, maxMs?: number): IsiResult {
  const all: number[] = [];
  let cv2Sum = 0, cv2N = 0;
  for (const tr of trains) {
    for (let i = 1; i < tr.length; i++) all.push(tr[i]! - tr[i - 1]!);
    for (let i = 2; i < tr.length; i++) { const a = tr[i - 1]! - tr[i - 2]!, b = tr[i]! - tr[i - 1]!; if (a + b > 0) { cv2Sum += (2 * Math.abs(b - a)) / (a + b); cv2N++; } }
  }
  const intervals = Float64Array.from(all);
  const n = intervals.length;
  let mean = 0;
  for (const v of intervals) mean += v;
  mean = n ? mean / n : NaN;
  let varSum = 0;
  for (const v of intervals) varSum += (v - mean) ** 2;
  const sd = n > 1 ? Math.sqrt(varSum / (n - 1)) : NaN;
  let top = maxMs ?? 0;
  if (!maxMs) { for (const v of intervals) if (v > top) top = v; }
  const nb = Math.max(1, Math.min(400, Math.ceil((top || binMs) / binMs)));
  const counts = new Float64Array(nb), centers = Float64Array.from({ length: nb }, (_, i) => (i + 0.5) * binMs);
  for (const v of intervals) { const b = Math.floor(v / binMs); if (b >= 0 && b < nb) counts[b] = counts[b]! + 1; }
  return { intervals, mean, sd, cv: sd / mean, cv2: cv2N ? cv2Sum / cv2N : NaN, histogram: { centers, counts, binMs } };
}

/** ANALYTIC-011: Fano factor F(W) = Var(N) / E[N] of spike counts in windows of length W. */
export function fanoFactor(train: ArrayLike<number>, durationMs: number, windowMs: number): { fano: number; meanCount: number; variance: number; windows: number } {
  const nw = Math.floor(durationMs / windowMs);
  if (nw < 2) return { fano: NaN, meanCount: NaN, variance: NaN, windows: nw };
  const counts = new Float64Array(nw);
  for (let i = 0; i < train.length; i++) { const b = Math.floor(train[i]! / windowMs); if (b >= 0 && b < nw) counts[b] = counts[b]! + 1; }
  let m = 0;
  for (const c of counts) m += c;
  m /= nw;
  let v = 0;
  for (const c of counts) v += (c - m) ** 2;
  v /= nw - 1;
  return { fano: m > 0 ? v / m : NaN, meanCount: m, variance: v, windows: nw };
}

/** Fano factor as a function of counting window (log-spaced windows). */
export function fanoCurve(train: ArrayLike<number>, durationMs: number, windowsMs: ArrayLike<number>): { windowMs: Float64Array; fano: Float64Array } {
  return { windowMs: Float64Array.from(windowsMs), fano: Float64Array.from(windowsMs, (w) => fanoFactor(train, durationMs, w).fano) };
}

/** ANALYTIC-012: peri-stimulus time histogram r(kΔ) = n_k / (M Δ) in Hz. */
export function psth(train: ArrayLike<number>, triggersMs: ArrayLike<number>, preMs: number, postMs: number, binMs: number): { t: Float64Array; rate: Float64Array; trials: number; counts: Float64Array } {
  const nb = Math.max(1, Math.round((preMs + postMs) / binMs));
  const counts = new Float64Array(nb);
  const M = triggersMs.length;
  let lo = 0;
  const sorted = Float64Array.from(train).sort();
  const trig = Float64Array.from(triggersMs).sort();
  for (let k = 0; k < M; k++) {
    const t0 = trig[k]! - preMs, t1 = trig[k]! + postMs;
    while (lo < sorted.length && sorted[lo]! < t0) lo++;
    for (let i = lo; i < sorted.length && sorted[i]! < t1; i++) { const b = Math.floor((sorted[i]! - t0) / binMs); if (b >= 0 && b < nb) counts[b] = counts[b]! + 1; }
  }
  return { t: Float64Array.from({ length: nb }, (_, i) => -preMs + (i + 0.5) * binMs), rate: Float64Array.from(counts, (c) => (M ? (c * 1000) / (M * binMs) : 0)), trials: M, counts };
}

/** ANALYTIC-013: spike-triggered average STA(τ) = (1/N_sp) Σ s(t_f − τ) for τ ∈ [0, windowMs]. */
export function spikeTriggeredAverage(stimulus: ArrayLike<number>, fs: number, train: ArrayLike<number>, windowMs: number): { lagMs: Float64Array; sta: Float64Array; spikesUsed: number } {
  const len = Math.max(1, Math.round((windowMs * fs) / 1000));
  const sta = new Float64Array(len + 1);
  let used = 0;
  for (let f = 0; f < train.length; f++) {
    const idx = Math.round((train[f]! * fs) / 1000);
    if (idx - len < 0 || idx >= stimulus.length) continue;
    for (let k = 0; k <= len; k++) sta[k] = sta[k]! + stimulus[idx - k]!;
    used++;
  }
  if (used) for (let k = 0; k <= len; k++) sta[k] = sta[k]! / used;
  return { lagMs: Float64Array.from({ length: len + 1 }, (_, k) => (k * 1000) / fs), sta, spikesUsed: used };
}

/**
 * ANALYTIC-014: cross-correlogram C_ij(τ) = 1/(T √(r_i r_j)) Σ 𝟙(τ − Δ/2 ≤ t_i − t_j < τ + Δ/2) (rates in spikes/ms,
 * so the baseline of two independent trains is Δ √(r_i r_j)). Passing the same train twice gives the
 * auto-correlogram with the zero-lag self-pairs removed.
 */
export function crossCorrelogram(a: ArrayLike<number>, b: ArrayLike<number>, durationMs: number, maxLagMs: number, binMs: number): { lagMs: Float64Array; ccg: Float64Array; counts: Float64Array; chanceLevel: number; peakLagMs: number } {
  const nb = 2 * Math.round(maxLagMs / binMs) + 1, mid = (nb - 1) / 2;
  const counts = new Float64Array(nb);
  const same = a === b;
  let lo = 0;
  for (let i = 0; i < a.length; i++) {
    const ti = a[i]!;
    while (lo < b.length && b[lo]! < ti - maxLagMs - binMs / 2) lo++;
    for (let j = lo; j < b.length; j++) {
      const d = ti - b[j]!;
      if (d < -maxLagMs - binMs / 2) break;
      if (same && i === j) continue;
      const k = Math.floor((d + maxLagMs + binMs / 2) / binMs);
      if (k >= 0 && k < nb) counts[k] = counts[k]! + 1;
    }
  }
  const ri = a.length / durationMs, rj = b.length / durationMs;
  const norm = durationMs * Math.sqrt(ri * rj);
  const ccg = Float64Array.from(counts, (c) => (norm > 0 ? c / norm : 0));
  let best = -Infinity, peak = 0;
  for (let k = 0; k < nb; k++) if (ccg[k]! > best) { best = ccg[k]!; peak = (k - mid) * binMs; }
  return { lagMs: Float64Array.from({ length: nb }, (_, k) => (k - mid) * binMs), ccg, counts, chanceLevel: binMs * Math.sqrt(ri * rj), peakLagMs: peak };
}

/**
 * ANALYTIC-015: Golomb–Rinzel synchrony χ = sqrt(σ²_pop / ⟨σ²_i⟩) computed on signals (rows = units).
 * For spike trains, pass smoothed single-unit rate signals from `binnedRates`.
 */
export function synchronyChi(signals: ArrayLike<number>[]): number {
  const n = signals.length, T = signals[0]?.length ?? 0;
  if (n < 2 || T < 2) return NaN;
  const pop = new Float64Array(T);
  let meanVar = 0;
  for (const s of signals) {
    let m = 0;
    for (let t = 0; t < T; t++) { m += s[t]!; pop[t] = pop[t]! + s[t]! / n; }
    m /= T;
    let v = 0;
    for (let t = 0; t < T; t++) v += (s[t]! - m) ** 2;
    meanVar += v / T / n;
  }
  let pm = 0;
  for (let t = 0; t < T; t++) pm += pop[t]!;
  pm /= T;
  let pv = 0;
  for (let t = 0; t < T; t++) pv += (pop[t]! - pm) ** 2;
  pv /= T;
  return meanVar > 0 ? Math.sqrt(pv / meanVar) : NaN;
}

/** Box-smoothed single-unit rate signals (Hz) for the synchrony index. */
export function binnedRates(trains: ArrayLike<number>[], durationMs: number, binMs: number, smoothBins = 1): Float64Array[] {
  const nb = Math.max(1, Math.floor(durationMs / binMs));
  return trains.map((tr) => {
    const c = new Float64Array(nb);
    for (let i = 0; i < tr.length; i++) { const b = Math.floor(tr[i]! / binMs); if (b >= 0 && b < nb) c[b] = c[b]! + 1000 / binMs; }
    if (smoothBins <= 1) return c;
    const out = new Float64Array(nb);
    let acc = 0;
    for (let i = 0; i < nb; i++) { acc += c[i]!; if (i >= smoothBins) acc -= c[i - smoothBins]!; out[i] = acc / Math.min(i + 1, smoothBins); }
    return out;
  });
}

/** ANALYTIC-015: phase-locking value PLV = |⟨e^{j(φ_x − φ_y)}⟩| from Hilbert phases (apply a narrow band-pass first). */
export function phaseLockingValue(x: ArrayLike<number>, y: ArrayLike<number>, trimFraction = 0.05): { plv: number; meanPhaseDiff: number } {
  const n = Math.min(x.length, y.length);
  const px = analyticSignal(Float64Array.from({ length: n }, (_, i) => x[i]!)).phase, py = analyticSignal(Float64Array.from({ length: n }, (_, i) => y[i]!)).phase;
  const trim = Math.floor(n * trimFraction);
  let sr = 0, si = 0, c = 0;
  for (let i = trim; i < n - trim; i++) { const d = px[i]! - py[i]!; sr += Math.cos(d); si += Math.sin(d); c++; }
  return { plv: c ? Math.hypot(sr, si) / c : NaN, meanPhaseDiff: Math.atan2(si, sr) };
}

/** ANALYTIC-015: magnitude-squared coherence C_xy(f) = |P_xy|² / (P_xx P_yy) from Welch cross-spectra. */
export function coherence(x: ArrayLike<number>, y: ArrayLike<number>, fs: number, segmentLength = 256, overlap = 0.5): { freq: Float64Array; coherence: Float64Array; phase: Float64Array; segments: number } {
  const n = Math.min(x.length, y.length);
  let L = 2;
  while (L * 2 <= Math.min(n, segmentLength)) L *= 2;
  const step = Math.max(1, Math.floor(L * (1 - overlap))), half = L / 2;
  const w = makeWindow('hann', L);
  const pxx = new Float64Array(half + 1), pyy = new Float64Array(half + 1), pr = new Float64Array(half + 1), pi = new Float64Array(half + 1);
  const xr = new Float64Array(L), xi = new Float64Array(L), yr = new Float64Array(L), yi = new Float64Array(L);
  let K = 0;
  for (let s = 0; s + L <= n; s += step) {
    let mx = 0, my = 0;
    for (let i = 0; i < L; i++) { mx += x[s + i]!; my += y[s + i]!; }
    mx /= L; my /= L;
    for (let i = 0; i < L; i++) { xr[i] = (x[s + i]! - mx) * w[i]!; xi[i] = 0; yr[i] = (y[s + i]! - my) * w[i]!; yi[i] = 0; }
    fftInPlace(xr, xi); fftInPlace(yr, yi);
    for (let k = 0; k <= half; k++) {
      pxx[k] = pxx[k]! + xr[k]! * xr[k]! + xi[k]! * xi[k]!;
      pyy[k] = pyy[k]! + yr[k]! * yr[k]! + yi[k]! * yi[k]!;
      pr[k] = pr[k]! + xr[k]! * yr[k]! + xi[k]! * yi[k]!;
      pi[k] = pi[k]! + xi[k]! * yr[k]! - xr[k]! * yi[k]!;
    }
    K++;
  }
  const freq = new Float64Array(half + 1), coh = new Float64Array(half + 1), phase = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    freq[k] = (k * fs) / L;
    const den = pxx[k]! * pyy[k]!;
    coh[k] = den > 0 ? (pr[k]! * pr[k]! + pi[k]! * pi[k]!) / den : 0;
    phase[k] = Math.atan2(pi[k]!, pr[k]!);
  }
  return { freq, coherence: coh, phase, segments: K };
}
