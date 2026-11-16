// MODEL-011 exponential current synapse, MODEL-012 alpha conductance, MODEL-013 bi-exponential AMPA/GABA_A,
// MODEL-014 NMDA Mg²⁺ block, MODEL-015 gap junction, MODEL-016 Tsodyks–Markram short-term plasticity.
// Specification: docs/06-computational-models/SYNAPTIC_MODELS.md. Units: nS × mV = pA.
import { DIVERGENCE_NOTE } from '../core/odeRun';
import { curveFrom, diverged, finishRecorder, linspace, makeRecorder, maxOf, meanOf, minOf, paramReader, spikeMetrics, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import { makeStimulus } from '../core/stimulus';
import type { ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';

const TRAIN_PARAMS: ParamSpec[] = [
  { key: 'pre_start', label: 'First presynaptic spike', symbol: 't_0', unit: 'ms', default: 10, min: 0, max: 500, step: 1, description: 'Time of the first presynaptic action potential.', group: 'Presynaptic train' },
  { key: 'pre_rate', label: 'Presynaptic rate', symbol: 'f_{pre}', unit: 'Hz', default: 0, min: 0, max: 500, step: 1, description: 'Rate of the presynaptic train; 0 delivers a single spike.', group: 'Presynaptic train' },
  { key: 'pre_count', label: 'Number of spikes', symbol: 'n_{sp}', unit: '', default: 1, min: 1, max: 2000, step: 1, integer: true, description: 'Number of presynaptic spikes in the train.', group: 'Presynaptic train' },
  { key: 'pre_poisson', label: 'Train statistics', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Regular or seeded Poisson spike timing.', group: 'Presynaptic train', options: [{ value: 0, label: 'Regular intervals' }, { value: 1, label: 'Poisson (seeded)' }] },
];

export function presynTrain(p: (k: string) => number, seed: number, durationMs: number): number[] {
  const start = p('pre_start'), rate = p('pre_rate'), count = Math.round(p('pre_count'));
  if (rate <= 0) return start < durationMs ? [start] : [];
  const out: number[] = [];
  if (p('pre_poisson') >= 0.5) {
    const rng = new Rng(seed ^ 0x2545f491);
    let t = start;
    while (out.length < count && t < durationMs) {
      out.push(t);
      t += (-Math.log(1 - rng.next()) * 1000) / rate;
    }
  } else {
    for (let k = 0; k < count; k++) {
      const t = start + (k * 1000) / rate;
      if (t >= durationMs) break;
      out.push(t);
    }
  }
  return out;
}

const POST_PARAMS: ParamSpec[] = [
  { key: 'C_post', label: 'Postsynaptic capacitance', symbol: 'C_m', unit: 'pF', default: 200, min: 50, max: 600, step: 5, description: 'Capacitance of the passive postsynaptic membrane.', group: 'Postsynaptic cell' },
  { key: 'gL_post', label: 'Postsynaptic leak conductance', symbol: 'g_L', unit: 'nS', default: 10, min: 1, max: 50, step: 0.5, description: 'Leak conductance of the passive postsynaptic membrane.', group: 'Postsynaptic cell' },
  { key: 'EL_post', label: 'Postsynaptic resting potential', symbol: 'E_L', unit: 'mV', default: -70, min: -85, max: -55, step: 0.5, description: 'Resting potential of the postsynaptic membrane.', group: 'Postsynaptic cell' },
];
const CLAMP_PARAMS: ParamSpec[] = [
  { key: 'clamp_mode', label: 'Recording mode', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Voltage clamp holds V fixed and reports current; current clamp lets the passive membrane respond.', group: 'Postsynaptic cell', options: [{ value: 0, label: 'Voltage clamp' }, { value: 1, label: 'Current clamp (free membrane)' }] },
  { key: 'V_hold', label: 'Holding potential', symbol: 'V_{hold}', unit: 'mV', default: -70, min: -100, max: 50, step: 1, description: 'Clamped membrane potential in voltage-clamp mode.', group: 'Postsynaptic cell' },
];

/** Events (arrival times) falling in [t, t + dt). */
function makeEventCursor(times: number[]) {
  let idx = 0;
  return (t: number, dt: number, onEvent: (tEv: number) => void) => {
    while (idx < times.length && times[idx]! < t + dt - 1e-12) {
      onEvent(Math.max(t, times[idx]!));
      idx++;
    }
  };
}

// ───────────────────────── MODEL-011 ─────────────────────────

const M11_PARAMS: ParamSpec[] = [
  { key: 'tau_syn_cuba', label: 'Synaptic decay time constant', symbol: '\\tau_{syn}', unit: 'ms', default: 5, min: 0.5, max: 50, step: 0.5, registryId: 'PARAM-038', description: 'Exponential decay of the postsynaptic current (5 ms excitatory, 10 ms inhibitory are typical).', group: 'Synapse' },
  { key: 'w_syn_cuba', label: 'Postsynaptic current amplitude', symbol: 'w', unit: 'pA', default: 50, min: -200, max: 200, step: 1, registryId: 'PARAM-039', description: 'Peak current per presynaptic spike; positive depolarizes, negative hyperpolarizes.', group: 'Synapse' },
  { key: 'delay', label: 'Axonal delay', symbol: '\\tau_d', unit: 'ms', default: 1.5, min: 0, max: 10, step: 0.1, description: 'Conduction and synaptic delay between presynaptic spike and current onset.', group: 'Synapse' },
  ...TRAIN_PARAMS, ...POST_PARAMS,
];

function runM11(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M11_PARAMS, cfg.params);
  const tau = p('tau_syn_cuba'), w = p('w_syn_cuba'), delay = p('delay');
  const C = p('C_post'), gL = p('gL_post'), EL = p('EL_post');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const pre = presynTrain(p, cfg.seed, cfg.durationMs);
  const cursor = makeEventCursor(pre.map((t) => t + delay));
  const rec = makeRecorder(['s', 'I_syn', 'V'], nSteps);
  let s = cfg.initial.s ?? 0, V = EL;
  const exact = cfg.solver === 'SOLVER-EXACT-LIF';
  const x = dt / tau;
  const decay = exact ? Math.exp(-x) : 1 - x + (x * x) / 2 - (x * x * x) / 6 + (x * x * x * x) / 24;
  const halfDecay = Math.exp(-0.5 * x);
  const fV = (v: number, ss: number) => (-gL * (v - EL) + w * ss) / C;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  let charge = 0;
  rec.s.V![0] = V; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    let jump = 0;
    cursor(t, dt, (tEv) => { jump += Math.exp(-(t + dt - tEv) / tau); });
    const s0 = s, sEnd = s * decay + jump, sMid = s0 * halfDecay + 0.5 * jump;
    const k1 = fV(V, s0), k2 = fV(V + 0.5 * dt * k1, sMid), k3 = fV(V + 0.5 * dt * k2, sMid), k4 = fV(V + dt * k3, sEnd);
    V += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    s = sEnd;
    charge += w * 0.5 * (s0 + sEnd) * dt;
    if (diverged(V)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) { rec.t[j] = k * dt; rec.s.s![j] = s; rec.s.I_syn![j] = w * s; rec.s.V![j] = V; rec.written = j + 1; } }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const dev = Float64Array.from(series.V!, (v) => v - EL);
  out.metrics.peakCurrentPa = w >= 0 ? maxOf(series.I_syn!) : minOf(series.I_syn!);
  out.metrics.peakPspMv = w >= 0 ? maxOf(dev) : minOf(dev);
  out.metrics.meanDepolarizationMv = meanOf(dev);
  out.metrics.chargeTransferFc = charge;
  out.metrics.analyticChargePerSpikeFc = w * tau;
  out.metrics.presynapticSpikes = pre.length;
  out.curves.presynapticSpikes = { x: Float64Array.from(pre), y: new Float64Array(pre.length) };
  out.notes.push('Current-based synapse: the injected current is independent of membrane potential, so responses sum linearly and never saturate at a reversal potential.');
  return out;
}

export const MODEL_011: ModelDefinition = {
  id: 'MODEL-011',
  name: 'Exponential Current-Based Synapse',
  equations: [
    'I_{syn}(t) = \\sum_j w_j\\, s_j(t)',
    '\\frac{ds_j}{dt} = -\\frac{s_j}{\\tau_{syn}} + \\sum_f \\delta\\!\\left(t - t_j^{(f)} - \\tau_d\\right)',
    's(t + \\Delta t) = s(t)\\, e^{-\\Delta t / \\tau_{syn}} \\quad \\text{(exact update)}',
  ],
  params: M11_PARAMS,
  initial: [{ key: 's', label: 'Synaptic trace s(0)', unit: '', default: 0 }],
  stimulus: null,
  solvers: ['SOLVER-EXACT-LIF', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-EXACT-LIF', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.5, defaultDurationMs: 100, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Postsynaptic current', yLabel: 'I_syn (pA)', series: [{ key: 'I_syn', label: 'I_syn', unit: 'pA', meaning: 'Synaptic current w·s(t) injected into the postsynaptic cell.' }] },
    { kind: 'traces', title: 'Postsynaptic potential', yLabel: 'V (mV)', series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Response of a passive membrane to the synaptic current.' }] },
    { kind: 'traces', title: 'Synaptic gating trace', yLabel: 's', series: [{ key: 's', label: 's', unit: '', meaning: 'Dimensionless trace that jumps by 1 at each delayed presynaptic spike and decays exponentially.' }] },
  ],
  metrics: [
    { key: 'peakCurrentPa', label: 'Peak synaptic current', unit: 'pA', description: 'Largest postsynaptic current during the run.' },
    { key: 'peakPspMv', label: 'Peak postsynaptic potential', unit: 'mV', description: 'Largest deviation of the membrane from rest.' },
    { key: 'chargeTransferFc', label: 'Charge transfer', unit: 'fC', description: 'Time integral of the synaptic current (pA·ms = fC).' },
    { key: 'analyticChargePerSpikeFc', label: 'Analytical charge per spike', unit: 'fC', description: 'w · τ_syn for one isolated spike.' },
    { key: 'meanDepolarizationMv', label: 'Mean depolarization', unit: 'mV', description: 'Time-averaged deviation from rest; grows linearly with presynaptic rate for current-based synapses.' },
  ],
  presets: [
    { id: 'single', label: 'Single EPSC', description: 'One presynaptic spike.' },
    { id: 'ipsc', label: 'Single IPSC (10 ms decay)', description: 'Negative amplitude with slower decay.', params: { w_syn_cuba: -40, tau_syn_cuba: 10 } },
    { id: 'summation', label: 'Temporal summation (100 Hz × 10)', description: 'Linear summation of successive currents.', params: { pre_rate: 100, pre_count: 10 }, durationMs: 200, experimentId: 'EXP-021' },
    { id: 'poisson', label: 'Poisson bombardment (400 Hz)', description: 'Linear, non-saturating depolarization.', params: { pre_rate: 400, pre_count: 2000, pre_poisson: 1, w_syn_cuba: 20 }, durationMs: 1000, experimentId: 'EXP-021' },
  ],
  sweep: { paramKey: 'pre_rate', from: 50, to: 1000, steps: 11, metricKey: 'meanDepolarizationMv', experimentId: 'EXP-021' },
  kernelLimitations: ['No driving-force dependence: cannot show saturation or shunting inhibition.', 'Instantaneous rise.'],
  run: runM11,
};

// ───────────────────────── MODEL-012 ─────────────────────────

const M12_PARAMS: ParamSpec[] = [
  { key: 'g_max_alpha', label: 'Peak conductance', symbol: '\\bar{g}_{syn}', unit: 'nS', default: 2, min: 0.1, max: 20, step: 0.1, registryId: 'PARAM-040', description: 'Conductance reached at the peak of a single alpha-function response.', group: 'Synapse' },
  { key: 'tau_alpha', label: 'Time-to-peak constant', symbol: '\\tau_\\alpha', unit: 'ms', default: 2, min: 0.2, max: 20, step: 0.1, registryId: 'PARAM-041', description: 'Single time constant governing both rise and decay; the response peaks τ_α after onset.', group: 'Synapse' },
  { key: 'E_rev', label: 'Reversal potential', symbol: 'E_{rev}', unit: 'mV', default: 0, min: -90, max: 20, step: 1, description: '0 mV for excitatory, about −75 mV for inhibitory synapses.', group: 'Synapse' },
  { key: 'delay', label: 'Synaptic delay', symbol: '\\tau_d', unit: 'ms', default: 0, min: 0, max: 10, step: 0.1, description: 'Delay between presynaptic spike and conductance onset.', group: 'Synapse' },
  ...TRAIN_PARAMS, ...CLAMP_PARAMS, ...POST_PARAMS,
];

function runM12(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M12_PARAMS, cfg.params);
  const gMax = p('g_max_alpha'), tau = p('tau_alpha'), Erev = p('E_rev'), delay = p('delay');
  const current = p('clamp_mode') >= 0.5, Vhold = p('V_hold');
  const C = p('C_post'), gL = p('gL_post'), EL = p('EL_post');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const pre = presynTrain(p, cfg.seed, cfg.durationMs);
  const cursor = makeEventCursor(pre.map((t) => t + delay));
  const rec = makeRecorder(['g_syn', 'z', 'I_syn', 'V'], nSteps);
  let z = cfg.initial.z ?? 0, g = cfg.initial.g_syn ?? 0, V = current ? EL : Vhold;
  const fz = (zz: number) => -zz / tau;
  const fg = (zz: number, gg: number) => (gMax * zz - gg) / tau;
  const fV = (v: number, gg: number) => (current ? (-gL * (v - EL) - gg * (v - Erev)) / C : 0);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.V![0] = V; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    cursor(t, dt, () => { z += Math.E; });
    if (cfg.solver === 'SOLVER-FE') {
      const dz = fz(z), dg = fg(z, g), dV = fV(V, g);
      z += dt * dz; g += dt * dg; V += dt * dV;
    } else {
      const k1z = fz(z), k1g = fg(z, g), k1v = fV(V, g);
      const z2 = z + 0.5 * dt * k1z, g2 = g + 0.5 * dt * k1g, v2 = V + 0.5 * dt * k1v;
      const k2z = fz(z2), k2g = fg(z2, g2), k2v = fV(v2, g2);
      const z3 = z + 0.5 * dt * k2z, g3 = g + 0.5 * dt * k2g, v3 = V + 0.5 * dt * k2v;
      const k3z = fz(z3), k3g = fg(z3, g3), k3v = fV(v3, g3);
      const z4 = z + dt * k3z, g4 = g + dt * k3g, v4 = V + dt * k3v;
      const k4z = fz(z4), k4g = fg(z4, g4), k4v = fV(v4, g4);
      z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
      g += (dt / 6) * (k1g + 2 * k2g + 2 * k3g + k4g);
      V += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    }
    if (diverged(V) || diverged(g)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) { rec.t[j] = k * dt; rec.s.g_syn![j] = g; rec.s.z![j] = z; rec.s.I_syn![j] = g * (V - Erev); rec.s.V![j] = V; rec.written = j + 1; } }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  let peak = -Infinity, at = 0;
  for (let i = 0; i < series.g_syn!.length; i++) if (series.g_syn![i]! > peak) { peak = series.g_syn![i]!; at = i; }
  out.metrics.peakConductanceNs = peak;
  out.metrics.timeToPeakMs = pre.length ? t[at]! - (pre[0]! + delay) : NaN;
  out.metrics.peakCurrentPa = Erev > (current ? EL : Vhold) ? minOf(series.I_syn!) : maxOf(series.I_syn!);
  const dev = Float64Array.from(series.V!, (v) => v - (current ? EL : Vhold));
  out.metrics.peakPspMv = Math.abs(maxOf(dev)) >= Math.abs(minOf(dev)) ? maxOf(dev) : minOf(dev);
  out.metrics.meanDepolarizationMv = meanOf(dev);
  const t0 = (pre[0] ?? 0) + delay;
  out.curves.kernel_analytic = curveFrom(linspace(t0, Math.min(cfg.durationMs, t0 + 12 * tau), 200), (tt) => { const s = (tt - t0) / tau; return gMax * s * Math.exp(1 - s); });
  out.curves.presynapticSpikes = { x: Float64Array.from(pre), y: new Float64Array(pre.length) };
  return out;
}

