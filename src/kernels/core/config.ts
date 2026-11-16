// Run-configuration helpers shared by the laboratory UI, the simulation worker and the test suites.
import { DEFAULT_STIMULUS, type ModelDefinition, type Preset, type RunConfig, type StimulusConfig } from './types';

/** Default PRNG seed (registry experiments use 42). */
export const DEFAULT_SEED = 42;
export const MAX_SOLVER_STEPS = 5_000_000;

export function defaultStimulus(model: ModelDefinition): StimulusConfig {
  return { ...DEFAULT_STIMULUS, ...(model.stimulus ? model.stimulus.default : { kind: 'none' as const }) };
}

/** Documented defaults of a model: registry/kernel parameter defaults, initial conditions, solver and step. */
export function defaultConfig(model: ModelDefinition): RunConfig {
  return {
    params: Object.fromEntries(model.params.map((p) => [p.key, p.default])),
    initial: Object.fromEntries(model.initial.map((i) => [i.key, i.default])),
    stimulus: defaultStimulus(model),
    solver: model.defaultSolver,
    dtMs: model.defaultDtMs,
    durationMs: model.defaultDurationMs,
    seed: DEFAULT_SEED,
  };
}

export interface ConfigOverrides {
  params?: Record<string, number>;
  initial?: Record<string, number>;
  stimulus?: Partial<StimulusConfig>;
  solver?: RunConfig['solver'];
  dtMs?: number;
  durationMs?: number;
  seed?: number;
}

/** Defaults with selected fields overridden. */
export function configWith(model: ModelDefinition, o: ConfigOverrides = {}): RunConfig {
  const c = defaultConfig(model);
  return {
    params: { ...c.params, ...o.params },
    initial: { ...c.initial, ...o.initial },
    stimulus: { ...c.stimulus, ...o.stimulus },
    solver: o.solver ?? c.solver,
    dtMs: o.dtMs ?? c.dtMs,
    durationMs: o.durationMs ?? c.durationMs,
    seed: o.seed ?? c.seed,
  };
}

/** A preset always starts from the documented defaults, so applying it is independent of earlier edits. */
export function presetConfig(model: ModelDefinition, preset: Preset, seed = DEFAULT_SEED): RunConfig {
  const o: ConfigOverrides = { seed };
  if (preset.params) o.params = preset.params;
  if (preset.stimulus) o.stimulus = preset.stimulus;
  if (preset.durationMs !== undefined) o.durationMs = preset.durationMs;
  return configWith(model, o);
}

export interface ConfigIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

/** Validates a configuration against the model's documented bounds before it is sent to a worker. */
export function validateConfig(model: ModelDefinition, cfg: RunConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const unit = model.timeUnit ?? 'ms';
  for (const p of model.params) {
    const v = cfg.params[p.key];
    if (v === undefined) continue;
    if (!Number.isFinite(v)) issues.push({ field: p.key, severity: 'error', message: `${p.label} must be a finite number.` });
    else if (v < p.min || v > p.max) issues.push({ field: p.key, severity: 'error', message: `${p.label} must lie between ${p.min} and ${p.max}${p.unit ? ` ${p.unit}` : ''}.` });
    else if (p.integer && !Number.isInteger(v)) issues.push({ field: p.key, severity: 'error', message: `${p.label} must be a whole number.` });
  }
  for (const i of model.initial) {
    const v = cfg.initial[i.key];
    if (v !== undefined && !Number.isFinite(v)) issues.push({ field: i.key, severity: 'error', message: `${i.label} must be a finite number.` });
  }
  if (!model.solvers.includes(cfg.solver)) issues.push({ field: 'solver', severity: 'error', message: `${cfg.solver} is not supported by ${model.id}.` });
  if (!(cfg.dtMs > 0)) issues.push({ field: 'dtMs', severity: 'error', message: 'The time step must be positive.' });
  else if (cfg.dtMs < model.minDtMs) issues.push({ field: 'dtMs', severity: 'error', message: `The time step must be at least ${model.minDtMs} ${unit}.` });
  else if (cfg.dtMs > model.maxSafeDtMs) issues.push({ field: 'dtMs', severity: 'warning', message: `The time step exceeds the stability-tested limit of ${model.maxSafeDtMs} ${unit}; results may be inaccurate or diverge.` });
  if (!(cfg.durationMs > 0)) issues.push({ field: 'durationMs', severity: 'error', message: 'The duration must be positive.' });
  else if (cfg.durationMs > model.maxDurationMs) issues.push({ field: 'durationMs', severity: 'error', message: `The duration is limited to ${model.maxDurationMs} ${unit} in the browser.` });
  if (cfg.dtMs > 0 && cfg.durationMs > 0 && cfg.durationMs / cfg.dtMs > MAX_SOLVER_STEPS) issues.push({ field: 'dtMs', severity: 'error', message: `This run needs more than ${MAX_SOLVER_STEPS.toLocaleString()} solver steps; increase the time step or shorten the run.` });
  if (!Number.isFinite(cfg.seed)) issues.push({ field: 'seed', severity: 'error', message: 'The random seed must be a number.' });
  if (model.stimulus) {
    const [lo, hi] = model.stimulus.amplitudeRange;
    const a = cfg.stimulus.amplitude;
    if (!Number.isFinite(a)) issues.push({ field: 'stimulus.amplitude', severity: 'error', message: 'The stimulus amplitude must be a finite number.' });
    else if (a < lo || a > hi) issues.push({ field: 'stimulus.amplitude', severity: 'warning', message: `The stimulus amplitude is outside the documented range ${lo} to ${hi} ${model.stimulus.unit}.` });
    if (!model.stimulus.kinds.includes(cfg.stimulus.kind)) issues.push({ field: 'stimulus.kind', severity: 'error', message: `Stimulus waveform "${cfg.stimulus.kind}" is not available for ${model.id}.` });
  }
  return issues;
}

export const hasBlockingIssue = (issues: ConfigIssue[]) => issues.some((i) => i.severity === 'error');
