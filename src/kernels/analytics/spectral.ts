// ANALYTIC-005 STFT spectrogram, ANALYTIC-006 complex Morlet wavelet transform, ANALYTIC-007 ERP averaging,
// plus the analytic signal (Hilbert transform) used by phase-locking measures.
// Definitions: docs/08-neural-data-and-analytics/SIGNAL_ANALYTICS.md §2.2.
import { fftInPlace, makeWindow, nextPow2, type WindowKind } from './fft';

export interface TimeFrequency {
  /** Time of each column (s). */
  times: Float64Array;
  /** Frequency of each row (Hz). */
  freqs: Float64Array;
  /** Row-major power, rows = frequencies, cols = times. */
  power: Float64Array;
  rows: number;
  cols: number;
  /** Time resolution Δt (s) and frequency resolution Δf (Hz) of the analysis. */
  deltaT: number;
  deltaF: number;
}

/** Short-time Fourier transform power (unit²/Hz, one-sided) with hop H between windows. */
export function stft(x: ArrayLike<number>, fs: number, windowLength: number, hop?: number, window: WindowKind = 'hann', maxFreq = Infinity): TimeFrequency {
  const n = x.length;
  let L = 2;
  while (L * 2 <= Math.min(n, windowLength)) L *= 2;
  const H = Math.max(1, Math.round(hop ?? L / 4));
  const w = makeWindow(window, L);
  let U = 0;
  for (let i = 0; i < L; i++) U += w[i]! * w[i]!;
  const half = L / 2;
  let rows = half + 1;
  if (Number.isFinite(maxFreq)) rows = Math.min(rows, Math.floor((maxFreq * L) / fs) + 1);
  const cols = n >= L ? Math.floor((n - L) / H) + 1 : 0;
  const power = new Float64Array(rows * cols), times = new Float64Array(cols), freqs = new Float64Array(rows);
  for (let k = 0; k < rows; k++) freqs[k] = (k * fs) / L;
  const re = new Float64Array(L), im = new Float64Array(L);
  for (let c = 0; c < cols; c++) {
    const start = c * H;
    let mean = 0;
    for (let i = 0; i < L; i++) mean += x[start + i]!;
    mean /= L;
    for (let i = 0; i < L; i++) { re[i] = (x[start + i]! - mean) * w[i]!; im[i] = 0; }
    fftInPlace(re, im);
    for (let k = 0; k < rows; k++) power[k * cols + c] = ((k === 0 || k === half ? 1 : 2) * (re[k]! * re[k]! + im[k]! * im[k]!)) / (fs * U);
    times[c] = (start + L / 2) / fs;
  }
  return { times, freqs, power, rows, cols, deltaT: L / fs, deltaF: fs / L };
}

export interface WaveletResult extends TimeFrequency {
  /** Instantaneous phase arg W(t, f₀), same layout as power. */
  phase: Float64Array;
  /** Cone-of-influence half-width per frequency (s): estimates closer than this to an edge are unreliable. */
  coi: Float64Array;
  nCycles: number;
}

/**
 * Complex Morlet transform via the frequency domain. The Gaussian is centred on f₀ with σ_f = f₀ / n_cycles and
 * scaled so that a sinusoid of amplitude A at f₀ yields |W| = A (power = A²). σ_t = 1 / (2π σ_f).
 */
export function morletTransform(x: ArrayLike<number>, fs: number, freqs: ArrayLike<number>, nCycles = 7, decimate = 1): WaveletResult {
  const n = x.length, nfft = nextPow2(2 * n);
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n || 1;
  for (let i = 0; i < n; i++) re[i] = x[i]! - mean;
  fftInPlace(re, im);
  const d = Math.max(1, Math.round(decimate));
  const cols = Math.ceil(n / d), rows = freqs.length;
  const power = new Float64Array(rows * cols), phase = new Float64Array(rows * cols), coi = new Float64Array(rows);
  const wr = new Float64Array(nfft), wi = new Float64Array(nfft);
  for (let r = 0; r < rows; r++) {
    const f0 = freqs[r]!, sf = f0 / nCycles;
    wr.fill(0); wi.fill(0);
    // Analytic wavelet: positive frequencies only, factor 2 restores the full amplitude.
    for (let k = 0; k <= nfft / 2; k++) {
      const g = 2 * Math.exp(-((((k * fs) / nfft - f0) ** 2) / (2 * sf * sf)));
      if (g < 1e-12) continue;
      wr[k] = re[k]! * g; wi[k] = im[k]! * g;
    }
    fftInPlace(wr, wi, true);
    for (let c = 0; c < cols; c++) {
      const i = c * d;
      power[r * cols + c] = wr[i]! * wr[i]! + wi[i]! * wi[i]!;
      phase[r * cols + c] = Math.atan2(wi[i]!, wr[i]!);
    }
    coi[r] = Math.SQRT2 / (2 * Math.PI * sf);
  }
  const times = Float64Array.from({ length: cols }, (_, c) => (c * d) / fs);
  return { times, freqs: Float64Array.from(freqs), power, phase, coi, rows, cols, nCycles, deltaT: 0, deltaF: 0 };
}