export const MODEL_012: ModelDefinition = {
  id: 'MODEL-012',
  name: 'Alpha-Function Conductance Synapse',
  equations: [
    'I_{syn}(t) = g_{syn}(t)\\,(V(t) - E_{rev})',
    'g_{syn}(t) = \\bar{g}_{syn}\\,\\frac{t - t_0}{\\tau_\\alpha}\\,\\exp\\!\\left(1 - \\frac{t - t_0}{\\tau_\\alpha}\\right)\\Theta(t - t_0)',
    '\\frac{dz}{dt} = -\\frac{z}{\\tau_\\alpha} + e\\sum_f \\delta\\!\\left(t - t^{(f)} - \\tau_d\\right), \\qquad \\frac{dg_{syn}}{dt} = \\frac{\\bar{g}_{syn}\\, z - g_{syn}}{\\tau_\\alpha}',
  ],
  params: M12_PARAMS,
  initial: [
    { key: 'z', label: 'Cascade state z(0)', unit: '', default: 0 },
    { key: 'g_syn', label: 'Conductance g_syn(0)', unit: 'nS', default: 0 },
  ],
  stimulus: null,
  solvers: ['SOLVER-RK4', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.25, defaultDurationMs: 50, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'curve', title: 'Conductance: closed-form kernel (first spike)', xLabel: 't (ms)', yLabel: 'g (nS)', meaning: 'Analytical alpha function for the first presynaptic spike.', curves: [{ key: 'kernel_analytic', label: 'Analytical alpha kernel' }] },
    { kind: 'traces', title: 'Synaptic conductance', yLabel: 'g_syn (nS)', series: [{ key: 'g_syn', label: 'g_syn', unit: 'nS', meaning: 'Postsynaptic conductance from the two-state cascade.' }] },
    { kind: 'traces', title: 'Synaptic current (outward positive)', yLabel: 'I_syn (pA)', series: [{ key: 'I_syn', label: 'I_syn', unit: 'pA', meaning: 'g_syn (V − E_rev); negative values are inward and depolarizing.' }] },
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Clamped or free postsynaptic membrane potential.' }] },
  ],
  metrics: [
    { key: 'peakConductanceNs', label: 'Peak conductance', unit: 'nS', description: 'Maximum of g_syn(t); equals ḡ_syn for an isolated spike.', digits: 4 },
    { key: 'timeToPeakMs', label: 'Time to peak', unit: 'ms', description: 'Delay from conductance onset to its maximum; equals τ_α for an isolated spike (VAL-SYN-001).', digits: 3 },
    { key: 'peakCurrentPa', label: 'Peak synaptic current', unit: 'pA', description: 'Largest-magnitude synaptic current.' },
    { key: 'peakPspMv', label: 'Peak postsynaptic potential', unit: 'mV', description: 'Largest deviation of V from baseline (current clamp).' },
  ],
  presets: [
    { id: 'epsc', label: 'Excitatory conductance (voltage clamp)', description: 'Single spike at t₀ = 10 ms.' },
    { id: 'epsp', label: 'EPSP in current clamp', description: 'Free membrane integrates the conductance.', params: { clamp_mode: 1 }, durationMs: 100 },
    { id: 'ipsp', label: 'Inhibitory synapse near reversal', description: 'E_rev = −75 mV: small driving force, mostly shunting.', params: { clamp_mode: 1, E_rev: -75, g_max_alpha: 5, tau_alpha: 5 }, durationMs: 100 },
    { id: 'train', label: 'Summation at 200 Hz', description: 'Overlapping alpha functions superimpose.', params: { pre_rate: 200, pre_count: 8 }, durationMs: 100 },
  ],
  sweep: { paramKey: 'tau_alpha', from: 0.5, to: 10, steps: 11, metricKey: 'timeToPeakMs' },
  kernelLimitations: ['Rise and decay share one time constant; receptor-specific kinetics need MODEL-013.', 'Conductance does not saturate with high presynaptic rates.'],
  run: runM12,
};

