// ANALYTIC-003 Discrete Fourier Transform (radix-2 FFT) and ANALYTIC-004 Welch PSD.
// Definitions: docs/08-neural-data-and-analytics/SIGNAL_ANALYTICS.md §2.2.

export type WindowKind = 'hann' | 'hamming' | 'rect';

export function makeWindow(kind: WindowKind, n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (kind === 'rect' || n === 1) w[i] = 1;
    else if (kind === 'hann') w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    else w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

export const nextPow2 = (n: number) => {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
};

/** In-place iterative radix-2 Cooley–Tukey FFT. Length must be a power of two. `inverse` applies the 1/N scale. */
export function fftInPlace(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error('FFT length must be a power of two');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr;
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi;
        re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] = re[i]! / n; im[i] = im[i]! / n; }
}

export interface Spectrum {
  /** Frequencies f_k = k fs / N for k = 0 … N/2 (Hz). */
  freq: Float64Array;
  /** Single-sided amplitude spectrum in signal units. */
  amplitude: Float64Array;
  /** Phase in radians. */
  phase: Float64Array;
  nfft: number;
}

/** Windowed single-sided amplitude spectrum (zero-padded to a power of two). */
export function amplitudeSpectrum(x: ArrayLike<number>, fs: number, window: WindowKind = 'hann'): Spectrum {
  const n = x.length;
  const nfft = nextPow2(n);
  const w = makeWindow(window, n);
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  let mean = 0, wsum = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n || 1;
  for (let i = 0; i < n; i++) { re[i] = (x[i]! - mean) * w[i]!; wsum += w[i]!; }
  fftInPlace(re, im);
  const half = nfft / 2;
  const freq = new Float64Array(half + 1), amplitude = new Float64Array(half + 1), phase = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    freq[k] = (k * fs) / nfft;
    const mag = Math.hypot(re[k]!, im[k]!);
    amplitude[k] = ((k === 0 || k === half ? 1 : 2) * mag) / (wsum || 1);
    phase[k] = Math.atan2(im[k]!, re[k]!);
  }
  return { freq, amplitude, phase, nfft };
}

export interface Psd {
  freq: Float64Array;
  /** One-sided power spectral density in unit²/Hz. */
  power: Float64Array;
  segments: number;
  segmentLength: number;
  resolutionHz: number;
}

/**
 * Welch averaged modified periodogram (EQ-ANA-WELCH): P(f_k) = 1/(K fs L U) Σ_m |Σ_n w[n] x_m[n] e^{-j2πkn/L}|²,
 * doubled for the one-sided spectrum. Each segment is mean-detrended.
 */
export function welchPsd(x: ArrayLike<number>, fs: number, segmentLength?: number, overlap = 0.5, window: WindowKind = 'hann'): Psd {
  const n = x.length;
  // Segment length: a power of two no longer than the signal (default: about a quarter of the record).
  const prevPow2 = (v: number) => { let q = 1; while (q * 2 <= v) q *= 2; return q; };
  const L = Math.max(2, prevPow2(Math.min(n, segmentLength ?? Math.max(16, Math.floor(n / 4)))));
  const step = Math.max(1, Math.floor(L * (1 - overlap)));
  const w = makeWindow(window, L);
  let U = 0;
  for (let i = 0; i < L; i++) U += w[i]! * w[i]!;
  U /= L;
  const half = L / 2;
  const power = new Float64Array(half + 1);
  const re = new Float64Array(L), im = new Float64Array(L);
  let K = 0;
  for (let start = 0; start + L <= n; start += step) {
    let mean = 0;
    for (let i = 0; i < L; i++) mean += x[start + i]!;
    mean /= L;
    for (let i = 0; i < L; i++) { re[i] = (x[start + i]! - mean) * w[i]!; im[i] = 0; }
    fftInPlace(re, im);
    for (let k = 0; k <= half; k++) power[k] = power[k]! + re[k]! * re[k]! + im[k]! * im[k]!;
    K++;
  }
  const freq = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    freq[k] = (k * fs) / L;
    power[k] = K ? ((k === 0 || k === half ? 1 : 2) * power[k]!) / (K * fs * L * U) : 0;
  }
  return { freq, power, segments: K, segmentLength: L, resolutionHz: fs / L };
}

export const CANONICAL_BANDS: { key: string; label: string; lo: number; hi: number }[] = [
  { key: 'delta', label: 'δ 0.5–4 Hz', lo: 0.5, hi: 4 },
  { key: 'theta', label: 'θ 4–8 Hz', lo: 4, hi: 8 },
  { key: 'alpha', label: 'α 8–12 Hz', lo: 8, hi: 12 },
  { key: 'beta', label: 'β 13–30 Hz', lo: 13, hi: 30 },
  { key: 'gamma', label: 'γ 30–80 Hz', lo: 30, hi: 80 },
];

/** Trapezoidal integration of the PSD over [lo, hi] (unit²). */
export function bandPower(psd: Psd, lo: number, hi: number): number {
  let p = 0;
  for (let k = 1; k < psd.freq.length; k++) {
    const f0 = psd.freq[k - 1]!, f1 = psd.freq[k]!;
    if (f1 < lo || f0 > hi) continue;
    p += 0.5 * (psd.power[k - 1]! + psd.power[k]!) * (Math.min(f1, hi) - Math.max(f0, lo));
  }
  return p;
}

/** Frequency of the largest PSD value within [lo, hi]. */
export function peakFrequency(psd: Psd, lo = 0, hi = Infinity): number {
  let best = -Infinity, f = NaN;
  for (let k = 0; k < psd.freq.length; k++) {
    const fk = psd.freq[k]!;
    if (fk < lo || fk > hi) continue;
    if (psd.power[k]! > best) { best = psd.power[k]!; f = fk; }
  }
  return f;
}
