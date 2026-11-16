// ANALYTIC-001 zero-phase Butterworth IIR, ANALYTIC-002 windowed-sinc FIR, ANALYTIC-008 preprocessing pipeline.
// Definitions: docs/08-neural-data-and-analytics/SIGNAL_ANALYTICS.md §2.1.
import { makeWindow, type WindowKind } from './fft';

export type FilterKind = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Quality factors of the second-order sections of an order-N Butterworth filter (N even). */
function butterworthQs(order: number): number[] {
  const qs: number[] = [];
  for (let k = 0; k < order / 2; k++) qs.push(1 / (2 * Math.cos((Math.PI * (2 * k + 1)) / (2 * order))));
  return qs;
}

function section(kind: 'lowpass' | 'highpass' | 'notch', fc: number, fs: number, Q: number): Biquad {
  // Bilinear-transform biquads with frequency pre-warping (exact Butterworth sections for the listed Q values).
  const w0 = (2 * Math.PI * fc) / fs, c = Math.cos(w0), alpha = Math.sin(w0) / (2 * Q), a0 = 1 + alpha;
  if (kind === 'lowpass') return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
  if (kind === 'highpass') return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
  return { b0: 1 / a0, b1: (-2 * c) / a0, b2: 1 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
}

export interface FilterSpec {
  kind: FilterKind;
  /** Cutoff (lowpass/highpass), lower edge (bandpass) or centre (notch) in Hz. */
  f1: number;
  /** Upper edge for bandpass. */
  f2?: number;
  /** Butterworth order per pass: 2 or 4. */
  order?: 2 | 4;
  /** Notch quality factor (centre / bandwidth). */
  notchQ?: number;
}

export function designButterworth(spec: FilterSpec, fs: number): Biquad[] {
  const order = spec.order ?? 4, nyq = fs / 2;
  const check = (f: number) => { if (!(f > 0 && f < nyq)) throw new Error(`Cutoff ${f} Hz must lie between 0 and the Nyquist frequency ${nyq} Hz.`); };
  check(spec.f1);
  const qs = butterworthQs(order);
  switch (spec.kind) {
    case 'lowpass': return qs.map((q) => section('lowpass', spec.f1, fs, q));
    case 'highpass': return qs.map((q) => section('highpass', spec.f1, fs, q));
    case 'bandpass': {
      if (spec.f2 === undefined) throw new Error('Band-pass filters need an upper edge f2.');
      check(spec.f2);
      if (spec.f2 <= spec.f1) throw new Error('Band-pass upper edge must exceed the lower edge.');
      // Cascade of a high-pass at f1 and a low-pass at f2 (each of the requested order).
      return [...qs.map((q) => section('highpass', spec.f1, fs, q)), ...qs.map((q) => section('lowpass', spec.f2!, fs, q))];
    }
    case 'notch': return [section('notch', spec.f1, fs, spec.notchQ ?? 30)];
  }
}

function runSections(x: Float64Array, sos: Biquad[]): Float64Array {
  let y = x;
  for (const s of sos) {
    const out = new Float64Array(y.length);
    // Transposed direct form II, initialised at the steady state of the first sample to limit start-up transients.
    const x0 = y[0] ?? 0;
    const gain = (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2);
    let z1 = x0 * (gain - s.b0), z2 = x0 * (s.b2 - s.a2 * gain);
    for (let i = 0; i < y.length; i++) {
      const v = y[i]!;
      const o = s.b0 * v + z1;
      z1 = s.b1 * v - s.a1 * o + z2;
      z2 = s.b2 * v - s.a2 * o;
      out[i] = o;
    }
    y = out;
  }
  return y;
}

/** Zero-phase forward–backward filtering with odd-reflection padding (suppresses edge transients). */
export function filtfilt(x: ArrayLike<number>, sos: Biquad[], padLength?: number): Float64Array {
  const n = x.length;
  if (n < 4) return Float64Array.from(x);
  const pad = Math.min(n - 1, padLength ?? Math.min(n - 1, 3 * 64));
  const ext = new Float64Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) { ext[i] = 2 * x[0]! - x[pad - i]!; ext[pad + n + i] = 2 * x[n - 1]! - x[n - 2 - i]!; }
  for (let i = 0; i < n; i++) ext[pad + i] = x[i]!;
  const fwd = runSections(ext, sos);
  fwd.reverse();
  const bwd = runSections(fwd, sos);
  bwd.reverse();
  return bwd.slice(pad, pad + n);
}

export function butterworthFilter(x: ArrayLike<number>, fs: number, spec: FilterSpec): Float64Array {
  return filtfilt(x, designButterworth(spec, fs));
}