// ───────────────────────── MODEL-013 ─────────────────────────

const M13_PARAMS: ParamSpec[] = [
  { key: 'tau_r_AMPA', label: 'AMPA rise time', symbol: '\\tau_{r,AMPA}', unit: 'ms', default: 0.4, min: 0.1, max: 2, step: 0.05, registryId: 'PARAM-042', description: 'Rise time constant of the AMPA receptor conductance.', group: 'AMPA' },
  { key: 'tau_d_AMPA', label: 'AMPA decay time', symbol: '\\tau_{d,AMPA}', unit: 'ms', default: 2, min: 0.5, max: 10, step: 0.1, registryId: 'PARAM-043', description: 'Decay time constant of the AMPA receptor conductance.', group: 'AMPA' },
  { key: 'g_AMPA', label: 'AMPA peak conductance', symbol: '\\bar{g}_{AMPA}', unit: 'nS', default: 1, min: 0, max: 20, step: 0.1, description: 'Peak conductance of one AMPA response.', group: 'AMPA' },
  { key: 'E_AMPA', label: 'AMPA reversal potential', symbol: 'E_{AMPA}', unit: 'mV', default: 0, min: -20, max: 20, step: 1, description: 'Mixed-cation reversal potential.', group: 'AMPA' },
  { key: 'tau_r_GABAA', label: 'GABA_A rise time', symbol: '\\tau_{r,GABA_A}', unit: 'ms', default: 0.5, min: 0.1, max: 3, step: 0.05, description: 'Rise time constant of the GABA_A receptor conductance.', group: 'GABA_A' },
  { key: 'tau_d_GABAA', label: 'GABA_A decay time', symbol: '\\tau_{d,GABA_A}', unit: 'ms', default: 8, min: 2, max: 30, step: 0.5, registryId: 'PARAM-044', description: 'Decay time constant of the GABA_A receptor conductance.', group: 'GABA_A' },
  { key: 'E_GABAA', label: 'GABA_A reversal potential', symbol: 'E_{GABA_A}', unit: 'mV', default: -75, min: -90, max: -55, step: 1, registryId: 'PARAM-045', description: 'Chloride reversal potential set by KCC2/NKCC1 transport.', group: 'GABA_A' },
  { key: 'g_GABA', label: 'GABA_A peak conductance', symbol: '\\bar{g}_{GABA_A}', unit: 'nS', default: 1, min: 0, max: 20, step: 0.1, description: 'Peak conductance of one GABA_A response (0 disables inhibition).', group: 'GABA_A' },
  { key: 'gaba_offset', label: 'GABA_A spike offset', symbol: '\\Delta t_{I}', unit: 'ms', default: 0, min: -20, max: 50, step: 0.5, description: 'Timing of inhibitory spikes relative to excitatory ones (positive = inhibition lags).', group: 'GABA_A' },
  ...TRAIN_PARAMS, ...CLAMP_PARAMS, ...POST_PARAMS,
];

/** Normalization giving unit peak for a single bi-exponential response (EQ-SYN-BIEXP). */
export function biexpNorm(tr: number, td: number): number {
  const r = tr / td;
  return 1 / (Math.pow(r, tr / (td - tr)) - Math.pow(r, td / (td - tr)));
}
export const biexpPeakTime = (tr: number, td: number) => ((tr * td) / (td - tr)) * Math.log(td / tr);

