// Experiment drivers shared by the simulation worker and the unit tests: parameter sweeps, one-at-a-time
// sensitivity analysis and multi-seed ensembles (EXPERIMENT_FRAMEWORK_AND_REPRODUCIBILITY §2).
import type { ModelDefinition, RunConfig } from '../core/types';

/** Sets a sweepable field: a parameter key, `stimulus.<field>`, `initial.<key>`, `dtMs`, `durationMs` or `seed`. */
export function applyField(cfg: RunConfig, key: string, value: number): RunConfig {
  if (key === 'dtMs' || key === 'durationMs' || key === 'seed') return { ...cfg, [key]: value };
  if (key.startsWith('stimulus.')) return { ...cfg, stimulus: { ...cfg.stimulus, [key.slice(9)]: value } };
  if (key.startsWith('initial.')) return { ...cfg, initial: { ...cfg.initial, [key.slice(8)]: value } };
  return { ...cfg, params: { ...cfg.params, [key]: value } };
}

export function readField(cfg: RunConfig, key: string): number {
  if (key === 'dtMs' || key === 'durationMs' || key === 'seed') return cfg[key];
  if (key.startsWith('stimulus.')) return Number((cfg.stimulus as unknown as Record<string, unknown>)[key.slice(9)]);
  if (key.startsWith('initial.')) return cfg.initial[key.slice(8)] ?? NaN;
  return cfg.params[key] ?? NaN;
}

export interface SweepableField { key: string; label: string; unit: string; min: number; max: number }

export function sweepableFields(model: ModelDefinition): SweepableField[] {
  const out: SweepableField[] = model.params.filter((p) => !p.options).map((p) => ({ key: p.key, label: p.label, unit: p.unit, min: p.min, max: p.max }));
  if (model.stimulus) out.unshift({ key: 'stimulus.amplitude', label: `${model.stimulus.label} (amplitude)`, unit: model.stimulus.unit, min: model.stimulus.amplitudeRange[0], max: model.stimulus.amplitudeRange[1] });
  return out;
}

export interface SweepResult {
  paramKey: string;
  values: Float64Array;
  /** One array per metric key, aligned with `values`. */
  metrics: Record<string, Float64Array>;
  statuses: string[];
}

export function runSweep(model: ModelDefinition, base: RunConfig, paramKey: string, values: ArrayLike<number>, onProgress?: (f: number) => void): SweepResult {
  const n = values.length;
  const metrics: Record<string, Float64Array> = {};
  const statuses: string[] = [];
  for (let i = 0; i < n; i++) {
    const out = model.run(applyField(base, paramKey, values[i]!));
    statuses.push(out.status);
    for (const [k, v] of Object.entries(out.metrics)) (metrics[k] ??= new Float64Array(n).fill(NaN))[i] = v;
    onProgress?.((i + 1) / n);
  }
  return { paramKey, values: Float64Array.from(values), metrics, statuses };
}

export interface Sweep2DResult { keyX: string; keyY: string; x: Float64Array; y: Float64Array; metricKey: string; /** rows = y, cols = x */ grid: Float64Array }

export function runSweep2D(model: ModelDefinition, base: RunConfig, keyX: string, xs: ArrayLike<number>, keyY: string, ys: ArrayLike<number>, metricKey: string, onProgress?: (f: number) => void): Sweep2DResult {
  const grid = new Float64Array(xs.length * ys.length);
  let done = 0;
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const out = model.run(applyField(applyField(base, keyX, xs[i]!), keyY, ys[j]!));
    grid[j * xs.length + i] = out.metrics[metricKey] ?? NaN;
    onProgress?.(++done / grid.length);
  }
  return { keyX, keyY, x: Float64Array.from(xs), y: Float64Array.from(ys), metricKey, grid };
}

export interface SensitivityRow { key: string; label: string; unit: string; base: number; index: number; plus: number; minus: number }

/**
 * Local one-at-a-time sensitivity (MODEL_VALIDATION §4): S = (p₀ / M(p₀)) · [M(p₀ + Δ) − M(p₀ − Δ)] / (2Δ), Δ = 5% of p₀.
 * Parameters equal to zero, categorical parameters and integer counts are skipped.
 */
export function runSensitivity(model: ModelDefinition, base: RunConfig, metricKey: string, onProgress?: (f: number) => void): { metricKey: string; baseline: number; rows: SensitivityRow[] } {
  const baseline = model.run(base).metrics[metricKey] ?? NaN;
  const fields = sweepableFields(model).filter((f) => { const p = model.params.find((q) => q.key === f.key); return !(p?.integer); });
  const rows: SensitivityRow[] = [];
  fields.forEach((f, i) => {
    const p0 = readField(base, f.key);
    if (Number.isFinite(p0) && p0 !== 0) {
      const d = 0.05 * Math.abs(p0);
      const plus = model.run(applyField(base, f.key, p0 + d)).metrics[metricKey] ?? NaN;
      const minus = model.run(applyField(base, f.key, p0 - d)).metrics[metricKey] ?? NaN;
      rows.push({ key: f.key, label: f.label, unit: f.unit, base: p0, plus, minus, index: baseline !== 0 ? (p0 / baseline) * ((plus - minus) / (2 * d)) : NaN });
    }
    onProgress?.((i + 1) / fields.length);
  });
  rows.sort((a, b) => (Number.isFinite(b.index) ? Math.abs(b.index) : -1) - (Number.isFinite(a.index) ? Math.abs(a.index) : -1));
  return { metricKey, baseline, rows };
}

export interface EnsembleResult { seeds: number[]; metrics: Record<string, Float64Array>; mean: Record<string, number>; sd: Record<string, number> }

/** Multi-seed stochastic ensemble: identical configuration, different PRNG seeds. */
export function runEnsemble(model: ModelDefinition, base: RunConfig, seeds: number[], onProgress?: (f: number) => void): EnsembleResult {
  const metrics: Record<string, Float64Array> = {};
  seeds.forEach((seed, i) => {
    const out = model.run({ ...base, seed });
    for (const [k, v] of Object.entries(out.metrics)) (metrics[k] ??= new Float64Array(seeds.length).fill(NaN))[i] = v;
    onProgress?.((i + 1) / seeds.length);
  });
  const mean: Record<string, number> = {}, sd: Record<string, number> = {};
  for (const [k, a] of Object.entries(metrics)) {
    const ok = Array.from(a).filter(Number.isFinite);
    const m = ok.reduce((s, v) => s + v, 0) / (ok.length || 1);
    mean[k] = ok.length ? m : NaN;
    sd[k] = ok.length > 1 ? Math.sqrt(ok.reduce((s, v) => s + (v - m) ** 2, 0) / (ok.length - 1)) : NaN;
  }
  return { seeds, metrics, mean, sd };
}

export const linspaceValues = (from: number, to: number, steps: number) => Array.from({ length: Math.max(2, steps) }, (_, i) => from + ((to - from) * i) / (Math.max(2, steps) - 1));
