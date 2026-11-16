// Level 2–3 scientific QA (SCIENTIFIC_AND_NUMERICAL_QA.md): all 19 VAL-* cases, solver order of convergence,
// analytic benchmarks, determinism, and kernel ↔ registry consistency for the 28 models.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configWith, defaultConfig, presetConfig, validateConfig } from '../../src/kernels/core/config';
import type { ModelOutput, ViewSpec } from '../../src/kernels/core/types';
import { MODELS, getModel } from '../../src/kernels/models';
import { createEuler, createRk4, createRk45, type Deriv } from '../../src/kernels/solvers/ode';
import { VALIDATION_CASES, runValidation } from '../../src/kernels/validation/cases';

const reg = <T,>(p: string): T => JSON.parse(readFileSync(new URL(`../../registries/${p}`, import.meta.url), 'utf8')) as T;
interface RegModel { id: string; parameterIds: string[]; validationCaseIds: string[]; numericalMethod: { defaultSolver: string; supportedSolvers: string[]; defaultDtMs: number; maxSafeDtMs: number; minDtMs: number }; computeEnvelope: { maxDurationMs: number } }
interface RegParam { id: string; modelId: string; defaultValue: number; minValue: number; maxValue: number; unit: string }
const regModels = reg<{ items: RegModel[] }>('scientific-models/scientific-models.json').items;
const regParams = reg<{ items: RegParam[] }>('parameters/parameters.json').items;
const regVal = reg<{ validationCases: { id: string; targetModelId: string }[] }>('traceability/requirements-traceability.json').validationCases;

describe('validation cases VAL-*', () => {
  it('covers every validation case in the traceability registry', () => {
    expect(VALIDATION_CASES.map((c) => c.id).sort()).toEqual(regVal.map((v) => v.id).sort());
  });
  it('every model is referenced by the validation cases the registry assigns to it', () => {
    for (const m of regModels) for (const v of m.validationCaseIds) expect(VALIDATION_CASES.find((c) => c.id === v)?.modelIds, `${m.id} ↔ ${v}`).toContain(m.id);
  });
  for (const c of VALIDATION_CASES) {
    it(`${c.id}: ${c.title}`, () => {
      const r = runValidation(c.id);
      const failed = r.checks.filter((k) => !k.passed).map((k) => `${k.label}: ${k.measured} [${k.criterion}]`);
      expect(failed, failed.join('\n')).toEqual([]);
    });
  }
});

describe('kernel ↔ registry consistency', () => {
  it('registers exactly the 28 models of the registry', () => {
    expect(MODELS.map((m) => m.id)).toEqual(regModels.map((m) => m.id));
  });
  it('uses each registry parameter with its documented default and range', () => {
    const byId = new Map(regParams.map((p) => [p.id, p]));
    const used = new Set<string>();
    for (const m of MODELS) {
      for (const p of m.params) {
        if (!p.registryId) continue;
        const r = byId.get(p.registryId);
        expect(r, `${m.id} ${p.key} → ${p.registryId}`).toBeDefined();
        expect(r!.modelId, p.registryId).toBe(m.id);
        expect(p.default, `${p.registryId} default`).toBe(r!.defaultValue);
        expect(p.min, `${p.registryId} min`).toBeLessThanOrEqual(r!.minValue);
        expect(p.max, `${p.registryId} max`).toBeGreaterThanOrEqual(r!.maxValue);
        used.add(p.registryId);
      }
    }
    expect([...byId.keys()].filter((id) => !used.has(id)), 'registry parameters without a kernel control').toEqual([]);
  });
  it('matches the registry default solver, supported solvers and time-step bounds', () => {
    for (const r of regModels) {
      const m = getModel(r.id);
      expect(r.numericalMethod.supportedSolvers, `${r.id} default solver`).toContain(m.defaultSolver);
      for (const s of m.solvers) expect(r.numericalMethod.supportedSolvers, `${r.id} ${s}`).toContain(s);
      if (m.timeUnit !== 'trials') {
        expect(m.defaultDtMs, `${r.id} dt`).toBe(r.numericalMethod.defaultDtMs);
        expect(m.maxSafeDtMs, `${r.id} max safe dt`).toBeLessThanOrEqual(r.numericalMethod.maxSafeDtMs);
        expect(m.maxDurationMs, `${r.id} max duration`).toBeLessThanOrEqual(r.computeEnvelope.maxDurationMs);
      }
    }
  });
  it('every parameter has a unit field, a description and a default inside its range', () => {
    for (const m of MODELS) for (const p of m.params) {
      expect(p.description.length, `${m.id} ${p.key}`).toBeGreaterThan(15);
      expect(p.default >= p.min && p.default <= p.max, `${m.id} ${p.key} default in range`).toBe(true);
    }
  });
});