function runM13(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M13_PARAMS, cfg.params);
  const trA = p('tau_r_AMPA'), tdA = p('tau_d_AMPA'), gA = p('g_AMPA'), EA = p('E_AMPA');
  const trG = p('tau_r_GABAA'), tdG = p('tau_d_GABAA'), gG = p('g_GABA'), EG = p('E_GABAA'), off = p('gaba_offset');
  const current = p('clamp_mode') >= 0.5, Vhold = p('V_hold');
  const C = p('C_post'), gL = p('gL_post'), EL = p('EL_post');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const pre = presynTrain(p, cfg.seed, cfg.durationMs);
  const curA = makeEventCursor(pre);
  const curG = makeEventCursor(pre.map((t) => t + off).filter((t) => t >= 0));
  const nA = biexpNorm(trA, tdA), nG = biexpNorm(trG, tdG);
  const rec = makeRecorder(['g_AMPA', 'g_GABA', 'I_AMPA', 'I_GABA', 'V'], nSteps);
  let aA = cfg.initial.A ?? 0, bA = cfg.initial.B ?? 0, aG = 0, bG = 0, V = current ? EL : Vhold;
  const exact = cfg.solver === 'SOLVER-EXACT-LIF';
  const prop = (tau: number) => { const x = dt / tau; return exact ? Math.exp(-x) : 1 - x + (x * x) / 2 - (x * x * x) / 6 + (x * x * x * x) / 24; };
  const dAr = prop(trA), dAd = prop(tdA), dGr = prop(trG), dGd = prop(tdG);
  const fV = (v: number, ga: number, gg: number) => (current ? (-gL * (v - EL) - ga * (v - EA) - gg * (v - EG)) / C : 0);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.V![0] = V; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    let jA_r = 0, jA_d = 0, jG_r = 0, jG_d = 0;
    curA(t, dt, (te) => { jA_r += Math.exp(-(t + dt - te) / trA); jA_d += Math.exp(-(t + dt - te) / tdA); });
    curG(t, dt, (te) => { jG_r += Math.exp(-(t + dt - te) / trG); jG_d += Math.exp(-(t + dt - te) / tdG); });
    const ga0 = gA * nA * (bA - aA), gg0 = gG * nG * (bG - aG);
    aA = aA * dAr + jA_r; bA = bA * dAd + jA_d; aG = aG * dGr + jG_r; bG = bG * dGd + jG_d;
    const ga1 = gA * nA * (bA - aA), gg1 = gG * nG * (bG - aG);
    const gam = 0.5 * (ga0 + ga1), ggm = 0.5 * (gg0 + gg1);
    const k1 = fV(V, ga0, gg0), k2 = fV(V + 0.5 * dt * k1, gam, ggm), k3 = fV(V + 0.5 * dt * k2, gam, ggm), k4 = fV(V + dt * k3, ga1, gg1);
    V += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if (diverged(V)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.g_AMPA![j] = ga1; rec.s.g_GABA![j] = gg1; rec.s.I_AMPA![j] = ga1 * (V - EA); rec.s.I_GABA![j] = gg1 * (V - EG); rec.s.V![j] = V; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const argmax = (a: Float64Array) => { let m = -Infinity, q = 0; for (let i = 0; i < a.length; i++) if (a[i]! > m) { m = a[i]!; q = i; } return q; };
  const t0 = pre[0] ?? 0;
  out.metrics.peakGAmpaNs = maxOf(series.g_AMPA!);
  out.metrics.peakGGabaNs = maxOf(series.g_GABA!);
  out.metrics.ampaTimeToPeakMs = out.metrics.peakGAmpaNs > 0 ? t[argmax(series.g_AMPA!)]! - t0 : NaN;
  out.metrics.gabaTimeToPeakMs = out.metrics.peakGGabaNs > 0 ? t[argmax(series.g_GABA!)]! - (t0 + off) : NaN;
  out.metrics.ampaAnalyticPeakTimeMs = biexpPeakTime(trA, tdA);
  out.metrics.gabaAnalyticPeakTimeMs = biexpPeakTime(trG, tdG);
  const base = current ? EL : Vhold;
  const dev = Float64Array.from(series.V!, (v) => v - base);
  out.metrics.peakDepolarizationMv = maxOf(dev);
  out.metrics.peakHyperpolarizationMv = minOf(dev);
  out.metrics.meanDepolarizationMv = meanOf(dev);
  out.curves.presynapticSpikes = { x: Float64Array.from(pre), y: new Float64Array(pre.length) };
  if (current && gG > 0 && Math.abs(EG - EL) < 8) out.notes.push('GABA_A reversal lies close to rest: inhibition acts mainly by shunting (increasing conductance) rather than by hyperpolarizing.');
  return out;
}

export const MODEL_013: ModelDefinition = {
  id: 'MODEL-013',
  name: 'Bi-Exponential AMPA / GABA_A Synapse',
  equations: [
    'g_{syn}(t) = \\bar{g}_{syn}\\,\\mathcal{N}\\,(B(t) - A(t))',
    '\\frac{dA}{dt} = -\\frac{A}{\\tau_r} + \\sum_f \\delta(t - t^{(f)}), \\qquad \\frac{dB}{dt} = -\\frac{B}{\\tau_d} + \\sum_f \\delta(t - t^{(f)})',
    '\\mathcal{N} = \\left[\\left(\\tfrac{\\tau_r}{\\tau_d}\\right)^{\\frac{\\tau_r}{\\tau_d - \\tau_r}} - \\left(\\tfrac{\\tau_r}{\\tau_d}\\right)^{\\frac{\\tau_d}{\\tau_d - \\tau_r}}\\right]^{-1}, \\qquad t_{peak} = \\frac{\\tau_r \\tau_d}{\\tau_d - \\tau_r}\\ln\\frac{\\tau_d}{\\tau_r}',
    'I_{syn} = g_{AMPA}(V - E_{AMPA}) + g_{GABA_A}(V - E_{GABA_A})',
  ],
  params: M13_PARAMS,
  initial: [
    { key: 'A', label: 'Rise state A(0)', unit: '', default: 0 },
    { key: 'B', label: 'Decay state B(0)', unit: '', default: 0 },
  ],
  stimulus: null,
  solvers: ['SOLVER-EXACT-LIF', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-EXACT-LIF', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.25, defaultDurationMs: 60, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Receptor conductances', yLabel: 'g (nS)', series: [
      { key: 'g_AMPA', label: 'g_AMPA', unit: 'nS', meaning: 'AMPA receptor conductance: fast rise, fast decay.' },
      { key: 'g_GABA', label: 'g_GABA_A', unit: 'nS', meaning: 'GABA_A receptor chloride conductance: slower decay.' },
    ] },
    { kind: 'traces', title: 'Synaptic currents (outward positive)', yLabel: 'I (pA)', series: [
      { key: 'I_AMPA', label: 'I_AMPA', unit: 'pA', meaning: 'AMPA current; inward (negative) below 0 mV.' },
      { key: 'I_GABA', label: 'I_GABA_A', unit: 'pA', meaning: 'GABA_A current; outward (positive) above the chloride reversal potential.' },
    ] },
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Clamped or free postsynaptic membrane potential.' }] },
  ],
  metrics: [
    { key: 'peakGAmpaNs', label: 'Peak AMPA conductance', unit: 'nS', description: 'Maximum AMPA conductance; equals ḡ_AMPA for an isolated spike because of the normalization factor.', digits: 4 },
    { key: 'ampaTimeToPeakMs', label: 'AMPA time to peak', unit: 'ms', description: 'Measured latency of the AMPA conductance peak.', digits: 3 },
    { key: 'ampaAnalyticPeakTimeMs', label: 'AMPA analytical peak time', unit: 'ms', description: 'τ_r τ_d / (τ_d − τ_r) · ln(τ_d / τ_r).', digits: 3 },
    { key: 'peakGGabaNs', label: 'Peak GABA_A conductance', unit: 'nS', description: 'Maximum GABA_A conductance.', digits: 4 },
    { key: 'gabaTimeToPeakMs', label: 'GABA_A time to peak', unit: 'ms', description: 'Measured latency of the GABA_A conductance peak.', digits: 3 },
    { key: 'peakDepolarizationMv', label: 'Peak depolarization', unit: 'mV', description: 'Largest positive deviation from baseline.' },
    { key: 'meanDepolarizationMv', label: 'Mean depolarization', unit: 'mV', description: 'Time-averaged deviation from rest; saturates toward the reversal potential at high rates.' },
  ],
  presets: [
    { id: 'kinetics', label: 'AMPA vs GABA_A kinetics (voltage clamp at −60 mV)', description: 'Both receptors activated by the same spike.', params: { V_hold: -60 }, experimentId: 'EXP-022' },
    { id: 'epspIpsp', label: 'EPSP followed by IPSP (current clamp)', description: 'Inhibition lagging by 2 ms truncates the EPSP.', params: { clamp_mode: 1, g_AMPA: 3, g_GABA: 6, gaba_offset: 2 }, durationMs: 100, experimentId: 'EXP-022' },
    { id: 'saturation', label: 'Conductance saturation under bombardment', description: 'Depolarization saturates toward E_AMPA, unlike MODEL-011.', params: { clamp_mode: 1, g_GABA: 0, g_AMPA: 1, pre_rate: 400, pre_count: 2000, pre_poisson: 1 }, durationMs: 1000, experimentId: 'EXP-021' },
  ],
  sweep: { paramKey: 'pre_rate', from: 50, to: 1000, steps: 11, metricKey: 'meanDepolarizationMv', experimentId: 'EXP-021' },
  kernelLimitations: ['Linear summation of receptor activation: no receptor saturation or desensitization.', 'Fixed chloride reversal: activity-dependent chloride shifts are not modelled.'],
  run: runM13,
};

// ───────────────────────── MODEL-014 ─────────────────────────

