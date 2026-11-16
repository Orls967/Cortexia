// MODEL-017 Wilson–Cowan, MODEL-018 Jansen–Rit, MODEL-019 Wong–Wang, MODEL-027 Kuramoto.
// Specification: docs/06-computational-models/POPULATION_AND_OSCILLATOR_MODELS.md.
import { peakFrequency, welchPsd, bandPower } from '../analytics/fft';
import { DIVERGENCE_NOTE, runOde } from '../core/odeRun';
import { diverged, finishRecorder, linspace, makeRecorder, maxOf, meanOf, minOf, paramReader, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import { makeStimulus } from '../core/stimulus';
import type { Curve, ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';
import type { Deriv } from '../solvers/ode';
import { generateGraph, GRAPH_KIND_OPTIONS } from './graphs';

// ───────────────────────── MODEL-017 Wilson–Cowan ─────────────────────────

const WC_PARAMS: ParamSpec[] = [
  { key: 'w_EE_WC', label: 'E → E weight', symbol: 'w_{EE}', unit: '', default: 16, min: 0, max: 30, step: 0.1, registryId: 'PARAM-052', description: 'Recurrent excitation within the excitatory population.', group: 'Coupling' },
  { key: 'w_EI_WC', label: 'I → E weight', symbol: 'w_{EI}', unit: '', default: 12, min: 0, max: 30, step: 0.1, registryId: 'PARAM-053', description: 'Inhibition of the excitatory population by the inhibitory population.', group: 'Coupling' },
  { key: 'w_IE_WC', label: 'E → I weight', symbol: 'w_{IE}', unit: '', default: 15, min: 0, max: 30, step: 0.1, registryId: 'PARAM-054', description: 'Excitatory drive onto the inhibitory population.', group: 'Coupling' },
  { key: 'w_II', label: 'I → I weight', symbol: 'w_{II}', unit: '', default: 3, min: 0, max: 30, step: 0.1, description: 'Recurrent inhibition within the inhibitory population.', group: 'Coupling' },
  { key: 'P_ext_WC', label: 'External drive to E', symbol: 'P_{ext}', unit: '', default: 1.25, min: -2, max: 5, step: 0.05, registryId: 'PARAM-055', description: 'Constant external input to the excitatory population; added to the stimulus waveform.', group: 'Inputs' },
  { key: 'Q_ext', label: 'External drive to I', symbol: 'Q_{ext}', unit: '', default: 0, min: -2, max: 5, step: 0.05, description: 'Constant external input to the inhibitory population.', group: 'Inputs' },
  { key: 'tau_E', label: 'Excitatory time constant', symbol: '\\tau_E', unit: 'ms', default: 10, min: 1, max: 50, step: 0.5, description: 'Response time of the excitatory population.', group: 'Dynamics' },
  { key: 'tau_I', label: 'Inhibitory time constant', symbol: '\\tau_I', unit: 'ms', default: 20, min: 1, max: 100, step: 0.5, description: 'Response time of the inhibitory population.', group: 'Dynamics' },
  { key: 'a_E', label: 'E sigmoid gain', symbol: 'a_E', unit: '', default: 1.3, min: 0.2, max: 5, step: 0.05, description: 'Slope of the excitatory response function.', group: 'Response function' },
  { key: 'theta_E', label: 'E sigmoid threshold', symbol: '\\theta_E', unit: '', default: 4, min: 0, max: 10, step: 0.1, description: 'Input giving half-maximal excitatory response.', group: 'Response function' },
  { key: 'a_I', label: 'I sigmoid gain', symbol: 'a_I', unit: '', default: 2, min: 0.2, max: 5, step: 0.05, description: 'Slope of the inhibitory response function.', group: 'Response function' },
  { key: 'theta_I', label: 'I sigmoid threshold', symbol: '\\theta_I', unit: '', default: 3.7, min: 0, max: 10, step: 0.1, description: 'Input giving half-maximal inhibitory response.', group: 'Response function' },
  { key: 'r_E', label: 'E refractory factor', symbol: 'r_E', unit: '', default: 1, min: 0, max: 2, step: 0.05, description: 'Scales the fraction of excitatory cells that are refractory.', group: 'Dynamics' },
  { key: 'r_I', label: 'I refractory factor', symbol: 'r_I', unit: '', default: 1, min: 0, max: 2, step: 0.05, description: 'Scales the fraction of inhibitory cells that are refractory.', group: 'Dynamics' },
];

export interface WcFixedPoint { E: number; I: number; trace: number; det: number; kind: string; stable: boolean }

export function wilsonCowanAnalysis(p: (k: string) => number, P: number, Q: number) {
  const wEE = p('w_EE_WC'), wEI = p('w_EI_WC'), wIE = p('w_IE_WC'), wII = p('w_II');
  const tauE = p('tau_E'), tauI = p('tau_I'), aE = p('a_E'), thE = p('theta_E'), aI = p('a_I'), thI = p('theta_I'), rE = p('r_E'), rI = p('r_I');
  const S = (x: number, a: number, th: number) => 1 / (1 + Math.exp(-a * (x - th))) - 1 / (1 + Math.exp(a * th));
  const Sinv = (y: number, a: number, th: number) => th - Math.log(1 / (y + 1 / (1 + Math.exp(a * th))) - 1) / a;
  const fE = (E: number, I: number) => (-E + (1 - rE * E) * S(wEE * E - wEI * I + P, aE, thE)) / tauE;
  const fI = (E: number, I: number) => (-I + (1 - rI * I) * S(wIE * E - wII * I + Q, aI, thI)) / tauI;
  // E-nullcline as I(E); I-nullcline as E(I). Points outside the invertible range are dropped.
  const eNull: Curve = { x: new Float64Array(0), y: new Float64Array(0) };
  const iNull: Curve = { x: new Float64Array(0), y: new Float64Array(0) };
  const ex: number[] = [], ey: number[] = [], ix: number[] = [], iy: number[] = [];
  const maxSE = 1 - 1 / (1 + Math.exp(aE * thE)), maxSI = 1 - 1 / (1 + Math.exp(aI * thI));
  for (const E of linspace(0, 0.5, 501)) {
    const y = E / (1 - rE * E);
    if (y > -1 / (1 + Math.exp(aE * thE)) && y < maxSE && wEI > 0) { ex.push(E); ey.push((wEE * E + P - Sinv(y, aE, thE)) / wEI); }
  }
  for (const I of linspace(0, 0.5, 501)) {
    const y = I / (1 - rI * I);
    if (y > -1 / (1 + Math.exp(aI * thI)) && y < maxSI && wIE > 0) { iy.push(I); ix.push((wII * I - Q + Sinv(y, aI, thI)) / wIE); }
  }
  eNull.x = Float64Array.from(ex); eNull.y = Float64Array.from(ey);
  iNull.x = Float64Array.from(ix); iNull.y = Float64Array.from(iy);
  // Fixed points: zeros of fI along the E-nullcline, refined by bisection in E.
  const iOnE = (E: number) => (wEE * E + P - Sinv(E / (1 - rE * E), aE, thE)) / wEI;
  const g = (E: number) => fI(E, iOnE(E));
  const fixed: WcFixedPoint[] = [];
  for (let k = 1; k < ex.length; k++) {
    let lo = ex[k - 1]!, hi = ex[k]!;
    const glo = g(lo), ghi = g(hi);
    if (!Number.isFinite(glo) || !Number.isFinite(ghi) || glo * ghi > 0) continue;
    for (let it = 0; it < 60; it++) { const mid = 0.5 * (lo + hi); if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
    const E = 0.5 * (lo + hi), I = iOnE(E);
    const h = 1e-6;
    const j11 = (fE(E + h, I) - fE(E - h, I)) / (2 * h), j12 = (fE(E, I + h) - fE(E, I - h)) / (2 * h);
    const j21 = (fI(E + h, I) - fI(E - h, I)) / (2 * h), j22 = (fI(E, I + h) - fI(E, I - h)) / (2 * h);
    const trace = j11 + j22, det = j11 * j22 - j12 * j21;
    const disc = trace * trace - 4 * det;
    const kind = det < 0 ? 'saddle' : disc < 0 ? (trace < 0 ? 'stable focus' : 'unstable focus') : trace < 0 ? 'stable node' : 'unstable node';
    if (!fixed.some((f) => Math.abs(f.E - E) < 1e-5)) fixed.push({ E, I, trace, det, kind, stable: det > 0 && trace < 0 });
  }
  return { fE, fI, eNull, iNull, fixed };
}

function runWC(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(WC_PARAMS, cfg.params);
  const P0 = p('P_ext_WC'), Q = p('Q_ext');
  const stim = makeStimulus(cfg.stimulus, cfg.dtMs, cfg.durationMs, cfg.seed);
  const wEE = p('w_EE_WC'), wEI = p('w_EI_WC'), wIE = p('w_IE_WC'), wII = p('w_II');
  const tauE = p('tau_E'), tauI = p('tau_I'), aE = p('a_E'), thE = p('theta_E'), aI = p('a_I'), thI = p('theta_I'), rE = p('r_E'), rI = p('r_I');
  const cE = 1 / (1 + Math.exp(aE * thE)), cI = 1 / (1 + Math.exp(aI * thI));
  const deriv: Deriv = (t, y, d) => {
    const E = y[0]!, I = y[1]!;
    d[0] = (-E + (1 - rE * E) * (1 / (1 + Math.exp(-aE * (wEE * E - wEI * I + P0 + stim(t) - thE))) - cE)) / tauE;
    d[1] = (-I + (1 - rI * I) * (1 / (1 + Math.exp(-aI * (wIE * E - wII * I + Q - thI))) - cI)) / tauI;
  };
  const res = runOde({
    cfg, ctx, y0: Float64Array.of(cfg.initial.E ?? 0.1, cfg.initial.I ?? 0.05), deriv, recordKeys: ['E', 'I', 'P'],
    record: (j, t, y, s) => { s.E![j] = y[0]!; s.I![j] = y[1]!; s.P![j] = P0 + stim(t); },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const steadyP = P0 + (cfg.stimulus.kind === 'step' && cfg.stimulus.durationMs > cfg.durationMs ? cfg.stimulus.amplitude : 0) + cfg.stimulus.baseline;
  const an = wilsonCowanAnalysis(p, steadyP, Q);
  out.curves.E_nullcline = an.eNull;
  out.curves.I_nullcline = an.iNull;
  out.curves.fixed_points = { x: Float64Array.from(an.fixed, (f) => f.E), y: Float64Array.from(an.fixed, (f) => f.I) };
  const half = Math.floor(res.t.length / 2);
  const tail = res.series.E!.subarray(half);
  const amp = maxOf(tail) - minOf(tail);
  out.metrics.lateAmplitudeE = amp;
  out.metrics.meanE = meanOf(tail);
  out.metrics.finalE = res.series.E![res.t.length - 1]!;
  out.metrics.fixedPointCount = an.fixed.length;
  out.metrics.stableFixedPointCount = an.fixed.filter((f) => f.stable).length;
  const f0 = an.fixed[0];
  if (f0) { out.metrics.jacobianTrace = f0.trace; out.metrics.jacobianDet = f0.det; }
  // Oscillation frequency from upward mean-crossings of E in the second half.
  let crossings = 0, first = NaN, last = NaN;
  const m = out.metrics.meanE;
  for (let i = half + 1; i < res.t.length; i++) {
    if (res.series.E![i - 1]! < m && res.series.E![i]! >= m) { crossings++; if (Number.isNaN(first)) first = res.t[i]!; last = res.t[i]!; }
  }
  out.metrics.oscillationFrequencyHz = amp > 0.01 && crossings > 1 ? (1000 * (crossings - 1)) / (last - first) : 0;
  for (const f of an.fixed) out.notes.push(`Fixed point (E* = ${f.E.toFixed(3)}, I* = ${f.I.toFixed(3)}): ${f.kind} — trace ${f.trace.toFixed(4)}, det ${f.det.toFixed(5)}.`);
  out.notes.push(amp > 0.01 ? `Sustained oscillation at ${out.metrics.oscillationFrequencyHz.toFixed(1)} Hz (limit cycle).` : `Activity settles to a steady state (E = ${out.metrics.finalE.toFixed(3)}).`);
  return out;
}

export const MODEL_017: ModelDefinition = {
  id: 'MODEL-017',
  name: 'Wilson–Cowan',
  equations: [
    '\\tau_E \\frac{dE}{dt} = -E + (1 - r_E E)\\,\\mathcal{S}_E\\!\\left(w_{EE} E - w_{EI} I + P_{ext}(t)\\right)',
    '\\tau_I \\frac{dI}{dt} = -I + (1 - r_I I)\\,\\mathcal{S}_I\\!\\left(w_{IE} E - w_{II} I + Q_{ext}\\right)',
    '\\mathcal{S}_k(x) = \\frac{1}{1 + e^{-a_k (x - \\theta_k)}} - \\frac{1}{1 + e^{a_k \\theta_k}}',
  ],
  params: WC_PARAMS,
  initial: [
    { key: 'E', label: 'Excitatory activity E(0)', unit: '', default: 0.1 },
    { key: 'I', label: 'Inhibitory activity I(0)', unit: '', default: 0.05 },
  ],
  stimulus: {
    label: 'Additional drive to E', unit: 'dimensionless', description: 'Time-varying input added to P_ext (for example a transient cue).',
    default: { kind: 'none', amplitude: 0 }, amplitudeRange: [-2, 5], kinds: ['none', 'step', 'pulse-train', 'sine', 'ramp'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-RK45', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.5, defaultDurationMs: 500, maxDurationMs: 20000,
  stochastic: false,
  views: [
    { kind: 'phase', title: '(E, I) phase plane with nullclines', xKey: 'E', yKey: 'I', xLabel: 'E', yLabel: 'I', curves: [{ key: 'E_nullcline', label: 'E-nullcline' }, { key: 'I_nullcline', label: 'I-nullcline' }, { key: 'fixed_points', label: 'Fixed points' }] },
    { kind: 'traces', title: 'Population activity', yLabel: 'active fraction', series: [
      { key: 'E', label: 'E', unit: '', meaning: 'Fraction of excitatory cells active per unit time.' },
      { key: 'I', label: 'I', unit: '', meaning: 'Fraction of inhibitory cells active per unit time.' },
    ] },
  ],
  metrics: [
    { key: 'oscillationFrequencyHz', label: 'Oscillation frequency', unit: 'Hz', description: 'Frequency of the limit cycle from mean-crossings of E; 0 for a steady state.' },
    { key: 'lateAmplitudeE', label: 'Late amplitude of E', unit: '', description: 'Peak-to-peak range of E over the second half of the run.', digits: 4 },
    { key: 'fixedPointCount', label: 'Fixed points', unit: '', description: 'Number of nullcline intersections found.', digits: 0 },
    { key: 'stableFixedPointCount', label: 'Stable fixed points', unit: '', description: 'Fixed points with negative trace and positive determinant; two indicates bistability.', digits: 0 },
    { key: 'jacobianTrace', label: 'Jacobian trace (first fixed point)', unit: '1/ms', description: 'Trace of the linearization at the lowest-E fixed point.', digits: 4 },
    { key: 'jacobianDet', label: 'Jacobian determinant (first fixed point)', unit: '1/ms²', description: 'Determinant of the linearization at the lowest-E fixed point.', digits: 5 },
  ],
  presets: [
    { id: 'cycle', label: 'Limit-cycle oscillation', description: 'Wilson & Cowan (1972) oscillatory regime, P = 1.25.', experimentId: 'EXP-026' },
    { id: 'bistable', label: 'Bistable working-memory regime', description: 'Wilson & Cowan (1972) hysteresis parameters: a transient cue switches the network from the resting state into a persistent high-activity state.', params: { w_EE_WC: 12, w_EI_WC: 4, w_IE_WC: 13, w_II: 11, P_ext_WC: 0, a_E: 1.2, theta_E: 2.8, a_I: 1, theta_I: 4 }, stimulus: { kind: 'step', amplitude: 2, startMs: 100, durationMs: 40 }, experimentId: 'EXP-026' },
    { id: 'bistable_nocue', label: 'Bistable regime without a cue', description: 'Same parameters with no cue: activity stays in the low state, showing that the high state is a memory of the input.', params: { w_EE_WC: 12, w_EI_WC: 4, w_IE_WC: 13, w_II: 11, P_ext_WC: 0, a_E: 1.2, theta_E: 2.8, a_I: 1, theta_I: 4 }, experimentId: 'EXP-026' },
    { id: 'quiet', label: 'Stable low-activity state', description: 'Without external drive activity decays to rest.', params: { P_ext_WC: 0 } },
  ],
  sweep: { paramKey: 'P_ext_WC', from: 0, to: 3, steps: 16, metricKey: 'lateAmplitudeE', experimentId: 'EXP-026' },
  kernelLimitations: [
    'Mean-field rates: individual spike timing and synchrony within a population are not represented.',
    'Spatially homogeneous populations with instantaneous coupling (no delays).',
    'The bistable preset also changes the response functions (a_E = 1.2, θ_E = 2.8, a_I = 1, θ_I = 4, Wilson & Cowan 1972): with the limit-cycle response functions the weights listed in the specification give a single resting state.',
  ],
  run: runWC,
};

// ───────────────────────── MODEL-018 Jansen–Rit ─────────────────────────

const JR_PARAMS: ParamSpec[] = [
  { key: 'A_JR', label: 'Excitatory synaptic gain', symbol: 'A', unit: 'mV', default: 3.25, min: 1, max: 10, step: 0.05, registryId: 'PARAM-056', description: 'Amplitude of the excitatory postsynaptic potential kernel.', group: 'Synaptic kernels' },
  { key: 'B_JR', label: 'Inhibitory synaptic gain', symbol: 'B', unit: 'mV', default: 22, min: 5, max: 50, step: 0.5, registryId: 'PARAM-057', description: 'Amplitude of the inhibitory postsynaptic potential kernel.', group: 'Synaptic kernels' },
  { key: 'C_JR', label: 'Connectivity constant', symbol: 'C', unit: '', default: 135, min: 50, max: 300, step: 1, registryId: 'PARAM-058', description: 'Average number of synaptic contacts; C₁ = C, C₂ = 0.8 C, C₃ = C₄ = 0.25 C.', group: 'Connectivity' },
  { key: 'a_rate', label: 'Excitatory rate constant', symbol: 'a', unit: '1/s', default: 100, min: 20, max: 300, step: 1, description: 'Inverse time constant of the excitatory kernel.', group: 'Synaptic kernels' },
  { key: 'b_rate', label: 'Inhibitory rate constant', symbol: 'b', unit: '1/s', default: 50, min: 10, max: 200, step: 1, description: 'Inverse time constant of the inhibitory kernel.', group: 'Synaptic kernels' },
  { key: 'p_mean', label: 'Mean afferent input', symbol: '\\bar{p}', unit: 'Hz', default: 220, min: 0, max: 400, step: 5, description: 'Mean firing rate of extrinsic (thalamic and cortico-cortical) input.', group: 'Input' },
  { key: 'p_sd', label: 'Input standard deviation', symbol: '\\sigma_p', unit: 'Hz', default: 22, min: 0, max: 100, step: 1, description: 'Standard deviation of the Gaussian input fluctuations.', group: 'Input' },
  { key: 'v0', label: 'Sigmoid threshold', symbol: 'v_0', unit: 'mV', default: 6, min: 2, max: 10, step: 0.1, description: 'Potential giving half-maximal firing rate.', group: 'Sigmoid' },
  { key: 'e0', label: 'Half maximal firing rate', symbol: 'e_0', unit: '1/s', default: 2.5, min: 1, max: 10, step: 0.1, description: 'Half of the maximum population firing rate.', group: 'Sigmoid' },
  { key: 'r_slope', label: 'Sigmoid steepness', symbol: 'r', unit: '1/mV', default: 0.56, min: 0.2, max: 1.5, step: 0.01, description: 'Slope of the potential-to-rate sigmoid.', group: 'Sigmoid' },
];

function runJR(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(JR_PARAMS, cfg.params);
  const A = p('A_JR'), B = p('B_JR'), C = p('C_JR'), a = p('a_rate'), b = p('b_rate');
  const pMean = p('p_mean'), pSd = p('p_sd'), v0 = p('v0'), e0 = p('e0'), r = p('r_slope');
  const C1 = C, C2 = 0.8 * C, C3 = 0.25 * C, C4 = 0.25 * C;
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs, h = dt / 1000; // integrate in seconds
  const rng = new Rng(cfg.seed);
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const sig = (v: number) => (2 * e0) / (1 + Math.exp(r * (v0 - v)));
  const y = Float64Array.of(cfg.initial.y0 ?? 0, cfg.initial.y1 ?? 0, cfg.initial.y2 ?? 0, cfg.initial.y3 ?? 0, cfg.initial.y4 ?? 0, cfg.initial.y5 ?? 0);
  const k1 = new Float64Array(6), k2 = new Float64Array(6), k3 = new Float64Array(6), k4 = new Float64Array(6), tmp = new Float64Array(6);
  let pNow = pMean;
  const f = (s: Float64Array, d: Float64Array) => {
    d[0] = s[3]!; d[1] = s[4]!; d[2] = s[5]!;
    d[3] = A * a * sig(s[1]! - s[2]!) - 2 * a * s[3]! - a * a * s[0]!;
    d[4] = A * a * (pNow + C2 * sig(C1 * s[0]!)) - 2 * a * s[4]! - a * a * s[1]!;
    d[5] = B * b * C4 * sig(C3 * s[0]!) - 2 * b * s[5]! - b * b * s[2]!;
  };
  const rec = makeRecorder(['eeg', 'y0', 'y1', 'y2', 'p'], nSteps);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.written = 1;
  const stochastic = pSd > 0;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    // Input held constant across the step: p = mean + stimulus + Gaussian fluctuation (seeded).
    pNow = pMean + stim(t) + (stochastic ? pSd * rng.normal() : 0);
    if (cfg.solver === 'SOLVER-EULER-MARUYAMA') {
      f(y, k1);
      for (let q = 0; q < 6; q++) y[q] = y[q]! + h * k1[q]!;
    } else if (cfg.solver === 'SOLVER-RK4') {
      f(y, k1);
      for (let q = 0; q < 6; q++) tmp[q] = y[q]! + 0.5 * h * k1[q]!;
      f(tmp, k2);
      for (let q = 0; q < 6; q++) tmp[q] = y[q]! + 0.5 * h * k2[q]!;
      f(tmp, k3);
      for (let q = 0; q < 6; q++) tmp[q] = y[q]! + h * k3[q]!;
      f(tmp, k4);
      for (let q = 0; q < 6; q++) y[q] = y[q]! + (h / 6) * (k1[q]! + 2 * k2[q]! + 2 * k3[q]! + k4[q]!);
    } else {
      throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by MODEL-018.`);
    }
    if (diverged(y[1]!)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.eeg![j] = y[1]! - y[2]!; rec.s.y0![j] = y[0]!; rec.s.y1![j] = y[1]!; rec.s.y2![j] = y[2]!; rec.s.p![j] = pNow; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 5000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  // Spectral summary of the EEG proxy after discarding the first second (transient).
  const fs = 1000 / (dt * rec.stride);
  const skip = Math.min(t.length - 1, Math.floor(fs));
  const eeg = series.eeg!.subarray(skip);
  if (eeg.length >= 64) {
    const psd = welchPsd(eeg, fs, Math.min(eeg.length, Math.round(2 * fs)));
    const keep = psd.freq.findIndex((fq) => fq > 50);
    const end = keep < 0 ? psd.freq.length : keep;
    out.curves.psd = { x: psd.freq.slice(0, end), y: psd.power.slice(0, end) };
    out.metrics.peakFrequencyHz = peakFrequency(psd, 1, 45);
    const total = bandPower(psd, 1, 45);
    out.metrics.alphaBandFraction = total > 0 ? bandPower(psd, 8, 12) / total : 0;
  }
  out.metrics.eegMeanMv = meanOf(eeg);
  out.metrics.eegAmplitudeMv = eeg.length ? maxOf(eeg) - minOf(eeg) : 0;
  return out;
}

export const MODEL_018: ModelDefinition = {
  id: 'MODEL-018',
  name: 'Jansen–Rit Neural Mass',
  equations: [
    '\\dot{y}_0 = y_3, \\quad \\dot{y}_3 = A a\\,\\mathrm{Sigm}(y_1 - y_2) - 2 a y_3 - a^2 y_0',
    '\\dot{y}_1 = y_4, \\quad \\dot{y}_4 = A a\\left[p(t) + C_2\\,\\mathrm{Sigm}(C_1 y_0)\\right] - 2 a y_4 - a^2 y_1',
    '\\dot{y}_2 = y_5, \\quad \\dot{y}_5 = B b\\,C_4\\,\\mathrm{Sigm}(C_3 y_0) - 2 b y_5 - b^2 y_2',
    '\\mathrm{Sigm}(v) = \\frac{2 e_0}{1 + e^{r (v_0 - v)}}, \\qquad V_{EEG}(t) = y_1(t) - y_2(t)',
  ],
  params: JR_PARAMS,
  initial: [{ key: 'y0', label: 'Pyramidal output y₀(0)', unit: 'mV', default: 0 }, { key: 'y1', label: 'Excitatory PSP y₁(0)', unit: 'mV', default: 0 }, { key: 'y2', label: 'Inhibitory PSP y₂(0)', unit: 'mV', default: 0 }],
  stimulus: {
    label: 'Additional afferent input', unit: 'Hz', description: 'Transient input added to p(t), for example a flash evoking a visual evoked potential.',
    default: { kind: 'none', amplitude: 0 }, amplitudeRange: [-200, 600], kinds: ['none', 'pulse-train', 'step', 'sine'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-EULER-MARUYAMA'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.5, minDtMs: 0.05, maxSafeDtMs: 1.0, defaultDurationMs: 6000, maxDurationMs: 30000,
  stochastic: true,
  views: [
    { kind: 'traces', title: 'EEG proxy y₁ − y₂', yLabel: 'potential (mV)', series: [{ key: 'eeg', label: 'y₁ − y₂', unit: 'mV', meaning: 'Net postsynaptic potential of pyramidal cells: the model\'s proxy for the scalp EEG signal.' }] },
    { kind: 'curve', title: 'Welch power spectral density', xLabel: 'frequency (Hz)', yLabel: 'PSD (mV²/Hz)', meaning: 'Power spectrum of the EEG proxy; the default parameters peak in the alpha band.', curves: [{ key: 'psd', label: 'PSD' }] },
    { kind: 'traces', title: 'Subpopulation potentials', yLabel: 'potential (mV)', series: [
      { key: 'y0', label: 'y₀', unit: 'mV', meaning: 'Output of the pyramidal population kernel.' },
      { key: 'y1', label: 'y₁', unit: 'mV', meaning: 'Excitatory postsynaptic potential on pyramidal cells.' },
      { key: 'y2', label: 'y₂', unit: 'mV', meaning: 'Inhibitory postsynaptic potential on pyramidal cells.' },
    ] },
  ],
  metrics: [
    { key: 'peakFrequencyHz', label: 'Spectral peak', unit: 'Hz', description: 'Frequency of maximum Welch PSD between 1 and 45 Hz (VAL-JR-001 expects 8–12 Hz).', analyticId: 'ANALYTIC-004' },
    { key: 'alphaBandFraction', label: 'Alpha-band power fraction', unit: '', description: 'Share of 1–45 Hz power that lies between 8 and 12 Hz.', analyticId: 'ANALYTIC-004', digits: 3 },
    { key: 'eegAmplitudeMv', label: 'EEG proxy range', unit: 'mV', description: 'Peak-to-peak amplitude of y₁ − y₂ after the initial transient.' },
  ],
  presets: [
    { id: 'alpha', label: 'Alpha rhythm (C = 135)', description: 'Noise-driven ~10 Hz oscillation.', experimentId: 'EXP-027' },
    { id: 'low', label: 'Weak connectivity (C = 68)', description: 'Low coupling: noise-like low-amplitude activity.', params: { C_JR: 68 }, experimentId: 'EXP-027' },
    { id: 'vep', label: 'Evoked potential', description: 'A brief input pulse on a quiet background produces a damped response.', params: { p_mean: 90, p_sd: 2 }, stimulus: { kind: 'pulse-train', amplitude: 400, startMs: 2000, pulseWidthMs: 20, pulseCount: 1, pulseIntervalMs: 1000 }, durationMs: 3500, experimentId: 'EXP-027' },
  ],
  sweep: { paramKey: 'C_JR', from: 68, to: 270, steps: 12, metricKey: 'peakFrequencyHz', experimentId: 'EXP-027' },
  kernelLimitations: ['Lumped cortical column: no laminar structure, spatial extent or conduction delays.', 'The EEG proxy is a model potential, not a calibrated scalp measurement.'],
  run: runJR,
};

// ───────────────────────── MODEL-019 Wong–Wang ─────────────────────────

const WW_PARAMS: ParamSpec[] = [
  { key: 'J_self_WW', label: 'Recurrent self-excitation', symbol: 'J_{11}', unit: 'nA', default: 0.2609, min: 0.1, max: 0.5, step: 0.001, registryId: 'PARAM-059', description: 'NMDA-mediated recurrent excitation within each selective population.', group: 'Coupling' },
  { key: 'J_cross_WW', label: 'Cross-inhibition', symbol: 'J_{12}', unit: 'nA', default: 0.0497, min: 0, max: 0.2, step: 0.001, registryId: 'PARAM-060', description: 'Effective mutual inhibition between the two populations.', group: 'Coupling' },
  { key: 'coherence', label: 'Stimulus coherence', symbol: "c'", unit: '%', default: 6.4, min: -100, max: 100, step: 0.1, description: 'Signed motion coherence: positive favours population 1.', group: 'Stimulus' },
  { key: 'mu0', label: 'Stimulus strength', symbol: '\\mu_0', unit: 'Hz', default: 30, min: 0, max: 80, step: 1, description: 'Afferent rate at zero coherence.', group: 'Stimulus' },
  { key: 'stim_on', label: 'Stimulus onset', symbol: 't_{on}', unit: 'ms', default: 500, min: 0, max: 5000, step: 10, description: 'Time at which the sensory evidence starts.', group: 'Stimulus' },
  { key: 'stim_dur', label: 'Stimulus duration', symbol: 'T_{stim}', unit: 'ms', default: 2000, min: 50, max: 10000, step: 10, description: 'Duration of the sensory evidence.', group: 'Stimulus' },
  { key: 'I0', label: 'Background input', symbol: 'I_0', unit: 'nA', default: 0.3255, min: 0.2, max: 0.45, step: 0.0005, description: 'Mean background synaptic input.', group: 'Inputs' },
  { key: 'sigma_noise', label: 'Noise amplitude', symbol: '\\sigma_{noise}', unit: 'nA', default: 0.02, min: 0, max: 0.1, step: 0.001, description: 'Amplitude of the white noise filtered by the AMPA time constant; the filtered current has standard deviation σ/√2.', group: 'Inputs' },
  { key: 'tau_S', label: 'NMDA gating time constant', symbol: '\\tau_S', unit: 'ms', default: 100, min: 20, max: 300, step: 1, description: 'Decay time of the slow NMDA gating variable.', group: 'Dynamics' },
  { key: 'gamma_WW', label: 'Gating rate factor', symbol: '\\gamma', unit: '', default: 0.641, min: 0.1, max: 2, step: 0.001, description: 'Controls how firing rate drives NMDA gating.', group: 'Dynamics' },
  { key: 'threshold_hz', label: 'Decision threshold', symbol: '\\theta', unit: 'Hz', default: 15, min: 5, max: 40, step: 0.5, description: 'Firing rate at which a choice is registered.', group: 'Decision' },
];
const WW = { a: 270, b: 108, d: 0.154, JAext: 5.2e-4, tauAmpa: 2, windowMs: 50 };

function runWW(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(WW_PARAMS, cfg.params);
  const J11 = p('J_self_WW'), J12 = p('J_cross_WW'), coh = p('coherence'), mu0 = p('mu0'), tOn = p('stim_on'), tDur = p('stim_dur');
  const I0 = p('I0'), sigma = p('sigma_noise'), tauS = p('tau_S'), gamma = p('gamma_WW'), thr = p('threshold_hz');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const rng = new Rng(cfg.seed);
  const H = (x: number) => { const u = WW.a * x - WW.b; return Math.abs(u) < 1e-9 ? 1 / WW.d : u / (1 - Math.exp(-WW.d * u)); };
  let S1 = cfg.initial.S_1 ?? 0.1, S2 = cfg.initial.S_2 ?? 0.1, n1 = 0, n2 = 0;
  const rec = makeRecorder(['S_1', 'S_2', 'r_1', 'r_2'], nSteps);
  let choice = 0, rt = NaN;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  const deterministic = cfg.solver === 'SOLVER-RK4';
  // τ_AMPA dI/dt = −I + η(t)·√(τ_AMPA σ²) has stationary standard deviation σ/√2; the exact OU propagator is used.
  const noiseDecay = Math.exp(-dt / WW.tauAmpa), noiseKick = (sigma / Math.SQRT2) * Math.sqrt(1 - noiseDecay * noiseDecay);
  // Rates are averaged over a causal 50 ms window before the threshold test, as in Wong & Wang (2006); testing the
  // instantaneous rate would let a single fast noise excursion trigger the decision.
  const win = Math.max(1, Math.round(WW.windowMs / dt));
  const buf1 = new Float64Array(win), buf2 = new Float64Array(win);
  let acc1 = 0, acc2 = 0, filled = 0, pos = 0;
  rec.s.S_1![0] = S1; rec.s.S_2![0] = S2; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const on = t >= tOn && t < tOn + tDur;
    const Is1 = on ? WW.JAext * mu0 * (1 + coh / 100) : 0, Is2 = on ? WW.JAext * mu0 * (1 - coh / 100) : 0;
    const dS = (s1: number, s2: number): [number, number, number, number] => {
      const r1 = H(J11 * s1 - J12 * s2 + I0 + Is1 + n1), r2 = H(J11 * s2 - J12 * s1 + I0 + Is2 + n2);
      return [-s1 / tauS + ((1 - s1) * gamma * r1) / 1000, -s2 / tauS + ((1 - s2) * gamma * r2) / 1000, r1, r2];
    };
    let r1: number, r2: number;
    if (deterministic) {
      const a1 = dS(S1, S2), a2 = dS(S1 + 0.5 * dt * a1[0], S2 + 0.5 * dt * a1[1]), a3 = dS(S1 + 0.5 * dt * a2[0], S2 + 0.5 * dt * a2[1]), a4 = dS(S1 + dt * a3[0], S2 + dt * a3[1]);
      S1 += (dt / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
      S2 += (dt / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
      r1 = a1[2]; r2 = a1[3];
    } else {
      // Euler–Maruyama for the gating variables; the Ornstein–Uhlenbeck noise uses its exact discrete propagator.
      const a1 = dS(S1, S2);
      S1 += dt * a1[0]; S2 += dt * a1[1];
      r1 = a1[2]; r2 = a1[3];
      n1 = n1 * noiseDecay + noiseKick * rng.normal();
      n2 = n2 * noiseDecay + noiseKick * rng.normal();
    }
    S1 = Math.min(1, Math.max(0, S1)); S2 = Math.min(1, Math.max(0, S2));
    if (diverged(r1) || diverged(r2)) { status = 'DIVERGED'; failedAtMs = t; break; }
    acc1 += r1 - buf1[pos]!; buf1[pos] = r1; acc2 += r2 - buf2[pos]!; buf2[pos] = r2;
    pos = (pos + 1) % win;
    if (filled < win) filled++;
    const m1 = acc1 / filled, m2 = acc2 / filled;
    if (choice === 0 && on && (m1 >= thr || m2 >= thr)) { choice = m1 >= m2 ? 1 : 2; rt = t + dt - tOn; }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) { rec.t[j] = k * dt; rec.s.S_1![j] = S1; rec.s.S_2![j] = S2; rec.s.r_1![j] = m1; rec.s.r_2![j] = m2; rec.written = j + 1; } }
    if (ctx?.onProgress && k % 5000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const last = t.length - 1;
  out.metrics.choice = choice;
  out.metrics.choseTarget1 = choice === 1 ? 1 : 0;
  out.metrics.correct = choice === 0 || coh === 0 ? NaN : (coh > 0 ? choice === 1 : choice === 2) ? 1 : 0;
  out.metrics.reactionTimeMs = rt;
  out.metrics.finalRate1Hz = series.r_1![last]!;
  out.metrics.finalRate2Hz = series.r_2![last]!;
  out.metrics.persistentActivity = Math.max(series.r_1![last]!, series.r_2![last]!) > thr ? 1 : 0;
  out.notes.push(choice === 0 ? 'No decision: neither population reached the threshold during the stimulus.' : `Population ${choice} won the competition ${rt.toFixed(0)} ms after stimulus onset${out.metrics.persistentActivity ? ' and its activity persists after the stimulus (working-memory attractor)' : ''}.`);
  return out;
}

export const MODEL_019: ModelDefinition = {
  id: 'MODEL-019',
  name: 'Wong–Wang Decision Attractor',
  equations: [
    '\\frac{dS_i}{dt} = -\\frac{S_i}{\\tau_S} + (1 - S_i)\\,\\gamma\\,H(x_i), \\quad i \\in \\{1, 2\\}',
    'x_1 = J_{11} S_1 - J_{12} S_2 + I_0 + I_{stim,1}(t) + I_{noise,1}(t), \\qquad x_2 = J_{11} S_2 - J_{12} S_1 + I_0 + I_{stim,2}(t) + I_{noise,2}(t)',
    'H(x) = \\frac{a x - b}{1 - \\exp[-d\\,(a x - b)]}, \\qquad I_{stim,1/2} = J_{A,ext}\\,\\mu_0\\left(1 \\pm \\tfrac{c\'}{100}\\right)',
    '\\tau_{AMPA}\\,\\frac{dI_{noise,i}}{dt} = -I_{noise,i} + \\eta_i(t)\\sqrt{\\tau_{AMPA}\\,\\sigma_{noise}^2}',
  ],
  params: WW_PARAMS,
  initial: [{ key: 'S_1', label: 'Gating S₁(0)', unit: '', default: 0.1 }, { key: 'S_2', label: 'Gating S₂(0)', unit: '', default: 0.1 }],
  stimulus: null,
  solvers: ['SOLVER-EULER-MARUYAMA', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-EULER-MARUYAMA', defaultDtMs: 0.5, minDtMs: 0.05, maxSafeDtMs: 1.0, defaultDurationMs: 3500, maxDurationMs: 10000,
  stochastic: true,
  views: [
    { kind: 'traces', title: 'Population firing rates', yLabel: 'rate (Hz)', series: [
      { key: 'r_1', label: 'r₁', unit: 'Hz', meaning: 'Firing rate of the population selective for choice 1 (50 ms running average).' },
      { key: 'r_2', label: 'r₂', unit: 'Hz', meaning: 'Firing rate of the population selective for choice 2 (50 ms running average).' },
    ] },
    { kind: 'phase', title: '(S₁, S₂) decision space', xKey: 'S_1', yKey: 'S_2', xLabel: 'S₁', yLabel: 'S₂', curves: [] },
    { kind: 'traces', title: 'NMDA gating variables', yLabel: 'S', series: [
      { key: 'S_1', label: 'S₁', unit: '', meaning: 'Slow NMDA gating variable of population 1 (integrates evidence).' },
      { key: 'S_2', label: 'S₂', unit: '', meaning: 'Slow NMDA gating variable of population 2.' },
    ] },
  ],
  metrics: [
    { key: 'choice', label: 'Choice', unit: '', description: 'Population that crossed the decision threshold first (0 = none).', digits: 0 },
    { key: 'reactionTimeMs', label: 'Decision time', unit: 'ms', description: 'Time from stimulus onset to threshold crossing.' },
    { key: 'correct', label: 'Correct', unit: '', description: '1 if the choice matches the sign of the coherence.', digits: 0 },
    { key: 'persistentActivity', label: 'Persistent activity', unit: '', description: '1 if the winning population is still above threshold at the end of the run.', digits: 0 },
  ],
  presets: [
    { id: 'easy', label: 'High coherence (51.2%)', description: 'Fast, reliable decision.', params: { coherence: 51.2 }, experimentId: 'EXP-028' },
    { id: 'hard', label: 'Low coherence (3.2%)', description: 'Slow, error-prone decision dominated by noise.', params: { coherence: 3.2 }, experimentId: 'EXP-028' },
    { id: 'zero', label: 'Zero coherence', description: 'Noise alone breaks the symmetry.', params: { coherence: 0 }, experimentId: 'EXP-028' },
  ],
  sweep: { paramKey: 'coherence', from: 0, to: 51.2, steps: 9, metricKey: 'reactionTimeMs', experimentId: 'EXP-028' },
  kernelLimitations: ['Two-variable mean-field reduction of a spiking attractor network; AMPA and GABA dynamics are assumed instantaneous.', 'Reaction times exclude sensory and motor delays.', 'Transfer-function constants a = 270 (V·nC)⁻¹, b = 108 Hz, d = 0.154 s and J_A,ext = 5.2×10⁻⁴ nA/Hz are fixed.'],
  run: runWW,
};

// ───────────────────────── MODEL-027 Kuramoto ─────────────────────────

const KUR_PARAMS: ParamSpec[] = [
  { key: 'K_Kuramoto', label: 'Global coupling strength', symbol: 'K', unit: 'rad/s', default: 4, min: 0, max: 100, step: 0.05, registryId: 'PARAM-079', description: 'Strength with which each oscillator is pulled toward its neighbours\' phases.', group: 'Coupling' },
  { key: 'f0_Kuramoto', label: 'Mean intrinsic frequency', symbol: 'f_0', unit: 'Hz', default: 10, min: 1, max: 80, step: 0.5, registryId: 'PARAM-080', description: 'Centre of the natural-frequency distribution.', group: 'Oscillators' },
  { key: 'gamma_Kuramoto', label: 'Frequency dispersion (Lorentzian half-width)', symbol: '\\gamma', unit: 'rad/s', default: 1, min: 0.1, max: 10, step: 0.05, registryId: 'PARAM-081', description: 'Half-width of the Lorentzian distribution of natural frequencies; critical coupling is 2γ.', group: 'Oscillators' },
  { key: 'N_osc', label: 'Number of oscillators', symbol: 'N', unit: '', default: 100, min: 2, max: 200, step: 1, integer: true, description: 'Network size (browser cap: 200).', group: 'Network' },
  { key: 'topology', label: 'Coupling topology', symbol: 'A_{ij}', unit: '', default: 0, min: 0, max: 5, step: 1, integer: true, description: 'Adjacency structure. All synthetic topologies are algorithmically generated.', group: 'Network', options: GRAPH_KIND_OPTIONS },
  { key: 'delay_ms', label: 'Uniform coupling delay', symbol: '\\tau', unit: 'ms', default: 0, min: 0, max: 50, step: 0.5, description: 'Conduction delay applied to every connection.', group: 'Coupling' },
  { key: 'sigma_K', label: 'Phase noise', symbol: '\\sigma', unit: 'rad/√s', default: 0, min: 0, max: 5, step: 0.05, description: 'Amplitude of independent white phase noise.', group: 'Oscillators' },
  { key: 'freq_dist', label: 'Frequency sampling', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Deterministic quantiles suppress finite-size sampling noise; random sampling uses the seed.', group: 'Oscillators', options: [{ value: 0, label: 'Lorentzian quantiles (deterministic)' }, { value: 1, label: 'Lorentzian random draws (seeded)' }] },
];

function runKuramoto(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(KUR_PARAMS, cfg.params);
  const K = p('K_Kuramoto'), f0 = p('f0_Kuramoto'), gamma = p('gamma_Kuramoto'), N = Math.max(2, Math.min(200, Math.round(p('N_osc'))));
  const topo = Math.round(p('topology')), delay = p('delay_ms'), sigma = p('sigma_K');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs, h = dt / 1000;
  const rng = new Rng(cfg.seed);
  const w0 = 2 * Math.PI * f0;
  const omega = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const q = p('freq_dist') >= 0.5 ? rng.next() : (i + 0.5) / N;
    omega[i] = w0 + gamma * Math.tan(Math.PI * (q - 0.5));
  }
  const theta = new Float64Array(N);
  for (let i = 0; i < N; i++) theta[i] = 2 * Math.PI * rng.next();
  const allToAll = topo === 0;
  const graph = allToAll ? null : generateGraph(topo, N, cfg.seed);
  const A = graph?.weights ?? null;
  const delaySteps = Math.round(delay / dt);
  const stochastic = sigma > 0 || delaySteps > 0 || cfg.solver === 'SOLVER-EULER-MARUYAMA';
  const hist = delaySteps > 0 ? new Float64Array((delaySteps + 1) * N) : null;
  if (hist) for (let s = 0; s <= delaySteps; s++) hist.set(theta, s * N);
  const sinT = new Float64Array(N), cosT = new Float64Array(N);
  const coupling = (th: Float64Array, src: Float64Array, d: Float64Array) => {
    // dθ_i/dt = ω_i + (K/N) Σ_j A_ij sin(θ_j − θ_i), via sin(a − b) = sin a cos b − cos a sin b.
    let ss = 0, cs = 0;
    for (let j = 0; j < N; j++) { sinT[j] = Math.sin(src[j]!); cosT[j] = Math.cos(src[j]!); ss += sinT[j]!; cs += cosT[j]!; }
    for (let i = 0; i < N; i++) {
      let s = ss, c = cs;
      if (A) { s = 0; c = 0; const row = i * N; for (let j = 0; j < N; j++) { const a = A[row + j]!; if (a !== 0) { s += a * sinT[j]!; c += a * cosT[j]!; } } }
      d[i] = omega[i]! + (K / N) * (s * Math.cos(th[i]!) - c * Math.sin(th[i]!));
    }
  };
  const k1 = new Float64Array(N), k2 = new Float64Array(N), k3 = new Float64Array(N), k4 = new Float64Array(N), tmp = new Float64Array(N);
  const rec = makeRecorder(['R', 'psi', 'mean_field'], nSteps);
  const frames = Math.min(300, nSteps + 1), frameStride = Math.max(1, Math.floor(nSteps / (frames - 1 || 1)));
  const phaseMap = new Float64Array(N * frames);
  let frame = 0;
  const order = (): [number, number] => {
    let sr = 0, si = 0;
    for (let i = 0; i < N; i++) { sr += Math.cos(theta[i]!); si += Math.sin(theta[i]!); }
    return [Math.hypot(sr, si) / N, Math.atan2(si, sr)];
  };
  const snap = (j: number, t: number) => { const [R, psi] = order(); rec.t[j] = t; rec.s.R![j] = R; rec.s.psi![j] = psi; rec.s.mean_field![j] = R * Math.cos(psi); rec.written = j + 1; };
  const writeFrame = () => { if (frame < frames) { for (let i = 0; i < N; i++) phaseMap[i * frames + frame] = Math.sin(theta[i]!); frame++; } };
  snap(0, 0); writeFrame();
  const sq = Math.sqrt(h);
  for (let i = 0; i < nSteps; i++) {
    if (stochastic) {
      const src = hist ? hist.subarray(((i % (delaySteps + 1)) * N), ((i % (delaySteps + 1)) + 1) * N) : theta;
      coupling(theta, src, k1);
      for (let q = 0; q < N; q++) theta[q] = theta[q]! + h * k1[q]! + (sigma > 0 ? sigma * sq * rng.normal() : 0);
      if (hist) hist.set(theta, (i % (delaySteps + 1)) * N);
    } else {
      coupling(theta, theta, k1);
      for (let q = 0; q < N; q++) tmp[q] = theta[q]! + 0.5 * h * k1[q]!;
      coupling(tmp, tmp, k2);
      for (let q = 0; q < N; q++) tmp[q] = theta[q]! + 0.5 * h * k2[q]!;
      coupling(tmp, tmp, k3);
      for (let q = 0; q < N; q++) tmp[q] = theta[q]! + h * k3[q]!;
      coupling(tmp, tmp, k4);
      for (let q = 0; q < N; q++) theta[q] = theta[q]! + (h / 6) * (k1[q]! + 2 * k2[q]! + 2 * k3[q]! + k4[q]!);
    }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) snap(j, k * dt); }
    if (k % frameStride === 0) writeFrame();
    if (ctx?.onProgress && k % 2000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  const cols = frame;
  out.matrices.phase_map = { rows: N, cols, data: cols === frames ? phaseMap : Float64Array.from({ length: N * cols }, (_, q) => phaseMap[Math.floor(q / cols) * frames + (q % cols)]!) };
  if (graph) out.matrices.adjacency = { rows: N, cols: N, data: Float64Array.from(graph.weights) };
  const half = Math.floor(t.length / 2);
  const Kc = 2 * gamma;
  out.metrics.orderParameterMean = meanOf(series.R!, half);
  out.metrics.orderParameterFinal = series.R![t.length - 1]!;
  out.metrics.criticalCoupling = Kc;
  out.metrics.orderParameterPredicted = allToAll && delaySteps === 0 && sigma === 0 ? (K > Kc ? Math.sqrt(1 - Kc / K) : 0) : NaN;
  out.metrics.finiteSizeFloor = 1 / Math.sqrt(N);
  out.curves.final_phases = { x: Float64Array.from({ length: N }, (_, i) => i), y: Float64Array.from(theta, (v) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) };
  out.curves.natural_frequencies = { x: Float64Array.from({ length: N }, (_, i) => i), y: Float64Array.from(omega, (w) => w / (2 * Math.PI)) };
  out.notes.push(
    allToAll && delaySteps === 0 && sigma === 0
      ? `Mean-field theory: K_c = 2γ = ${Kc.toFixed(2)} rad/s; predicted R = ${(out.metrics.orderParameterPredicted).toFixed(3)}, simulated ⟨R⟩ = ${out.metrics.orderParameterMean.toFixed(3)} (finite-size floor ≈ ${(1 / Math.sqrt(N)).toFixed(3)}).`
      : `Simulated ⟨R⟩ = ${out.metrics.orderParameterMean.toFixed(3)}. The closed-form K_c = 2γ prediction applies only to all-to-all coupling without delay or noise.`,
  );
  if (graph) out.notes.push(`Coupling graph provenance: ${graph.provenance} (${graph.description}).`);
  return out;
}

export const MODEL_027: ModelDefinition = {
  id: 'MODEL-027',
  name: 'Kuramoto Phase Oscillators',
  equations: [
    '\\frac{d\\theta_i}{dt} = \\omega_i + \\frac{K}{N}\\sum_{j=1}^{N} A_{ij}\\,\\sin\\!\\left(\\theta_j(t - \\tau_{ij}) - \\theta_i(t)\\right) + \\sigma\\,\\xi_i(t)',
    'R(t)\\,e^{i\\Psi(t)} = \\frac{1}{N}\\sum_{j=1}^{N} e^{i\\theta_j(t)}',
    'K_c = 2\\gamma, \\qquad R = \\sqrt{1 - K_c / K} \\;\\; (K > K_c,\\; \\text{all-to-all, Lorentzian } g(\\omega))',
  ],
  params: KUR_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-RK4', 'SOLVER-EULER-MARUYAMA'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.5, minDtMs: 0.05, maxSafeDtMs: 2.0, defaultDurationMs: 10000, maxDurationMs: 30000,
  stochastic: true,
  views: [
    { kind: 'traces', title: 'Order parameter R(t)', yLabel: 'R', series: [{ key: 'R', label: 'R', unit: '', meaning: 'Kuramoto order parameter: 0 = incoherent phases, 1 = perfect synchrony.' }] },
    { kind: 'matrix', title: 'Oscillator phases sin θᵢ(t)', key: 'phase_map', xLabel: 'time →', yLabel: 'oscillator (sorted by natural frequency)', diverging: true, meaning: 'Phase of every oscillator over time; vertical stripes indicate phase locking.' },
    { kind: 'traces', title: 'Mean field R cos Ψ', yLabel: 'amplitude', series: [{ key: 'mean_field', label: 'R cos Ψ', unit: '', meaning: 'Real part of the complex order parameter: a population-signal proxy that oscillates when the network synchronizes.' }] },
    { kind: 'curve', title: 'Natural frequencies', xLabel: 'oscillator index', yLabel: 'f (Hz)', meaning: 'Intrinsic frequency assigned to each oscillator.', curves: [{ key: 'natural_frequencies', label: 'ωᵢ / 2π', points: true }] },
  ],
  metrics: [
    { key: 'orderParameterMean', label: 'Mean order parameter', unit: '', description: 'R averaged over the second half of the run.', analyticId: 'ANALYTIC-015', digits: 4 },
    { key: 'orderParameterPredicted', label: 'Predicted R', unit: '', description: '√(1 − K_c/K) from mean-field theory (all-to-all, no delay, no noise).', digits: 4 },
    { key: 'criticalCoupling', label: 'Critical coupling K_c', unit: 'rad/s', description: 'Onset of macroscopic synchronization, 2γ.' },
    { key: 'finiteSizeFloor', label: 'Finite-size floor', unit: '', description: 'Expected R ≈ N^{-1/2} for incoherent phases.', digits: 4 },
  ],
  presets: [
    { id: 'sync', label: 'Above critical coupling (K = 2 K_c)', description: 'Partial synchronization, R ≈ 0.71.', experimentId: 'EXP-037' },
    { id: 'incoh', label: 'Below critical coupling (K = 0.5 K_c)', description: 'Incoherent state, R at the finite-size floor.', params: { K_Kuramoto: 1 }, experimentId: 'EXP-037' },
    { id: 'random', label: 'Sparse random coupling graph', description: 'Synthetic Erdős–Rényi graph (p = 0.1): with K scaled by N/⟨k⟩ the sparse network synchronizes much like the all-to-all one.', params: { topology: 3, K_Kuramoto: 40, N_osc: 100 } },
    { id: 'ring', label: 'Ring lattice: local coupling', description: 'Nearest-neighbour coupling cannot produce global order with heterogeneous frequencies, however strong.', params: { topology: 1, K_Kuramoto: 100, N_osc: 100 } },
    { id: 'delay', label: 'Conduction delay', description: 'A uniform 10 ms delay shifts the collective frequency and lowers coherence.', params: { delay_ms: 10, K_Kuramoto: 6 } },
  ],
  sweep: { paramKey: 'K_Kuramoto', from: 1, to: 6, steps: 11, metricKey: 'orderParameterMean', experimentId: 'EXP-037' },
  kernelLimitations: ['Phase-only description: oscillation amplitude is not a dynamical variable.', 'A single uniform delay is supported; distance-dependent delays are used only in the Digital Twin connectome experiment.', 'With delay or noise the integrator is first-order (Euler–Maruyama).'],
  run: runKuramoto,
};