/** Complex frequency response of a cascade at frequency f; returns magnitude and phase of a single pass. */
export function frequencyResponse(sos: Biquad[], f: number, fs: number): { magnitude: number; phase: number } {
  const w = (2 * Math.PI * f) / fs;
  let re = 1, im = 0;
  for (const s of sos) {
    const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = s.b0 + s.b1 * c1 + s.b2 * c2, ni = -(s.b1 * s1 + s.b2 * s2);
    const dr = 1 + s.a1 * c1 + s.a2 * c2, di = -(s.a1 * s1 + s.a2 * s2);
    const den = dr * dr + di * di;
    const hr = (nr * dr + ni * di) / den, hi = (ni * dr - nr * di) / den;
    const tr = re * hr - im * hi;
    im = re * hi + im * hr;
    re = tr;
  }
  return { magnitude: Math.hypot(re, im), phase: Math.atan2(im, re) };
}

/** Linear-phase windowed-sinc FIR taps (odd length, symmetric). */
export function designFir(spec: FilterSpec, fs: number, numTaps = 101, window: WindowKind = 'hamming'): Float64Array {
  const M = numTaps % 2 === 0 ? numTaps + 1 : numTaps, mid = (M - 1) / 2;
  const w = makeWindow(window, M);
  const lowpass = (fc: number) => {
    const h = new Float64Array(M), fn = fc / fs;
    let sum = 0;
    for (let i = 0; i < M; i++) {
      const k = i - mid;
      h[i] = (k === 0 ? 2 * fn : Math.sin(2 * Math.PI * fn * k) / (Math.PI * k)) * w[i]!;
      sum += h[i]!;
    }
    for (let i = 0; i < M; i++) h[i] = h[i]! / sum;
    return h;
  };
  const invert = (h: Float64Array) => { const o = Float64Array.from(h, (v) => -v); o[mid] = o[mid]! + 1; return o; };
  switch (spec.kind) {
    case 'lowpass': return lowpass(spec.f1);
    case 'highpass': return invert(lowpass(spec.f1));
    case 'bandpass': {
      if (spec.f2 === undefined || spec.f2 <= spec.f1) throw new Error('Band-pass filters need f2 > f1.');
      const hi = lowpass(spec.f2), lo = lowpass(spec.f1);
      return Float64Array.from(hi, (v, i) => v - lo[i]!);
    }
    case 'notch': {
      const half = spec.f1 / (2 * (spec.notchQ ?? 10));
      const hi = lowpass(spec.f1 + half), lo = lowpass(Math.max(1e-6, spec.f1 - half));
      return invert(Float64Array.from(hi, (v, i) => v - lo[i]!));
    }
  }
}

/** FIR convolution y[n] = Σ b_k x[n − k], compensated for the (M − 1)/2 group delay; edges use reflection. */
export function firFilter(x: ArrayLike<number>, taps: Float64Array): Float64Array {
  const n = x.length, M = taps.length, mid = (M - 1) / 2;
  const out = new Float64Array(n);
  const at = (i: number) => (i < 0 ? x[Math.min(n - 1, -i)]! : i >= n ? x[Math.max(0, 2 * n - 2 - i)]! : x[i]!);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < M; k++) s += taps[k]! * at(i + mid - k);
    out[i] = s;
  }
  return out;
}

// ── ANALYTIC-008 preprocessing ────────────────────────────────────────────────

export function demean(x: ArrayLike<number>): Float64Array {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i]!;
  m /= x.length || 1;
  return Float64Array.from(x, (v) => v - m);
}

export function detrendLinear(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  if (n < 2) return Float64Array.from(x);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += x[i]!; sxx += i * i; sxy += i * x[i]!; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  return Float64Array.from(x, (v, i) => v - (icpt + slope * i));
}

export function zscore(x: ArrayLike<number>): Float64Array {
  const d = demean(x);
  let v = 0;
  for (let i = 0; i < d.length; i++) v += d[i]! * d[i]!;
  const sd = Math.sqrt(v / Math.max(1, d.length - 1));
  return sd > 0 ? d.map((q) => q / sd) : d;
}

/** Common average reference: subtracts the instantaneous mean across channels from every channel. */
export function commonAverageReference(channels: ArrayLike<number>[]): Float64Array[] {
  const c = channels.length, n = channels[0]?.length ?? 0;
  const out = channels.map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let k = 0; k < c; k++) m += channels[k]![i]!;
    m /= c || 1;
    for (let k = 0; k < c; k++) out[k]![i] = channels[k]![i]! - m;
  }
  return out;
}

export interface ArtifactReport { mask: Uint8Array; rejectedSamples: number; rejectedFraction: number; segments: [number, number][] }

/** Amplitude-threshold artifact detection (default |x| > 150 in signal units), with a guard margin around each hit. */
export function detectArtifacts(x: ArrayLike<number>, threshold = 150, guardSamples = 0): ArtifactReport {
  const n = x.length, mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (Math.abs(x[i]!) > threshold) for (let k = Math.max(0, i - guardSamples); k <= Math.min(n - 1, i + guardSamples); k++) mask[k] = 1;
  const segments: [number, number][] = [];
  let rejected = 0, start = -1;
  for (let i = 0; i <= n; i++) {
    const bad = i < n && mask[i] === 1;
    if (bad) { rejected++; if (start < 0) start = i; }
    else if (start >= 0) { segments.push([start, i - 1]); start = -1; }
  }
  return { mask, rejectedSamples: rejected, rejectedFraction: n ? rejected / n : 0, segments };
}