const M14_PARAMS: ParamSpec[] = [
  { key: 'tau_d_NMDA', label: 'NMDA decay time', symbol: '\\tau_{d,NMDA}', unit: 'ms', default: 100, min: 20, max: 300, step: 1, registryId: 'PARAM-046', description: 'Slow decay of the NMDA receptor conductance.', group: 'NMDA receptor' },
  { key: 'Mg_out_NMDA', label: 'Extracellular magnesium', symbol: '[Mg^{2+}]_o', unit: 'mM', default: 1, min: 0, max: 4, step: 0.05, registryId: 'PARAM-047', description: 'Extracellular Mg²⁺ concentration; 0 removes the voltage-dependent block.', group: 'NMDA receptor' },
  { key: 'tau_r_NMDA', label: 'NMDA rise time', symbol: '\\tau_{r,NMDA}', unit: 'ms', default: 2, min: 0.5, max: 10, step: 0.1, description: 'Rise time constant of the NMDA conductance.', group: 'NMDA receptor' },
  { key: 'g_NMDA', label: 'NMDA peak conductance', symbol: '\\bar{g}_{NMDA}', unit: 'nS', default: 1, min: 0, max: 10, step: 0.05, description: 'Peak unblocked conductance of one response.', group: 'NMDA receptor' },
  { key: 'E_NMDA', label: 'NMDA reversal potential', symbol: 'E_{NMDA}', unit: 'mV', default: 0, min: -20, max: 20, step: 1, description: 'Mixed-cation reversal potential.', group: 'NMDA receptor' },
  ...TRAIN_PARAMS, ...CLAMP_PARAMS, ...POST_PARAMS,
];

/** Jahr–Stevens (1990) voltage-dependent Mg²⁺ unblock fraction (EQ-NMDA-MGBLOCK). */
export const mgUnblock = (V: number, mg: number) => 1 / (1 + (mg / 3.57) * Math.exp(-0.062 * V));

function runM14(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M14_PARAMS, cfg.params);
  const td = p('tau_d_NMDA'), mg = p('Mg_out_NMDA'), tr = p('tau_r_NMDA'), gN = p('g_NMDA'), EN = p('E_NMDA');
  const current = p('clamp_mode') >= 0.5, Vhold = p('V_hold');
  const C = p('C_post'), gL = p('gL_post'), EL = p('EL_post');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const pre = presynTrain(p, cfg.seed, cfg.durationMs);
  const cursor = makeEventCursor(pre);
  const norm = biexpNorm(tr, td);
  const rec = makeRecorder(['g_NMDA', 'B', 'I_NMDA', 'V', 'I_ext'], nSteps);
  let A = cfg.initial.A_NMDA ?? 0, B = cfg.initial.B_NMDA ?? 0, V = current ? EL : Vhold;
  const dr = Math.exp(-dt / tr), dd = Math.exp(-dt / td);
  const fV = (v: number, g: number, I: number) => (current ? (-gL * (v - EL) - g * mgUnblock(v, mg) * (v - EN) + I) / C : 0);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  let charge = 0;
  rec.s.V![0] = V; rec.s.B![0] = mgUnblock(V, mg); rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    let jr = 0, jd = 0;
    cursor(t, dt, (te) => { jr += Math.exp(-(t + dt - te) / tr); jd += Math.exp(-(t + dt - te) / td); });
    const g0 = gN * norm * (B - A);
    A = A * dr + jr; B = B * dd + jd;
    const g1 = gN * norm * (B - A), gm = 0.5 * (g0 + g1);
    const I0 = stim(t), I1 = stim(t + dt), Im = stim(t + 0.5 * dt);
    const k1 = fV(V, g0, I0), k2 = fV(V + 0.5 * dt * k1, gm, Im), k3 = fV(V + 0.5 * dt * k2, gm, Im), k4 = fV(V + dt * k3, g1, I1);
    V += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    const iN = g1 * mgUnblock(V, mg) * (V - EN);
    charge += iN * dt;
    if (diverged(V)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.g_NMDA![j] = g1; rec.s.B![j] = mgUnblock(V, mg); rec.s.I_NMDA![j] = iN; rec.s.V![j] = V; rec.s.I_ext![j] = I1; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const vs = linspace(-100, 60, 161);
  out.curves.iv_curve = curveFrom(vs, (v) => gN * mgUnblock(v, mg) * (v - EN));
  out.curves.iv_no_mg = curveFrom(vs, (v) => gN * (v - EN));
  out.curves.unblock = curveFrom(vs, (v) => mgUnblock(v, mg));
  let vMin = vs[0]!, iMin = Infinity;
  for (let i = 0; i < vs.length; i++) if (out.curves.iv_curve.y[i]! < iMin) { iMin = out.curves.iv_curve.y[i]!; vMin = vs[i]!; }
  out.metrics.peakInwardCurrentPa = minOf(series.I_NMDA!);
  out.metrics.chargeTransferFc = charge;
  out.metrics.unblockAtHold = mgUnblock(current ? EL : Vhold, mg);
  out.metrics.ivMinimumVoltageMv = vMin;
  out.metrics.ivSlopeAtMinus60 = gN * ((mgUnblock(-59, mg) * (-59 - EN) - mgUnblock(-61, mg) * (-61 - EN)) / 2);
  out.metrics.peakDepolarizationMv = maxOf(series.V!) - (current ? EL : Vhold);
  out.curves.presynapticSpikes = { x: Float64Array.from(pre), y: new Float64Array(pre.length) };
  out.notes.push(`Mg²⁺ block: ${(100 * (1 - out.metrics.unblockAtHold)).toFixed(1)}% of channels are blocked at the baseline potential. The I–V relation has negative slope conductance below ${vMin.toFixed(0)} mV.`);
  return out;
}

export const MODEL_014: ModelDefinition = {
  id: 'MODEL-014',
  name: 'NMDA Receptor with Mg²⁺ Block',
  equations: [
    'I_{NMDA}(V, t) = g_{NMDA}(t)\\,B(V)\\,(V - E_{NMDA})',
    'B(V) = \\frac{1}{1 + \\dfrac{[Mg^{2+}]_o}{3.57\\,\\text{mM}}\\exp(-0.062\\,\\text{mV}^{-1}\\,V)}',
    'g_{NMDA}(t) = \\bar{g}_{NMDA}\\,\\mathcal{N}\\,(B_d(t) - A_r(t)) \\quad \\text{(dual exponential, } \\tau_r, \\tau_d)',
  ],
  params: M14_PARAMS,
  initial: [
    { key: 'A_NMDA', label: 'Rise state A(0)', unit: '', default: 0 },
    { key: 'B_NMDA', label: 'Decay state B(0)', unit: '', default: 0 },
  ],
  stimulus: {
    label: 'Postsynaptic current injection', unit: 'pA', description: 'Depolarizing current into the postsynaptic cell (current-clamp mode) to relieve the Mg²⁺ block.',
    default: { kind: 'none', amplitude: 0 }, amplitudeRange: [-200, 800], kinds: ['none', 'step', 'pulse-train'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.25, defaultDurationMs: 400, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'curve', title: 'Peak NMDA current–voltage relation', xLabel: 'V (mV)', yLabel: 'I (pA) at peak conductance', meaning: 'J-shaped I–V curve: Mg²⁺ block produces a region of negative slope conductance at hyperpolarized potentials.', curves: [{ key: 'iv_curve', label: 'With Mg²⁺ block' }, { key: 'iv_no_mg', label: 'Ohmic (no Mg²⁺)', dashed: true }] },
    { kind: 'curve', title: 'Unblocked fraction B(V)', xLabel: 'V (mV)', yLabel: 'B(V)', meaning: 'Fraction of NMDA channels not blocked by Mg²⁺.', curves: [{ key: 'unblock', label: 'B(V)' }] },
    { kind: 'traces', title: 'NMDA current (outward positive)', yLabel: 'I_NMDA (pA)', series: [{ key: 'I_NMDA', label: 'I_NMDA', unit: 'pA', meaning: 'NMDA receptor current; inward (negative) current carries Na⁺ and Ca²⁺ into the spine.' }] },
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Postsynaptic membrane potential.' }] },
    { kind: 'traces', title: 'Conductance and unblock', yLabel: 'value', series: [
      { key: 'g_NMDA', label: 'g_NMDA (nS)', unit: 'nS', meaning: 'Glutamate-bound NMDA conductance before Mg²⁺ block.' },
      { key: 'B', label: 'B(V)', unit: '', meaning: 'Instantaneous unblocked fraction at the current membrane potential.' },
    ] },
  ],
  metrics: [
    { key: 'peakInwardCurrentPa', label: 'Peak inward current', unit: 'pA', description: 'Most negative NMDA current during the run.' },
    { key: 'chargeTransferFc', label: 'Charge transfer', unit: 'fC', description: 'Time integral of NMDA current; a proxy for Ca²⁺ entry.' },
    { key: 'unblockAtHold', label: 'Unblocked fraction at baseline', unit: '', description: 'B(V) at the holding or resting potential.', digits: 4 },
    { key: 'ivMinimumVoltageMv', label: 'Voltage of maximal inward current', unit: 'mV', description: 'Minimum of the I–V curve; below it the slope conductance is negative.' },
    { key: 'ivSlopeAtMinus60', label: 'Slope conductance at −60 mV', unit: 'nS', description: 'dI/dV at −60 mV; negative values confirm the negative-slope region (VAL-SYN-001).', digits: 4 },
  ],
  presets: [
    { id: 'rest', label: 'Presynaptic release at rest (−70 mV)', description: 'Glutamate alone: channel mostly blocked.', params: { V_hold: -70 }, experimentId: 'EXP-023' },
    { id: 'depol', label: 'Release while depolarized (−20 mV)', description: 'Coincident depolarization relieves the block.', params: { V_hold: -20 }, experimentId: 'EXP-023' },
    { id: 'coincidence', label: 'Coincidence detection (current clamp)', description: 'Presynaptic burst paired with postsynaptic depolarization.', params: { clamp_mode: 1, pre_rate: 50, pre_count: 5, pre_start: 60, g_NMDA: 3 }, stimulus: { kind: 'step', amplitude: 400, startMs: 50, durationMs: 150 }, durationMs: 500, experimentId: 'EXP-023' },
    { id: 'noMg', label: 'Magnesium-free solution', description: '[Mg²⁺]ₒ = 0: ohmic I–V relation.', params: { Mg_out_NMDA: 0 }, experimentId: 'EXP-023' },
  ],
  sweep: { paramKey: 'V_hold', from: -80, to: 40, steps: 13, metricKey: 'peakInwardCurrentPa', experimentId: 'EXP-023' },
  kernelLimitations: ['Mg²⁺ block is instantaneous; block/unblock kinetics are not modelled.', 'Ca²⁺ permeability and downstream signalling are not represented; charge transfer is only a proxy.', 'No glycine co-agonist dependence or receptor desensitization.'],
  run: runM14,
};