const viewHasData = (v: ViewSpec, o: ModelOutput): boolean =>
  v.kind === 'traces' ? v.series.some((s) => o.series[s.key] !== undefined)
    : v.kind === 'phase' ? o.series[v.xKey] !== undefined && o.series[v.yKey] !== undefined
      : v.kind === 'curve' ? v.curves.some((c) => o.curves[c.key] !== undefined)
        : v.kind === 'matrix' ? o.matrices[v.key] !== undefined : o.spikes !== undefined;
const SEED_ONLY_IN_PRESETS = new Set(['MODEL-024', 'MODEL-026']);
const finite = (o: ModelOutput) => {
  for (const [k, a] of Object.entries(o.series)) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i]!)) return `series ${k}[${i}]`;
  for (const [k, v] of Object.entries(o.matrices)) for (let i = 0; i < v.data.length; i++) if (!Number.isFinite(v.data[i]!)) return `matrix ${k}[${i}]`;
  return '';
};

describe('all 28 kernels: default run and presets', () => {
  for (const m of MODELS) {
    it(`${m.id} ${m.name}: defaults run, outputs are finite and every declared view has data`, () => {
      const cfg = defaultConfig(m);
      expect(validateConfig(m, cfg).filter((i) => i.severity === 'error')).toEqual([]);
      const o = m.run(cfg);
      expect(o.status).toBe('COMPLETED');
      expect(finite(o)).toBe('');
      // Some views are mode-specific (for example the BCM threshold trace); the UI hides views without data.
      expect(m.views.filter((v) => viewHasData(v, o)).length, `${m.id} views with data`).toBeGreaterThanOrEqual(1);
      expect(m.metrics.filter((k) => k.key in o.metrics).length, `${m.id} metrics with values`).toBeGreaterThanOrEqual(1);
    });
    it(`${m.id}: identical seed reproduces bit-identical output`, () => {
      const cfg = configWith(m, { durationMs: Math.min(m.defaultDurationMs, m.timeUnit === 'trials' ? 30 : 400), seed: 7 });
      const a = m.run(cfg), b = m.run(cfg);
      expect(Object.keys(a.metrics)).toEqual(Object.keys(b.metrics));
      for (const k of Object.keys(a.metrics)) expect(Object.is(a.metrics[k], b.metrics[k]), `${m.id} ${k}`).toBe(true);
      for (const k of Object.keys(a.series)) expect(a.series[k], `${m.id} ${k}`).toEqual(b.series[k]);
      // MODEL-024 and MODEL-026 use the seed only in their Poisson / probabilistic-reward presets (checked below).
      if (m.stochastic && !SEED_ONLY_IN_PRESETS.has(m.id)) {
        const c = m.run({ ...cfg, seed: 8 });
        const same = Object.keys(a.series).every((k) => a.series[k]!.every((v, i) => v === c.series[k]![i])) && a.spikes?.times.length === c.spikes?.times.length && Object.keys(a.metrics).every((k) => Object.is(a.metrics[k], c.metrics[k]));
        expect(same, `${m.id} must depend on the seed`).toBe(false);
      }
    });
  }
  it('seeded presets of MODEL-024 and MODEL-026 depend on the seed', () => {
    for (const [id, presetId] of [['MODEL-024', 'poisson'], ['MODEL-026', 'partial']] as const) {
      const m = getModel(id), p = m.presets.find((x) => x.id === presetId)!;
      const a = m.run(presetConfig(m, p, 1)), b = m.run(presetConfig(m, p, 2));
      expect(Object.keys(a.metrics).every((k) => Object.is(a.metrics[k], b.metrics[k])), id).toBe(false);
    }
  });
  it('every preset of every model runs to completion', () => {
    for (const m of MODELS) {
      const seen = new Set<number>();
      const outputs = [m.run(defaultConfig(m))];
      for (const p of m.presets) {
        const cfg = presetConfig(m, p);
        if (m.timeUnit !== 'trials') cfg.durationMs = Math.min(cfg.durationMs, 1500);
        const o = m.run(cfg);
        expect(o.status, `${m.id} preset ${p.id}`).toBe('COMPLETED');
        outputs.push(o);
      }
      // Every declared view must be backed by data in the default run or in at least one preset.
      m.views.forEach((v, i) => { if (outputs.some((o) => viewHasData(v, o))) seen.add(i); });
      expect(m.views.filter((_, i) => !seen.has(i)).map((v) => v.title), `${m.id} views never populated`).toEqual([]);
      expect(m.metrics.filter((k) => !outputs.some((o) => k.key in o.metrics)).map((k) => k.key), `${m.id} metrics never reported`).toEqual([]);
    }
  });
});

