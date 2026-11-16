// Shared fixed-grid ODE run loop: solver dispatch, decimated recording, spike detection on a state
// variable (linear threshold interpolation), progress reporting and the runtime divergence trap.
import { createEuler, createRk4, createRk45, type Deriv } from '../solvers/ode';
import { diverged, finishRecorder, makeRecorder, stepCount } from './record';
import type { RunConfig, RunContext, SolverId } from './types';
import { SimulationError } from './types';

export interface OdeRunSpec {
  cfg: RunConfig;
  ctx?: RunContext | undefined;
  y0: Float64Array;
  deriv: Deriv;
  /** Model-specific step (e.g. Rush–Larsen) used when the selected solver is not a generic one. */
  customStep?: (t: number, y: Float64Array, h: number) => void;
  recordKeys: string[];
  /** Writes the recorded quantities for sample j. */
  record: (j: number, t: number, y: Float64Array, s: Record<string, Float64Array>) => void;
  /** Upward-crossing spike detection on y[index]. */
  spike?: { index: number; threshold: number; rearm: number };
  /** Index of the variable monitored by the divergence trap. */
  watch?: number;
  /** Projects the state back onto its admissible set after every step (hard bounds such as w ∈ [0, w_max]). */
  project?: (y: Float64Array) => void;
  /** Converts solver time (ms) to the model's internal time argument; defaults to identity. */
  maxPoints?: number;
}

export interface OdeRunResult {
  t: Float64Array;
  series: Record<string, Float64Array>;
  spikeTimes: number[];
  status: 'COMPLETED' | 'DIVERGED';
  failedAtMs?: number;
  nSteps: number;
  yFinal: Float64Array;
}

const GENERIC: SolverId[] = ['SOLVER-FE', 'SOLVER-RK4', 'SOLVER-RK45'];

export function runOde(spec: OdeRunSpec): OdeRunResult {
  const { cfg, ctx, deriv } = spec;
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const n = spec.y0.length;
  const y = Float64Array.from(spec.y0);
  const rec = makeRecorder(spec.recordKeys, nSteps, spec.maxPoints);
  const watch = spec.watch ?? 0;

  let step: (t: number, y: Float64Array, h: number) => void;
  if (cfg.solver === 'SOLVER-RK4') {
    const s = createRk4(n);
    step = (t, yy, h) => s.step(deriv, t, yy, h);
  } else if (cfg.solver === 'SOLVER-FE') {
    const s = createEuler(n);
    step = (t, yy, h) => s.step(deriv, t, yy, h);
  } else if (cfg.solver === 'SOLVER-RK45') {
    const s = createRk45(n, dt);
    step = (t, yy, h) => {
      s.advance(deriv, t, t + h, yy);
    };
  } else if (spec.customStep) {
    step = spec.customStep;
  } else {
    throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by this model (generic solvers: ${GENERIC.join(', ')}).`);
  }

  const spikeTimes: number[] = [];
  let armed = true;
  let status: 'COMPLETED' | 'DIVERGED' = 'COMPLETED';
  let failedAtMs: number | undefined;
  const progressEvery = Math.max(1, Math.floor(nSteps / 50));

  spec.record(0, 0, y, rec.s);
  rec.t[0] = 0;
  rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const prev = spec.spike ? y[spec.spike.index]! : 0;
    try {
      step(t, y, dt);
    } catch {
      status = 'DIVERGED';
      failedAtMs = t;
      break;
    }
    spec.project?.(y);
    if (diverged(y[watch]!)) {
      status = 'DIVERGED';
      failedAtMs = t + dt;
      break;
    }
    if (spec.spike) {
      const cur = y[spec.spike.index]!;
      const { threshold, rearm } = spec.spike;
      if (armed && prev < threshold && cur >= threshold) {
        spikeTimes.push(t + (dt * (threshold - prev)) / (cur - prev));
        armed = false;
      } else if (!armed && cur < rearm) {
        armed = true;
      }
    }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) {
        rec.t[j] = k * dt;
        spec.record(j, k * dt, y, rec.s);
        rec.written = j + 1;
      }
    }
    if (ctx?.onProgress && k % progressEvery === 0) ctx.onProgress(k / nSteps);
  }
  const out = finishRecorder(rec);
  const result: OdeRunResult = { t: out.t, series: out.series, spikeTimes, status, nSteps, yFinal: y };
  if (failedAtMs !== undefined) result.failedAtMs = failedAtMs;
  return result;
}

export const DIVERGENCE_NOTE =
  'ERR_NUMERICAL_DIVERGENCE: integration halted because the state became non-finite or exceeded |V| > 10⁴. Reduce dt or switch to SOLVER-RK4 / SOLVER-RUSH-LARSEN.';