// ───────────────────────── MODEL-015 ─────────────────────────

const M15_PARAMS: ParamSpec[] = [
  { key: 'g_gap', label: 'Gap-junction conductance', symbol: 'g_{gap}', unit: 'nS', default: 1.5, min: 0, max: 10, step: 0.05, registryId: 'PARAM-048', description: 'Ohmic conductance of the connexin channel plaque coupling the two cells.', group: 'Coupling' },
  { key: 'I_cell2', label: 'Constant current to cell 2', symbol: 'I_2', unit: 'pA', default: 0, min: -200, max: 800, step: 5, description: 'Independent constant drive to the second cell.', group: 'Drive' },
  { key: 'C_m', label: 'Membrane capacitance', symbol: 'C_m', unit: 'pF', default: 200, min: 50, max: 600, step: 5, description: 'Capacitance of each cell.', group: 'Cells' },
  { key: 'g_L', label: 'Leak conductance', symbol: 'g_L', unit: 'nS', default: 10, min: 1, max: 50, step: 0.5, description: 'Leak conductance of each cell.', group: 'Cells' },
  { key: 'E_L', label: 'Leak reversal', symbol: 'E_L', unit: 'mV', default: -65, min: -85, max: -55, step: 0.5, description: 'Resting potential of each cell.', group: 'Cells' },
  { key: 'Delta_T', label: 'Spike slope factor', symbol: '\\Delta_T', unit: 'mV', default: 2, min: 0.5, max: 5, step: 0.1, description: 'Exponential spike-initiation sharpness of each cell.', group: 'Cells' },
  { key: 'V_T', label: 'Spike threshold', symbol: 'V_T', unit: 'mV', default: -50, min: -60, max: -40, step: 0.5, description: 'Effective spike threshold of each cell.', group: 'Cells' },
  { key: 'V_reset', label: 'Reset potential', symbol: 'V_{reset}', unit: 'mV', default: -62, min: -80, max: -52, step: 0.5, description: 'Post-spike reset potential.', group: 'Cells' },
  { key: 'tau_ref', label: 'Refractory period', symbol: '\\tau_{ref}', unit: 'ms', default: 1, min: 0, max: 5, step: 0.1, description: 'Absolute refractory period of each cell.', group: 'Cells' },
  { key: 'V2_init', label: 'Initial potential of cell 2', symbol: 'V_2(0)', unit: 'mV', default: -65, min: -80, max: -45, step: 0.5, description: 'Offsets the initial phase of the second cell.', group: 'Cells' },
];

function runM15(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M15_PARAMS, cfg.params);
  const gGap = p('g_gap'), I2c = p('I_cell2'), C = p('C_m'), gL = p('g_L'), EL = p('E_L'), dT = p('Delta_T'), VT = p('V_T'), Vreset = p('V_reset'), tref = p('tau_ref');
  const Vpeak = 0;
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rec = makeRecorder(['V_1', 'V_2', 'I_gap'], nSteps);
  let V1 = EL, V2 = p('V2_init'), r1 = 0, r2 = 0;
  const s1: number[] = [], s2: number[] = [];
  const f = (v: number, other: number, I: number) => (-gL * (v - EL) + gL * dT * Math.exp(Math.min(20, (v - VT) / dT)) + gGap * (other - v) + I) / C;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  let maxResidual = 0;
  rec.s.V_1![0] = V1; rec.s.V_2![0] = V2; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I1a = stim(t), I1m = stim(t + 0.5 * dt), I1b = stim(t + dt);
    const a = V1, b = V2;
    // Symmetric RK4 over the coupled pair; refractory cells are held at reset but still exchange gap current.
    const d1 = (x: number, y: number, I: number) => (r1 > 0 ? 0 : f(x, y, I));
    const d2 = (x: number, y: number) => (r2 > 0 ? 0 : f(y, x, I2c));
    const k1a = d1(a, b, I1a), k1b = d2(a, b);
    const k2a = d1(a + 0.5 * dt * k1a, b + 0.5 * dt * k1b, I1m), k2b = d2(a + 0.5 * dt * k1a, b + 0.5 * dt * k1b);
    const k3a = d1(a + 0.5 * dt * k2a, b + 0.5 * dt * k2b, I1m), k3b = d2(a + 0.5 * dt * k2a, b + 0.5 * dt * k2b);
    const k4a = d1(a + dt * k3a, b + dt * k3b, I1b), k4b = d2(a + dt * k3a, b + dt * k3b);
    V1 = a + (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
    V2 = b + (dt / 6) * (k1b + 2 * k2b + 2 * k3b + k4b);
    if (r1 > 0) { r1 = Math.max(0, r1 - dt); V1 = Vreset; }
    if (r2 > 0) { r2 = Math.max(0, r2 - dt); V2 = Vreset; }
    if (!Number.isFinite(V1) || V1 >= Vpeak) { s1.push(t + dt * (Number.isFinite(V1) && V1 > a ? Math.min(1, (Vpeak - a) / (V1 - a)) : 0.5)); V1 = Vreset; r1 = tref; }
    if (!Number.isFinite(V2) || V2 >= Vpeak) { s2.push(t + dt * (Number.isFinite(V2) && V2 > b ? Math.min(1, (Vpeak - b) / (V2 - b)) : 0.5)); V2 = Vreset; r2 = tref; }
    const i12 = gGap * (V2 - V1), i21 = gGap * (V1 - V2);
    maxResidual = Math.max(maxResidual, Math.abs(i12 + i21));
    if (diverged(V1) || diverged(V2)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) { rec.t[j] = k * dt; rec.s.V_1![j] = V1; rec.s.V_2![j] = V2; rec.s.I_gap![j] = i12; rec.written = j + 1; } }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const tail = Math.floor(t.length * 0.9);
  const dV1 = meanOf(series.V_1!, tail) - EL, dV2 = meanOf(series.V_2!, tail) - EL;
  out.metrics.spikeCount1 = s1.length;
  out.metrics.spikeCount2 = s2.length;
  out.metrics.couplingCoefficientAnalytic = gGap / (gGap + gL);
  out.metrics.couplingCoefficientMeasured = s1.length === 0 && s2.length === 0 && Math.abs(dV1) > 1e-6 && I2c === 0 ? dV2 / dV1 : NaN;
  out.metrics.currentConservationResidualPa = maxResidual;
  // Spike synchrony over the second half: mean |lag| to the nearest partner spike and fraction within ±2 ms.
  const half = cfg.durationMs / 2;
  const late1 = s1.filter((x) => x >= half);
  let lagSum = 0, within = 0;
  for (const x of late1) {
    let best = Infinity;
    for (const y of s2) { const d = Math.abs(y - x); if (d < best) best = d; }
    if (Number.isFinite(best)) { lagSum += best; if (best <= 2) within++; }
  }
  out.metrics.meanAbsSpikeLagMs = late1.length && s2.length ? lagSum / late1.length : NaN;
  out.metrics.synchronyFraction = late1.length && s2.length ? within / late1.length : NaN;
  out.metrics.rate1Hz = spikeMetrics(s1, 0, cfg.durationMs).firingRateHz;
  out.metrics.rate2Hz = spikeMetrics(s2, 0, cfg.durationMs).firingRateHz;
  out.spikes = { times: Float64Array.from([...s1, ...s2]), ids: Uint32Array.from([...s1.map(() => 0), ...s2.map(() => 1)]), n: 2, groups: [{ name: 'Cell 1', from: 0, to: 1, kind: 'I' }, { name: 'Cell 2', from: 1, to: 2, kind: 'I' }] };
  return out;
}