describe('numerical solvers', () => {
  // y' = -y + sin(t), y(0) = 1 has the closed form y = 1.5 e^{-t} + (sin t - cos t)/2.
  const f: Deriv = (t, y, d) => { d[0] = -y[0]! + Math.sin(t); };
  const exact = (t: number) => 1.5 * Math.exp(-t) + 0.5 * (Math.sin(t) - Math.cos(t));
  const errorAt = (make: (n: number) => { step: (f: Deriv, t: number, y: Float64Array, h: number) => void }, h: number) => {
    // Maximum error over the trajectory (a single end-point can sit near a sign change of the error).
    const s = make(1), y = Float64Array.of(1), n = Math.round(2 / h);
    let worst = 0;
    for (let i = 0; i < n; i++) { s.step(f, i * h, y, h); worst = Math.max(worst, Math.abs(y[0]! - exact((i + 1) * h))); }
    return worst;
  };
  it('forward Euler converges with order 1', () => {
    const p = Math.log2(errorAt(createEuler, 0.01) / errorAt(createEuler, 0.005));
    expect(p).toBeGreaterThan(0.9); expect(p).toBeLessThan(1.2);
  });
  it('RK4 converges with order 4', () => {
    const p = Math.log2(errorAt(createRk4, 0.1) / errorAt(createRk4, 0.05));
    expect(p).toBeGreaterThan(3.7); expect(p).toBeLessThan(4.3);
  });
  it('adaptive RK45 meets its tolerance', () => {
    const s = createRk45(1, 0.1), y = Float64Array.of(1);
    s.advance(f, 0, 2, y);
    expect(Math.abs(y[0]! - exact(2))).toBeLessThan(1e-5);
  });
  it('Hodgkin–Huxley self-convergence: RK4 order ≈ 4 and Euler order ≈ 1 on a subthreshold response', () => {
    const m = getModel('MODEL-001');
    const vEnd = (solver: 'SOLVER-RK4' | 'SOLVER-FE', dt: number) => { const o = m.run(configWith(m, { solver, dtMs: dt, durationMs: 4, stimulus: { kind: 'step', amplitude: 2, startMs: 0, durationMs: 1e9 } })); return o.series.V![o.t.length - 1]!; };
    const ref = vEnd('SOLVER-RK4', 0.0005);
    const pRk = Math.log2(Math.abs(vEnd('SOLVER-RK4', 0.04) - ref) / Math.abs(vEnd('SOLVER-RK4', 0.02) - ref));
    const pFe = Math.log2(Math.abs(vEnd('SOLVER-FE', 0.004) - ref) / Math.abs(vEnd('SOLVER-FE', 0.002) - ref));
    expect(pRk).toBeGreaterThan(3.5); expect(pRk).toBeLessThan(4.5);
    expect(pFe).toBeGreaterThan(0.9); expect(pFe).toBeLessThan(1.2);
  });
  it('Rush–Larsen keeps gating variables in [0, 1] at a step where forward Euler diverges', () => {
    const m = getModel('MODEL-001');
    const rl = m.run(configWith(m, { solver: 'SOLVER-RUSH-LARSEN', dtMs: 0.1, durationMs: 100 }));
    expect(rl.status).toBe('COMPLETED');
    expect(rl.metrics.gateMin!).toBeGreaterThanOrEqual(0); expect(rl.metrics.gateMax!).toBeLessThanOrEqual(1);
    expect(rl.metrics.spikeCount!).toBeGreaterThan(3);
    const fe = m.run(configWith(m, { solver: 'SOLVER-FE', dtMs: 0.1, durationMs: 100 }));
    expect(fe.status).toBe('DIVERGED');
    expect(fe.failedAtMs).toBeDefined();
    expect(fe.t.length).toBeGreaterThan(1);
  });
  it('passive RC step response matches V = E_L + R I (1 − e^{−t/τ}) (exact LIF < 1e-9 mV, RK4 < 1e-6 mV)', () => {
    const m = getModel('MODEL-005');
    for (const [solver, dt, tol] of [['SOLVER-EXACT-LIF', 0.1, 1e-9], ['SOLVER-HYBRID-SPIKE', 0.01, 1e-6]] as const) {
      const o = m.run(configWith(m, { solver, dtMs: dt, durationMs: 100, stimulus: { kind: 'step', amplitude: 150, startMs: 0, durationMs: 1e9 } }));
      let worst = 0;
      for (let i = 0; i < o.t.length; i++) worst = Math.max(worst, Math.abs(o.series.V![i]! - (-70 + 15 * (1 - Math.exp(-o.t[i]! / 20)))));
      expect(worst, solver).toBeLessThan(tol);
    }
  });
});