/** Analytic signal x + i·H{x} via the FFT; returns instantaneous amplitude and phase. */
export function analyticSignal(x: ArrayLike<number>): { re: Float64Array; im: Float64Array; amplitude: Float64Array; phase: Float64Array } {
  const n = x.length, nfft = nextPow2(n);
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  for (let i = 0; i < n; i++) re[i] = x[i]!;
  fftInPlace(re, im);
  for (let k = 1; k < nfft / 2; k++) { re[k] = re[k]! * 2; im[k] = im[k]! * 2; }
  for (let k = nfft / 2 + 1; k < nfft; k++) { re[k] = 0; im[k] = 0; }
  fftInPlace(re, im, true);
  const r = re.slice(0, n), q = im.slice(0, n);
  return { re: r, im: q, amplitude: Float64Array.from(r, (v, i) => Math.hypot(v, q[i]!)), phase: Float64Array.from(r, (v, i) => Math.atan2(q[i]!, v)) };
}

export interface ErpResult {
  /** Time relative to the trigger (ms). */
  time: Float64Array;
  mean: Float64Array;
  sem: Float64Array;
  trials: number;
  rejected: number;
}

/**
 * Event-related potential: baseline-corrected average over trials with the standard error of the mean.
 * Triggers too close to the record edges, or trials exceeding `rejectAbove`, are dropped and counted.
 */
export function erpAverage(x: ArrayLike<number>, fs: number, triggerSamples: ArrayLike<number>, preMs: number, postMs: number, baselineMs?: [number, number], rejectAbove = Infinity): ErpResult {
  const pre = Math.round((preMs * fs) / 1000), post = Math.round((postMs * fs) / 1000), len = pre + post + 1;
  const b0 = Math.max(0, Math.round((((baselineMs?.[0] ?? -preMs) + preMs) * fs) / 1000)), b1 = Math.min(len - 1, Math.round((((baselineMs?.[1] ?? 0) + preMs) * fs) / 1000));
  const sum = new Float64Array(len), sum2 = new Float64Array(len);
  let trials = 0, rejected = 0;
  const seg = new Float64Array(len);
  for (let t = 0; t < triggerSamples.length; t++) {
    const s = Math.round(triggerSamples[t]!);
    if (s - pre < 0 || s + post >= x.length) { rejected++; continue; }
    let base = 0;
    for (let i = b0; i <= b1; i++) base += x[s - pre + i]!;
    base /= b1 - b0 + 1;
    let bad = false;
    for (let i = 0; i < len; i++) { seg[i] = x[s - pre + i]! - base; if (Math.abs(seg[i]!) > rejectAbove) bad = true; }
    if (bad) { rejected++; continue; }
    for (let i = 0; i < len; i++) { sum[i] = sum[i]! + seg[i]!; sum2[i] = sum2[i]! + seg[i]! * seg[i]!; }
    trials++;
  }
  const mean = new Float64Array(len), sem = new Float64Array(len), time = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    time[i] = ((i - pre) * 1000) / fs;
    if (!trials) continue;
    mean[i] = sum[i]! / trials;
    const v = trials > 1 ? Math.max(0, (sum2[i]! - trials * mean[i]! * mean[i]!) / (trials - 1)) : 0;
    sem[i] = Math.sqrt(v / trials);
  }
  return { time, mean, sem, trials, rejected };
}