export const MODEL_015: ModelDefinition = {
  id: 'MODEL-015',
  name: 'Electrical Gap-Junction Coupling',
  equations: [
    'I_{gap,\\,i \\leftarrow j} = g_{gap}\\,(V_j - V_i), \\qquad I_{gap,\\,i \\leftarrow j} = -I_{gap,\\,j \\leftarrow i}',
    'C_m \\frac{dV_i}{dt} = -g_L (V_i - E_L) + g_L \\Delta_T e^{(V_i - V_T)/\\Delta_T} + g_{gap}(V_j - V_i) + I_i(t)',
    'CC = \\frac{\\Delta V_2}{\\Delta V_1} = \\frac{g_{gap}}{g_{gap} + g_L} \\quad \\text{(steady-state coupling coefficient, linear regime)}',
  ],
  params: M15_PARAMS,
  initial: [],
  stimulus: {
    label: 'Current injected into cell 1', unit: 'pA', description: 'Electrode current delivered to the first cell only.',
    default: { kind: 'step', amplitude: 60, startMs: 20, durationMs: 1e9 }, amplitudeRange: [-200, 800], kinds: ['step', 'pulse-train', 'sine', 'none'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.05, minDtMs: 0.01, maxSafeDtMs: 0.2, defaultDurationMs: 300, maxDurationMs: 5000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potentials of the coupled pair', yLabel: 'V (mV)', series: [
      { key: 'V_1', label: 'Cell 1', unit: 'mV', meaning: 'Membrane potential of the directly stimulated cell.' },
      { key: 'V_2', label: 'Cell 2', unit: 'mV', meaning: 'Membrane potential of the electrically coupled partner.' },
    ] },
    { kind: 'traces', title: 'Gap-junction current into cell 1', yLabel: 'I_gap (pA)', series: [{ key: 'I_gap', label: 'I_gap,1←2', unit: 'pA', meaning: 'Ohmic current through the gap junction; equal and opposite in the two cells.' }] },
    { kind: 'raster', title: 'Spike times', meaning: 'Spike times of both cells; aligned ticks indicate synchrony.' },
  ],
  metrics: [
    { key: 'couplingCoefficientMeasured', label: 'Measured coupling coefficient', unit: '', description: 'ΔV₂/ΔV₁ at the end of a subthreshold step (reported only when neither cell fires and cell 2 receives no current).', digits: 4 },
    { key: 'couplingCoefficientAnalytic', label: 'Analytical coupling coefficient', unit: '', description: 'g_gap / (g_gap + g_L) for passive membranes.', digits: 4 },
    { key: 'meanAbsSpikeLagMs', label: 'Mean absolute spike lag', unit: 'ms', description: 'Average time between each late spike of cell 1 and the nearest spike of cell 2.', analyticId: 'ANALYTIC-014' },
    { key: 'synchronyFraction', label: 'Spikes synchronized within ±2 ms', unit: '', description: 'Fraction of late cell-1 spikes with a cell-2 spike within 2 ms.', analyticId: 'ANALYTIC-015' },
    { key: 'currentConservationResidualPa', label: 'Current conservation residual', unit: 'pA', description: 'Maximum |I₁←₂ + I₂←₁|; zero confirms symmetric current exchange.', digits: 6 },
  ],
  presets: [
    { id: 'cc', label: 'Subthreshold coupling coefficient', description: 'Small step to cell 1; compare measured and analytical coupling.', stimulus: { kind: 'step', amplitude: 60, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-024' },
    { id: 'sync', label: 'Synchronization of two firing cells', description: 'Both cells fire at slightly different intrinsic rates; coupling pulls spike times together.', params: { I_cell2: 215, g_gap: 2, V2_init: -58 }, stimulus: { kind: 'step', amplitude: 230, startMs: 0, durationMs: 1e9 }, durationMs: 1500, experimentId: 'EXP-024' },
    { id: 'uncoupled', label: 'Uncoupled control', description: 'g_gap = 0: spike times drift apart.', params: { I_cell2: 215, g_gap: 0, V2_init: -58 }, stimulus: { kind: 'step', amplitude: 230, startMs: 0, durationMs: 1e9 }, durationMs: 1500, experimentId: 'EXP-024' },
  ],
  sweep: { paramKey: 'g_gap', from: 0, to: 5, steps: 11, metricKey: 'meanAbsSpikeLagMs', experimentId: 'EXP-024' },
  kernelLimitations: ['Two identical exponential integrate-and-fire cells; the spike downstroke is a reset, so the after-hyperpolarizing part of the spikelet is approximated.', 'Constant, non-rectifying, voltage-independent junctional conductance.'],
  run: runM15,
};

// ───────────────────────── MODEL-016 ─────────────────────────

const M16_PARAMS: ParamSpec[] = [
  { key: 'U0_STP', label: 'Baseline utilization', symbol: 'U_0', unit: '', default: 0.5, min: 0.02, max: 0.95, step: 0.01, registryId: 'PARAM-049', description: 'Baseline fraction of available resources used per spike.', group: 'Short-term plasticity' },
  { key: 'tau_rec_STP', label: 'Recovery time constant', symbol: '\\tau_{rec}', unit: 'ms', default: 800, min: 20, max: 2000, step: 5, registryId: 'PARAM-050', description: 'Time for depleted vesicle resources to recover.', group: 'Short-term plasticity' },
  { key: 'tau_facil_STP', label: 'Facilitation time constant', symbol: '\\tau_{facil}', unit: 'ms', default: 20, min: 1, max: 1500, step: 1, registryId: 'PARAM-051', description: 'Decay time of the spike-induced increase in utilization.', group: 'Short-term plasticity' },
  { key: 'g_max', label: 'Maximal conductance', symbol: '\\bar{g}_{max}', unit: 'nS', default: 5, min: 0.1, max: 50, step: 0.1, description: 'Conductance increment if all resources were released at once.', group: 'Synapse' },
  { key: 'tau_syn', label: 'Conductance decay', symbol: '\\tau_s', unit: 'ms', default: 3, min: 0.5, max: 30, step: 0.5, description: 'Decay of the postsynaptic conductance.', group: 'Synapse' },
  { key: 'train_rate', label: 'Train frequency', symbol: 'f', unit: 'Hz', default: 20, min: 1, max: 200, step: 1, description: 'Frequency of the regular presynaptic train.', group: 'Presynaptic train' },
  { key: 'train_count', label: 'Spikes in train', symbol: 'n', unit: '', default: 10, min: 1, max: 200, step: 1, integer: true, description: 'Number of spikes in the train.', group: 'Presynaptic train' },
  { key: 'train_start', label: 'Train onset', symbol: 't_0', unit: 'ms', default: 50, min: 0, max: 1000, step: 5, description: 'Time of the first spike.', group: 'Presynaptic train' },
  { key: 'recovery_gap', label: 'Recovery probe delay', symbol: '\\Delta t_{probe}', unit: 'ms', default: 500, min: 0, max: 5000, step: 10, description: 'Delay of one extra probe spike after the train (0 disables it).', group: 'Presynaptic train' },
];

/** Steady-state release per spike for a periodic train (derived from EQ-STP-TM-ODE / EQ-STP-TM-JUMP). */
export function stpSteadyState(U0: number, tauRec: number, tauFacil: number, rateHz: number): { uPlus: number; xMinus: number; release: number } {
  const D = 1000 / rateHz, pf = Math.exp(-D / tauFacil), pr = Math.exp(-D / tauRec);
  const uMinus = U0 / (1 - (1 - U0) * pf);
  const uPlus = uMinus + U0 * (1 - uMinus);
  const xMinus = (1 - pr) / (1 - (1 - uPlus) * pr);
  return { uPlus, xMinus, release: uPlus * xMinus };
}

function runM16(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(M16_PARAMS, cfg.params);
  const U0 = p('U0_STP'), tauRec = p('tau_rec_STP'), tauFac = p('tau_facil_STP'), gMax = p('g_max'), tauS = p('tau_syn');
  const rate = p('train_rate'), count = Math.round(p('train_count')), start = p('train_start'), gap = p('recovery_gap');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const pre: number[] = [];
  for (let k = 0; k < count; k++) { const tt = start + (k * 1000) / rate; if (tt < cfg.durationMs) pre.push(tt); }
  if (gap > 0 && pre.length) { const tp = pre[pre.length - 1]! + gap; if (tp < cfg.durationMs) pre.push(tp); }
  const cursor = makeEventCursor(pre);
  const rec = makeRecorder(['u', 'x', 'g_syn'], nSteps);
  // Utilization starts at its resting value U₀ (the fixed point of du/dt between spikes).
  let u = U0, x = cfg.initial.x ?? 1, g = 0;
  const releases: number[] = [];
  const eventDriven = cfg.solver === 'SOLVER-HYBRID-SPIKE';
  const relaxExact = (h: number) => { u = U0 + (u - U0) * Math.exp(-h / tauFac); x = 1 + (x - 1) * Math.exp(-h / tauRec); g *= Math.exp(-h / tauS); };
  const relaxRk4 = (h: number) => {
    const r4 = (y: number, f: (v: number) => number) => { const k1 = f(y), k2 = f(y + 0.5 * h * k1), k3 = f(y + 0.5 * h * k2), k4 = f(y + h * k3); return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4); };
    u = r4(u, (v) => (U0 - v) / tauFac); x = r4(x, (v) => (1 - v) / tauRec); g = r4(g, (v) => -v / tauS);
  };
  const relax = eventDriven ? relaxExact : relaxRk4;
  rec.s.u![0] = u; rec.s.x![0] = x; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    let tl = t;
    cursor(t, dt, (te) => {
      if (te > tl) { relax(te - tl); tl = te; }
      const uPlus = u + U0 * (1 - u);
      const dr = uPlus * x;
      x -= dr; u = uPlus; g += gMax * dr;
      releases.push(dr);
    });
    if (t + dt > tl) relax(t + dt - tl);
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) { rec.t[j] = k * dt; rec.s.u![j] = u; rec.s.x![j] = x; rec.s.g_syn![j] = g; rec.written = j + 1; } }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  const idx = Float64Array.from(releases, (_, k) => k + 1);
  out.curves.release_per_spike = { x: idx, y: Float64Array.from(releases) };
  out.curves.normalized_amplitude = { x: Float64Array.from(idx), y: Float64Array.from(releases, (r) => r / (releases[0] || 1)) };
  const ss = stpSteadyState(U0, tauRec, tauFac, rate);
  const trainN = Math.min(count, releases.length);
  out.metrics.firstRelease = releases[0] ?? NaN;
  out.metrics.lastTrainRelease = releases[trainN - 1] ?? NaN;
  out.metrics.steadyStateReleaseAnalytic = ss.release;
  out.metrics.pairedPulseRatio = releases.length > 1 ? releases[1]! / releases[0]! : NaN;
  out.metrics.maxNormalizedAmplitude = releases.length ? maxOf(out.curves.normalized_amplitude.y.subarray(0, trainN)) : NaN;
  out.metrics.lastNormalizedAmplitude = trainN ? releases[trainN - 1]! / releases[0]! : NaN;
  out.metrics.recoveryProbeRatio = gap > 0 && releases.length > trainN ? releases[trainN]! / releases[0]! : NaN;
  out.metrics.peakConductanceNs = maxOf(series.g_syn!);
  out.curves.presynapticSpikes = { x: Float64Array.from(pre), y: new Float64Array(pre.length) };
  out.notes.push(
    out.metrics.lastNormalizedAmplitude > 1.05
      ? 'Facilitation-dominated synapse: utilization builds up faster than resources deplete, so later spikes release more.'
      : out.metrics.lastNormalizedAmplitude < 0.95
        ? 'Depression-dominated synapse: resources deplete faster than they recover, so later spikes release less.'
        : 'Facilitation and depression are approximately balanced at this frequency.',
  );
  return out;
}

