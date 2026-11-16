// Output recording helpers: decimated trace storage (SIMULATION_AND_WORKER_ARCHITECTURE §4) and shared spike metrics.
import type { Curve, ModelOutput, ParamSpec, RunConfig } from './types';
import { SimulationError } from './types';

export const MAX_TRACE_POINTS = 20000;

export interface Recorder {
  stride: number;
  n: number;
  t: Float64Array;
  s: Record<string, Float64Array>;
  /** Number of samples actually written (for truncation on divergence). */
  written: number;
}

export function makeRecorder(keys: string[], nSteps: number, maxPoints = MAX_TRACE_POINTS): Recorder {
  const stride = Math.max(1, Math.ceil((nSteps + 1) / maxPoints));
  const n = Math.floor(nSteps / stride) + 1;
  const s: Record<string, Float64Array> = {};
  for (const k of keys) s[k] = new Float64Array(n);
  return { stride, n, t: new Float64Array(n), s, written: 0 };
}

/** Truncates all recorded arrays to the samples written so far. */
export function finishRecorder(rec: Recorder): { t: Float64Array; series: Record<string, Float64Array> } {
  if (rec.written >= rec.n) return { t: rec.t, series: rec.s };
  const series: Record<string, Float64Array> = {};
  for (const [k, v] of Object.entries(rec.s)) series[k] = v.slice(0, rec.written);
  return { t: rec.t.slice(0, rec.written), series };
}

export function emptyOutput(): ModelOutput {
  return { t: new Float64Array(0), series: {}, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
}

export function diverged(v: number): boolean {
  return !Number.isFinite(v) || Math.abs(v) > 1e4;
}

export function stepCount(cfg: RunConfig): number {
  if (!(cfg.dtMs > 0) || !(cfg.durationMs > 0)) throw new SimulationError('ERR_INVALID_PARAMS', 'Time step and duration must be positive.');
  const n = Math.round(cfg.durationMs / cfg.dtMs);
  if (n > 5_000_000) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', `Requested ${n.toLocaleString()} solver steps exceeds the 5,000,000-step browser envelope. Increase dt or shorten the run.`);
  return n;
}

/** Reads a parameter with its documented default as fallback. */
export function paramReader(specs: ParamSpec[], values: Record<string, number>): (key: string) => number {
  const defaults = new Map(specs.map((s) => [s.key, s.default]));
  return (key) => {
    const v = values[key];
    if (v !== undefined && Number.isFinite(v)) return v;
    const d = defaults.get(key);
    if (d === undefined) throw new SimulationError('ERR_INVALID_PARAMS', `Unknown parameter ${key}`);
    return d;
  };
}

export interface SpikeMetrics {
  spikeCount: number;
  firingRateHz: number;
  meanIsiMs: number;
  cvIsi: number;
  firstSpikeLatencyMs: number;
  adaptationRatio: number;
}

/** Spike-train summary statistics. Firing rate is 1000 / mean ISI when ≥ 2 spikes exist (steady-state estimate). */
export function spikeMetrics(times: ArrayLike<number>, stimulusOnsetMs: number, windowMs: number): SpikeMetrics {
  const n = times.length;
  if (n === 0) return { spikeCount: 0, firingRateHz: 0, meanIsiMs: NaN, cvIsi: NaN, firstSpikeLatencyMs: NaN, adaptationRatio: NaN };
  const latency = times[0]! - stimulusOnsetMs;
  if (n === 1) return { spikeCount: 1, firingRateHz: 1000 / windowMs, meanIsiMs: NaN, cvIsi: NaN, firstSpikeLatencyMs: latency, adaptationRatio: NaN };
  let sum = 0;
  for (let i = 1; i < n; i++) sum += times[i]! - times[i - 1]!;
  const mean = sum / (n - 1);
  let varSum = 0;
  for (let i = 1; i < n; i++) varSum += (times[i]! - times[i - 1]! - mean) ** 2;
  const sd = n > 2 ? Math.sqrt(varSum / (n - 2)) : 0;
  const first = times[1]! - times[0]!;
  const last = times[n - 1]! - times[n - 2]!;
  return { spikeCount: n, firingRateHz: 1000 / mean, meanIsiMs: mean, cvIsi: sd / mean, firstSpikeLatencyMs: latency, adaptationRatio: last / first };
}

export function linspace(a: number, b: number, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = n === 1 ? a : a + ((b - a) * i) / (n - 1);
  return out;
}

export function curveFrom(x: ArrayLike<number>, f: (x: number) => number): Curve {
  const xs = Float64Array.from(x);
  const ys = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) ys[i] = f(xs[i]!);
  return { x: xs, y: ys };
}

export function maxOf(a: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i]! > m) m = a[i]!;
  return m;
}
export function minOf(a: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0; i < a.length; i++) if (a[i]! < m) m = a[i]!;
  return m;
}
export function meanOf(a: ArrayLike<number>, from = 0, to = a.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i]!;
  return to > from ? s / (to - from) : NaN;
}