export const MODEL_016: ModelDefinition = {
  id: 'MODEL-016',
  name: 'Tsodyks–Markram Short-Term Plasticity',
  equations: [
    '\\frac{du}{dt} = \\frac{U_0 - u}{\\tau_{facil}}, \\qquad \\frac{dx}{dt} = \\frac{1 - x}{\\tau_{rec}} \\quad \\text{(between spikes)}',
    'u^+ = u^- + U_0 (1 - u^-), \\quad \\Delta r = u^+ x^-, \\quad x^+ = x^- - \\Delta r, \\quad g_{syn} \\leftarrow g_{syn} + \\bar{g}_{max}\\,\\Delta r \\quad \\text{(at each spike)}',
  ],
  params: M16_PARAMS,
  initial: [{ key: 'x', label: 'Available resources x(0)', unit: '', default: 1 }],
  stimulus: null,
  solvers: ['SOLVER-HYBRID-SPIKE', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.5, defaultDurationMs: 1200, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'curve', title: 'Release per spike (normalized to the first)', xLabel: 'spike number', yLabel: 'Δr_n / Δr_1', meaning: 'Relative synaptic efficacy across the train; the last point is the recovery probe.', curves: [{ key: 'normalized_amplitude', label: 'Normalized release', points: true }] },
    { kind: 'traces', title: 'Utilization and resources', yLabel: 'fraction', series: [
      { key: 'u', label: 'u', unit: '', meaning: 'Utilization: fraction of available resources released by a spike (facilitation variable).' },
      { key: 'x', label: 'x', unit: '', meaning: 'Fraction of vesicle resources available for release (depression variable).' },
    ] },
    { kind: 'traces', title: 'Postsynaptic conductance', yLabel: 'g_syn (nS)', series: [{ key: 'g_syn', label: 'g_syn', unit: 'nS', meaning: 'Postsynaptic conductance; each jump equals ḡ_max Δr.' }] },
  ],
  metrics: [
    { key: 'pairedPulseRatio', label: 'Paired-pulse ratio', unit: '', description: 'Second release divided by the first; > 1 facilitation, < 1 depression.', digits: 3 },
    { key: 'lastNormalizedAmplitude', label: 'Last / first release', unit: '', description: 'Release of the final train spike relative to the first.', digits: 3 },
    { key: 'maxNormalizedAmplitude', label: 'Maximum normalized release', unit: '', description: 'Largest release in the train relative to the first (VAL-STP-001 expects > 1.5 for the facilitating preset).', digits: 3 },
    { key: 'lastTrainRelease', label: 'Final train release', unit: '', description: 'Release Δr at the last spike of the train.', digits: 4 },
    { key: 'steadyStateReleaseAnalytic', label: 'Analytical steady-state release', unit: '', description: 'Closed-form fixed point of the spike-to-spike map for an infinite periodic train.', digits: 4 },
    { key: 'recoveryProbeRatio', label: 'Recovery probe / first release', unit: '', description: 'Release of the probe spike after the pause, relative to the first spike.', digits: 3 },
  ],
  presets: [
    { id: 'std', label: 'Depression-dominated (L5 pyramidal → pyramidal)', description: 'U₀ = 0.5, τ_rec = 800 ms, τ_facil = 20 ms.', params: { U0_STP: 0.5, tau_rec_STP: 800, tau_facil_STP: 20 }, experimentId: 'EXP-025' },
    { id: 'stf', label: 'Facilitation-dominated (pyramidal → SST Martinotti)', description: 'U₀ = 0.1, τ_rec = 100 ms, τ_facil = 750 ms.', params: { U0_STP: 0.1, tau_rec_STP: 100, tau_facil_STP: 750 }, experimentId: 'EXP-025' },
    { id: 'highfreq', label: 'Depressing synapse at 50 Hz', description: 'Higher rate deepens steady-state depression.', params: { train_rate: 50, train_count: 20 }, experimentId: 'EXP-025' },
  ],
  sweep: { paramKey: 'train_rate', from: 5, to: 100, steps: 12, metricKey: 'lastNormalizedAmplitude', experimentId: 'EXP-025' },
  kernelLimitations: [
    'Deterministic mean-field description: quantal release failures and trial-to-trial variability are not modelled.',
    'Utilization relaxes to U₀ and jumps before release, so the first-spike release is U₀(2 − U₀)·x as specified in SYNAPTIC_MODELS §7.',
    'Utilization always starts at its resting value u(0) = U₀; only the resource fraction x(0) is editable.',
  ],
  run: runM16,
};
