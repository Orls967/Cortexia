// MODEL-001 Hodgkin–Huxley, MODEL-002 Morris–Lecar, MODEL-003 Connor–Stevens, MODEL-004 FitzHugh–Nagumo.
// Specification: docs/06-computational-models/NEURON_MODELS.md. Sign conventions: MATHEMATICAL_CONVENTIONS §3.
import { DIVERGENCE_NOTE, runOde } from '../core/odeRun';
import { curveFrom, linspace, maxOf, minOf, paramReader, spikeMetrics } from '../core/record';
import { makeStimulus } from '../core/stimulus';
import type { MetricSpec, ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { xOverOneMinusExpNeg, type Deriv } from '../solvers/ode';

const SPIKE_METRICS: MetricSpec[] = [
  { key: 'spikeCount', label: 'Spike count', unit: 'spikes', description: 'Number of upward threshold crossings detected during the run.', analyticId: 'ANALYTIC-009', digits: 0 },
  { key: 'firingRateHz', label: 'Firing rate', unit: 'Hz', description: 'Steady firing rate, 1000 / mean inter-spike interval.', analyticId: 'ANALYTIC-009' },
  { key: 'firstSpikeLatencyMs', label: 'First-spike latency', unit: 'ms', description: 'Time from stimulus onset to the first detected spike.', analyticId: 'ANALYTIC-012' },
  { key: 'cvIsi', label: 'CV of ISI', unit: '', description: 'Coefficient of variation of inter-spike intervals (0 = perfectly regular).', analyticId: 'ANALYTIC-010', digits: 3 },
];

function addSpikeMetrics(out: ModelOutput, spikes: number[], cfg: RunConfig): void {
  const m = spikeMetrics(spikes, cfg.stimulus.startMs, cfg.durationMs);
  out.metrics.spikeCount = m.spikeCount;
  out.metrics.firingRateHz = m.firingRateHz;
  out.metrics.firstSpikeLatencyMs = m.firstSpikeLatencyMs;
  out.metrics.cvIsi = m.cvIsi;
  out.metrics.adaptationRatio = m.adaptationRatio;
  out.curves.spikeTimes = { x: Float64Array.from(spikes), y: new Float64Array(spikes.length) };
}

// ───────────────────────── MODEL-001 Hodgkin–Huxley ─────────────────────────

export const hhRates = {
  am: (V: number) => xOverOneMinusExpNeg((V + 40) / 10),
  bm: (V: number) => 4 * Math.exp(-(V + 65) / 18),
  ah: (V: number) => 0.07 * Math.exp(-(V + 65) / 20),
  bh: (V: number) => 1 / (1 + Math.exp(-(V + 35) / 10)),
  an: (V: number) => 0.1 * xOverOneMinusExpNeg((V + 55) / 10),
  bn: (V: number) => 0.125 * Math.exp(-(V + 65) / 80),
};
export function hhSteadyState(V: number): { m: number; h: number; n: number } {
  const { am, bm, ah, bh, an, bn } = hhRates;
  return { m: am(V) / (am(V) + bm(V)), h: ah(V) / (ah(V) + bh(V)), n: an(V) / (an(V) + bn(V)) };
}

const HH_PARAMS: ParamSpec[] = [
  { key: 'C_m', label: 'Specific membrane capacitance', symbol: 'C_m', unit: 'µF/cm²', default: 1.0, min: 0.5, max: 5, step: 0.05, registryId: 'PARAM-001', description: 'Capacitance of the lipid bilayer per unit area; sets how fast ionic current changes the voltage.', group: 'Membrane' },
  { key: 'g_Na_max', label: 'Maximum sodium conductance', symbol: '\\bar{g}_{Na}', unit: 'mS/cm²', default: 120, min: 0, max: 250, step: 1, registryId: 'PARAM-002', description: 'Peak Na⁺ conductance with all channels open. Setting it to 0 mimics a tetrodotoxin block.', group: 'Conductances' },
  { key: 'g_K_max', label: 'Maximum delayed-rectifier potassium conductance', symbol: '\\bar{g}_{K}', unit: 'mS/cm²', default: 36, min: 0, max: 120, step: 0.5, registryId: 'PARAM-003', description: 'Peak K⁺ conductance driving repolarization. Reducing it mimics tetraethylammonium block.', group: 'Conductances' },
  { key: 'g_L', label: 'Leak conductance', symbol: '\\bar{g}_{L}', unit: 'mS/cm²', default: 0.3, min: 0.05, max: 5, step: 0.01, registryId: 'PARAM-004', description: 'Voltage-independent background conductance.', group: 'Conductances' },
  { key: 'E_Na', label: 'Sodium reversal potential', symbol: 'E_{Na}', unit: 'mV', default: 50, min: 30, max: 70, step: 0.5, registryId: 'PARAM-005', description: 'Nernst potential for Na⁺; the ceiling of the action potential.', group: 'Reversal potentials' },
  { key: 'E_K', label: 'Potassium reversal potential', symbol: 'E_{K}', unit: 'mV', default: -77, min: -95, max: -60, step: 0.5, registryId: 'PARAM-006', description: 'Nernst potential for K⁺; the floor of the after-hyperpolarization.', group: 'Reversal potentials' },
  { key: 'E_L', label: 'Leak reversal potential', symbol: 'E_{L}', unit: 'mV', default: -54.387, min: -75, max: -45, step: 0.1, registryId: 'PARAM-007', description: 'Reversal potential of the leak current, chosen so the resting potential is −65 mV.', group: 'Reversal potentials' },
  { key: 'T_celsius', label: 'Temperature', symbol: 'T', unit: '°C', default: 6.3, min: 2, max: 37, step: 0.1, registryId: 'PARAM-008', description: 'Scales gating kinetics by φ = Q₁₀^((T − 6.3)/10) with Q₁₀ = 3.', group: 'Kinetics' },
];

function runHH(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(HH_PARAMS, cfg.params);
  const C = p('C_m'), gNa = p('g_Na_max'), gK = p('g_K_max'), gL = p('g_L');
  const ENa = p('E_Na'), EK = p('E_K'), EL = p('E_L');
  const phi = Math.pow(3, (p('T_celsius') - 6.3) / 10);
  const stim = makeStimulus(cfg.stimulus, cfg.dtMs, cfg.durationMs, cfg.seed);
  const { am, bm, ah, bh, an, bn } = hhRates;
  const V0 = cfg.initial.V ?? -65;
  const ss = hhSteadyState(V0);
  const y0 = Float64Array.of(V0, cfg.initial.m ?? ss.m, cfg.initial.h ?? ss.h, cfg.initial.n ?? ss.n);

  const deriv: Deriv = (t, y, d) => {
    const V = y[0]!, m = y[1]!, h = y[2]!, n = y[3]!;
    d[0] = (stim(t) - gNa * m * m * m * h * (V - ENa) - gK * n * n * n * n * (V - EK) - gL * (V - EL)) / C;
    d[1] = phi * (am(V) * (1 - m) - bm(V) * m);
    d[2] = phi * (ah(V) * (1 - h) - bh(V) * h);
    d[3] = phi * (an(V) * (1 - n) - bn(V) * n);
  };
  // Rush–Larsen: exponential update of gates at fixed V, then exponential-Euler voltage update (linear in V).
  const rushLarsen = (t: number, y: Float64Array, h: number) => {
    const V = y[0]!;
    const gate = (x: number, a: number, b: number) => {
      const inf = a / (a + b);
      return inf + (x - inf) * Math.exp(-h * phi * (a + b));
    };
    const m = gate(y[1]!, am(V), bm(V));
    const hh = gate(y[2]!, ah(V), bh(V));
    const n = gate(y[3]!, an(V), bn(V));
    const gna = gNa * m * m * m * hh, gk = gK * n * n * n * n;
    const gTot = gna + gk + gL;
    const vInf = (gna * ENa + gk * EK + gL * EL + stim(t + 0.5 * h)) / gTot;
    y[0] = vInf + (V - vInf) * Math.exp((-h * gTot) / C);
    y[1] = m;
    y[2] = hh;
    y[3] = n;
  };

  const res = runOde({
    cfg, ctx, y0, deriv, customStep: rushLarsen,
    recordKeys: ['V', 'm', 'h', 'n', 'I_Na', 'I_K', 'I_L', 'g_Na', 'g_K', 'I_ext'],
    record: (j, t, y, s) => {
      const V = y[0]!, m = y[1]!, h = y[2]!, n = y[3]!;
      const gna = gNa * m * m * m * h, gk = gK * n * n * n * n;
      s.V![j] = V; s.m![j] = m; s.h![j] = h; s.n![j] = n;
      s.g_Na![j] = gna; s.g_K![j] = gk;
      s.I_Na![j] = gna * (V - ENa); s.I_K![j] = gk * (V - EK); s.I_L![j] = gL * (V - EL);
      s.I_ext![j] = stim(t);
    },
    spike: { index: 0, threshold: 0, rearm: -30 },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  addSpikeMetrics(out, res.spikeTimes, cfg);
  out.metrics.peakVoltageMv = maxOf(res.series.V!);
  out.metrics.minVoltageMv = minOf(res.series.V!);
  out.metrics.gateMin = Math.min(minOf(res.series.m!), minOf(res.series.h!), minOf(res.series.n!));
  out.metrics.gateMax = Math.max(maxOf(res.series.m!), maxOf(res.series.h!), maxOf(res.series.n!));
  const vs = linspace(-100, 50, 151);
  out.curves.m_inf = curveFrom(vs, (V) => hhSteadyState(V).m);
  out.curves.h_inf = curveFrom(vs, (V) => hhSteadyState(V).h);
  out.curves.n_inf = curveFrom(vs, (V) => hhSteadyState(V).n);
  if (out.metrics.spikeCount === 0) out.notes.push('No action potential: the stimulus stayed below threshold or Na⁺ channels were unavailable.');
  return out;
}

export const MODEL_001: ModelDefinition = {
  id: 'MODEL-001',
  name: 'Hodgkin–Huxley',
  equations: [
    'C_m \\frac{dV}{dt} = I_{ext}(t) - \\bar{g}_{Na} m^3 h (V - E_{Na}) - \\bar{g}_{K} n^4 (V - E_{K}) - \\bar{g}_{L} (V - E_{L})',
    '\\frac{dx}{dt} = \\phi_T\\left[\\alpha_x(V)(1 - x) - \\beta_x(V)\\,x\\right], \\quad x \\in \\{m, h, n\\}, \\quad \\phi_T = 3^{(T - 6.3)/10}',
    '\\alpha_m = \\frac{0.1(V+40)}{1 - e^{-(V+40)/10}}, \\; \\beta_m = 4 e^{-(V+65)/18}, \\; \\alpha_h = 0.07 e^{-(V+65)/20}, \\; \\beta_h = \\frac{1}{1 + e^{-(V+35)/10}}',
    '\\alpha_n = \\frac{0.01(V+55)}{1 - e^{-(V+55)/10}}, \\; \\beta_n = 0.125 e^{-(V+65)/80}',
  ],
  params: HH_PARAMS,
  initial: [
    { key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -65 },
    { key: 'm', label: 'Na⁺ activation m₀', unit: '', default: 0.05293 },
    { key: 'h', label: 'Na⁺ inactivation h₀', unit: '', default: 0.59612 },
    { key: 'n', label: 'K⁺ activation n₀', unit: '', default: 0.31768 },
  ],
  stimulus: {
    label: 'Injected current density', unit: 'µA/cm²',
    description: 'Depolarizing electrode current per unit membrane area (positive = inward, depolarizing).',
    default: { kind: 'step', amplitude: 10, startMs: 5, durationMs: 1e9 }, amplitudeRange: [-30, 60],
    kinds: ['step', 'pulse-train', 'ramp', 'sine', 'ou-noise', 'none'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-RUSH-LARSEN', 'SOLVER-RK45', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.01, minDtMs: 0.001, maxSafeDtMs: 0.025, defaultDurationMs: 50, maxDurationMs: 2000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential: intracellular minus extracellular potential.' }] },
    { kind: 'traces', title: 'Gating variables', yLabel: 'open probability', series: [
      { key: 'm', label: 'm', unit: '', meaning: 'Na⁺ activation gate: fast, opens on depolarization.' },
      { key: 'h', label: 'h', unit: '', meaning: 'Na⁺ inactivation gate: closes during sustained depolarization, producing the refractory period.' },
      { key: 'n', label: 'n', unit: '', meaning: 'K⁺ activation gate: slow, drives repolarization.' },
    ] },
    { kind: 'traces', title: 'Ionic currents (outward positive)', yLabel: 'I (µA/cm²)', series: [
      { key: 'I_Na', label: 'I_Na', unit: 'µA/cm²', meaning: 'Sodium current g_Na (V − E_Na); negative = inward, depolarizing.' },
      { key: 'I_K', label: 'I_K', unit: 'µA/cm²', meaning: 'Potassium current g_K (V − E_K); positive = outward, repolarizing.' },
      { key: 'I_L', label: 'I_L', unit: 'µA/cm²', meaning: 'Leak current g_L (V − E_L).' },
      { key: 'I_ext', label: 'I_ext', unit: 'µA/cm²', meaning: 'Injected stimulus current.', dashed: true },
    ] },
    { kind: 'phase', title: '(V, n) projection', xKey: 'V', yKey: 'n', xLabel: 'V (mV)', yLabel: 'n', curves: [{ key: 'n_inf', label: 'n∞(V)' }] },
  ],
  metrics: [...SPIKE_METRICS, { key: 'peakVoltageMv', label: 'Peak voltage', unit: 'mV', description: 'Maximum membrane potential reached (action-potential overshoot).' }],
  presets: [
    { id: 'rest', label: 'Resting equilibrium', description: 'No stimulus: membrane stays at −65 mV (VAL-HH-001).', stimulus: { kind: 'none', amplitude: 0 }, durationMs: 100 },
    { id: 'step10', label: 'Repetitive firing (10 µA/cm²)', description: 'Sustained step evokes a regular spike train (VAL-HH-002).', stimulus: { kind: 'step', amplitude: 10, startMs: 5, durationMs: 1e9 }, durationMs: 100, experimentId: 'EXP-001' },
    { id: 'refractory', label: 'Paired-pulse refractory probe', description: 'Second pulse arrives inside the refractory period (VAL-HH-003).', stimulus: { kind: 'pulse-train', amplitude: 15, startMs: 5, pulseWidthMs: 1, pulseIntervalMs: 4, pulseCount: 2 }, durationMs: 40, experimentId: 'EXP-003' },
    { id: 'anodal', label: 'Anodal break excitation', description: 'Release from hyperpolarization triggers a rebound spike.', stimulus: { kind: 'step', amplitude: -10, startMs: 5, durationMs: 30 }, durationMs: 70, experimentId: 'EXP-004' },
    { id: 'ttx', label: 'Simulated Na⁺ channel block', description: 'ḡ_Na reduced to zero abolishes the regenerative upstroke.', params: { g_Na_max: 0 }, stimulus: { kind: 'step', amplitude: 10, startMs: 5, durationMs: 1e9 }, experimentId: 'EXP-005' },
    { id: 'tea', label: 'Simulated K⁺ channel block', description: 'ḡ_K reduced to 20% prolongs the action potential.', params: { g_K_max: 7.2 }, stimulus: { kind: 'pulse-train', amplitude: 15, startMs: 5, pulseWidthMs: 1, pulseCount: 1, pulseIntervalMs: 100 }, experimentId: 'EXP-005' },
    { id: 'warm', label: 'Q₁₀ thermal acceleration (18.5 °C)', description: 'Faster gating shortens the spike.', params: { T_celsius: 18.5 }, stimulus: { kind: 'step', amplitude: 10, startMs: 5, durationMs: 1e9 }, experimentId: 'EXP-006' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 0, to: 30, steps: 16, metricKey: 'firingRateHz', experimentId: 'EXP-002' },
  kernelLimitations: [
    'Single isopotential compartment: no axonal propagation, dendrites or spatial gradients.',
    'Squid giant axon kinetics at 6.3 °C; mammalian channel isoforms and Ca²⁺-activated K⁺ currents are not represented.',
    'Ion concentrations and reversal potentials are constant during the run.',
  ],
  run: runHH,
};

// ───────────────────────── MODEL-002 Morris–Lecar ─────────────────────────

const ML_PARAMS: ParamSpec[] = [
  { key: 'C_m_ML', label: 'Membrane capacitance', symbol: 'C_m', unit: 'µF/cm²', default: 20, min: 5, max: 50, step: 0.5, registryId: 'PARAM-009', description: 'Membrane capacitance of the barnacle muscle fibre model.', group: 'Membrane' },
  { key: 'g_Ca_ML', label: 'Calcium conductance', symbol: '\\bar{g}_{Ca}', unit: 'mS/cm²', default: 4.4, min: 1, max: 12, step: 0.05, registryId: 'PARAM-010', description: 'Maximal conductance of the instantaneously activating inward Ca²⁺ current.', group: 'Conductances' },
  { key: 'g_K_ML', label: 'Potassium conductance', symbol: '\\bar{g}_{K}', unit: 'mS/cm²', default: 8, min: 1, max: 20, step: 0.1, registryId: 'PARAM-011', description: 'Maximal conductance of the delayed outward K⁺ current gated by W.', group: 'Conductances' },
  { key: 'g_L_ML', label: 'Leak conductance', symbol: '\\bar{g}_{L}', unit: 'mS/cm²', default: 2, min: 0.5, max: 5, step: 0.05, description: 'Leak conductance.', group: 'Conductances' },
  { key: 'E_Ca', label: 'Calcium reversal potential', symbol: 'E_{Ca}', unit: 'mV', default: 120, min: 80, max: 140, step: 1, description: 'Reversal potential of the Ca²⁺ current.', group: 'Reversal potentials' },
  { key: 'E_K_ML', label: 'Potassium reversal potential', symbol: 'E_{K}', unit: 'mV', default: -84, min: -100, max: -60, step: 1, description: 'Reversal potential of the K⁺ current.', group: 'Reversal potentials' },
  { key: 'E_L_ML', label: 'Leak reversal potential', symbol: 'E_{L}', unit: 'mV', default: -60, min: -80, max: -40, step: 1, description: 'Reversal potential of the leak current.', group: 'Reversal potentials' },
  { key: 'V_1', label: 'Ca²⁺ activation midpoint', symbol: 'V_1', unit: 'mV', default: -1.2, min: -20, max: 20, step: 0.1, description: 'Half-activation voltage of M∞(V).', group: 'Kinetics' },
  { key: 'V_2', label: 'Ca²⁺ activation slope', symbol: 'V_2', unit: 'mV', default: 18, min: 5, max: 30, step: 0.1, description: 'Slope factor of M∞(V).', group: 'Kinetics' },
  { key: 'V_3', label: 'K⁺ activation midpoint', symbol: 'V_3', unit: 'mV', default: 2, min: -20, max: 30, step: 0.1, description: 'Half-activation voltage of W∞(V). 2 mV gives Hopf (Type II), 12 mV gives SNIC (Type I).', group: 'Kinetics' },
  { key: 'V_4', label: 'K⁺ activation slope', symbol: 'V_4', unit: 'mV', default: 30, min: 5, max: 40, step: 0.1, description: 'Slope factor of W∞(V).', group: 'Kinetics' },
  { key: 'phi_ML', label: 'Recovery rate scale', symbol: '\\phi', unit: '1/ms', default: 0.04, min: 0.01, max: 0.2, step: 0.001, registryId: 'PARAM-012', description: 'Rate constant for K⁺ channel opening; sets the time scale of W.', group: 'Kinetics' },
];

function runML(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(ML_PARAMS, cfg.params);
  const C = p('C_m_ML'), gCa = p('g_Ca_ML'), gK = p('g_K_ML'), gL = p('g_L_ML');
  const ECa = p('E_Ca'), EK = p('E_K_ML'), EL = p('E_L_ML');
  const V1 = p('V_1'), V2 = p('V_2'), V3 = p('V_3'), V4 = p('V_4'), phi = p('phi_ML');
  const stim = makeStimulus(cfg.stimulus, cfg.dtMs, cfg.durationMs, cfg.seed);
  const mInf = (V: number) => 0.5 * (1 + Math.tanh((V - V1) / V2));
  const wInf = (V: number) => 0.5 * (1 + Math.tanh((V - V3) / V4));
  const tauW = (V: number) => 1 / Math.cosh((V - V3) / (2 * V4));
  const V0 = cfg.initial.V ?? -60;
  const y0 = Float64Array.of(V0, cfg.initial.W ?? wInf(V0));
  const deriv: Deriv = (t, y, d) => {
    const V = y[0]!, W = y[1]!;
    d[0] = (stim(t) - gCa * mInf(V) * (V - ECa) - gK * W * (V - EK) - gL * (V - EL)) / C;
    d[1] = (phi * (wInf(V) - W)) / tauW(V);
  };
  const res = runOde({
    cfg, ctx, y0, deriv, recordKeys: ['V', 'W', 'I_Ca', 'I_K', 'I_ext'],
    record: (j, t, y, s) => {
      const V = y[0]!, W = y[1]!;
      s.V![j] = V; s.W![j] = W; s.I_Ca![j] = gCa * mInf(V) * (V - ECa); s.I_K![j] = gK * W * (V - EK); s.I_ext![j] = stim(t);
    },
    spike: { index: 0, threshold: 0, rearm: -15 },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  addSpikeMetrics(out, res.spikeTimes, cfg);
  out.metrics.peakVoltageMv = maxOf(res.series.V!);
  const I = cfg.stimulus.kind === 'none' ? cfg.stimulus.baseline : cfg.stimulus.baseline + cfg.stimulus.amplitude;
  const vs = linspace(-80, 60, 281);
  out.curves.V_nullcline = curveFrom(vs, (V) => (I - gCa * mInf(V) * (V - ECa) - gL * (V - EL)) / (gK * (V - EK)));
  out.curves.W_nullcline = curveFrom(vs, wInf);
  return out;
}

export const MODEL_002: ModelDefinition = {
  id: 'MODEL-002',
  name: 'Morris–Lecar',
  equations: [
    'C_m \\frac{dV}{dt} = I_{ext} - \\bar{g}_{Ca} M_\\infty(V)(V - E_{Ca}) - \\bar{g}_{K} W (V - E_{K}) - \\bar{g}_{L}(V - E_{L})',
    '\\frac{dW}{dt} = \\phi\\,\\frac{W_\\infty(V) - W}{\\tau_W(V)}',
    'M_\\infty = \\tfrac{1}{2}\\left[1 + \\tanh\\tfrac{V - V_1}{V_2}\\right], \\; W_\\infty = \\tfrac{1}{2}\\left[1 + \\tanh\\tfrac{V - V_3}{V_4}\\right], \\; \\tau_W = \\frac{1}{\\cosh\\frac{V - V_3}{2 V_4}}',
  ],
  params: ML_PARAMS,
  initial: [
    { key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -60 },
    { key: 'W', label: 'K⁺ activation W₀', unit: '', default: 0.0149 },
  ],
  stimulus: {
    label: 'Injected current density', unit: 'µA/cm²', description: 'Constant or time-varying depolarizing current.',
    default: { kind: 'step', amplitude: 100, startMs: 20, durationMs: 1e9 }, amplitudeRange: [0, 200], kinds: ['step', 'pulse-train', 'ramp', 'sine', 'none'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-RK45', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.05, minDtMs: 0.005, maxSafeDtMs: 0.2, defaultDurationMs: 600, maxDurationMs: 5000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential of the Morris–Lecar cell.' }] },
    { kind: 'phase', title: '(V, W) phase plane with nullclines', xKey: 'V', yKey: 'W', xLabel: 'V (mV)', yLabel: 'W', curves: [{ key: 'V_nullcline', label: 'V-nullcline (dV/dt = 0)' }, { key: 'W_nullcline', label: 'W-nullcline (W∞)' }] },
    { kind: 'traces', title: 'Recovery variable', yLabel: 'W', series: [{ key: 'W', label: 'W', unit: '', meaning: 'Fraction of open K⁺ channels (slow recovery variable).' }] },
  ],
  metrics: [...SPIKE_METRICS, { key: 'peakVoltageMv', label: 'Peak voltage', unit: 'mV', description: 'Maximum membrane potential reached.' }],
  presets: [
    { id: 'hopf', label: 'Type II (Hopf) oscillation', description: 'Default parameters: firing starts abruptly at a non-zero frequency.', stimulus: { kind: 'step', amplitude: 100, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-009' },
    { id: 'snic', label: 'Type I (SNIC) oscillation', description: 'Saddle-node on invariant circle: arbitrarily slow firing near rheobase.', params: { g_Ca_ML: 4.0, V_3: 12, V_4: 17.4, phi_ML: 0.0667 }, stimulus: { kind: 'step', amplitude: 42, startMs: 20, durationMs: 1e9 }, durationMs: 1500, experimentId: 'EXP-009' },
    { id: 'excitable', label: 'Excitable rest (Type II)', description: 'Subthreshold step relaxes to a stable fixed point.', stimulus: { kind: 'step', amplitude: 60, startMs: 20, durationMs: 1e9 } },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 60, to: 140, steps: 17, metricKey: 'firingRateHz', experimentId: 'EXP-009' },
  kernelLimitations: ['Ca²⁺ activation is instantaneous (M = M∞); no Ca²⁺ inactivation or intracellular Ca²⁺ dynamics.', 'Two-variable reduction: cannot produce bursting without an added slow variable.'],
  run: runML,
};

// ───────────────────────── MODEL-003 Connor–Stevens ─────────────────────────
// Rate functions follow Dayan & Abbott (2001), ch. 6 (REF-DAYAN-2001), converted to per-cm² units.

const CS_PARAMS: ParamSpec[] = [
  { key: 'g_A_max', label: 'A-current conductance', symbol: '\\bar{g}_{A}', unit: 'mS/cm²', default: 47.7, min: 0, max: 100, step: 0.1, registryId: 'PARAM-013', description: 'Maximal conductance of the transient A-type K⁺ current. Zero removes the A-current (Type II-like onset).', group: 'Conductances' },
  { key: 'E_A', label: 'A-current reversal potential', symbol: 'E_{A}', unit: 'mV', default: -75, min: -90, max: -60, step: 0.5, registryId: 'PARAM-014', description: 'Reversal potential of the A-current.', group: 'Reversal potentials' },
  { key: 'g_Na_CS', label: 'Sodium conductance', symbol: '\\bar{g}_{Na}', unit: 'mS/cm²', default: 120, min: 0, max: 200, step: 1, description: 'Maximal transient Na⁺ conductance.', group: 'Conductances' },
  { key: 'g_K_CS', label: 'Delayed-rectifier conductance', symbol: '\\bar{g}_{K}', unit: 'mS/cm²', default: 20, min: 0, max: 60, step: 0.5, description: 'Maximal delayed-rectifier K⁺ conductance.', group: 'Conductances' },
  { key: 'g_L_CS', label: 'Leak conductance', symbol: '\\bar{g}_{L}', unit: 'mS/cm²', default: 0.3, min: 0.05, max: 2, step: 0.01, description: 'Leak conductance.', group: 'Conductances' },
  { key: 'C_m_CS', label: 'Membrane capacitance', symbol: 'C_m', unit: 'µF/cm²', default: 1, min: 0.5, max: 3, step: 0.05, description: 'Specific membrane capacitance.', group: 'Membrane' },
];
const CS_E = { Na: 55, K: -72, L: -17 };

export const csKinetics = {
  am: (V: number) => 3.8 * xOverOneMinusExpNeg(0.1 * (V + 29.7)),
  bm: (V: number) => 15.2 * Math.exp(-0.0556 * (V + 54.7)),
  ah: (V: number) => 0.266 * Math.exp(-0.05 * (V + 48)),
  bh: (V: number) => 3.8 / (1 + Math.exp(-0.1 * (V + 18))),
  an: (V: number) => 0.2 * xOverOneMinusExpNeg(0.1 * (V + 45.7)),
  bn: (V: number) => 0.25 * Math.exp(-0.0125 * (V + 55.7)),
  aInf: (V: number) => Math.cbrt((0.0761 * Math.exp(0.0314 * (V + 94.22))) / (1 + Math.exp(0.0346 * (V + 1.17)))),
  tauA: (V: number) => 0.3632 + 1.158 / (1 + Math.exp(0.0497 * (V + 55.96))),
  bInf: (V: number) => Math.pow(1 / (1 + Math.exp(0.0688 * (V + 53.3))), 4),
  tauB: (V: number) => 1.24 + 2.678 / (1 + Math.exp(0.0624 * (V + 50))),
};

function runCS(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(CS_PARAMS, cfg.params);
  const gA = p('g_A_max'), EA = p('E_A'), gNa = p('g_Na_CS'), gK = p('g_K_CS'), gL = p('g_L_CS'), C = p('C_m_CS');
  const k = csKinetics;
  const stim = makeStimulus(cfg.stimulus, cfg.dtMs, cfg.durationMs, cfg.seed);
  const iIon = (V: number, m: number, h: number, n: number, a: number, b: number) =>
    gNa * m * m * m * h * (V - CS_E.Na) + gK * n * n * n * n * (V - CS_E.K) + gA * a * a * a * b * (V - EA) + gL * (V - CS_E.L);
  const steady = (V: number) => ({
    m: k.am(V) / (k.am(V) + k.bm(V)), h: k.ah(V) / (k.ah(V) + k.bh(V)), n: k.an(V) / (k.an(V) + k.bn(V)), a: k.aInf(V), b: k.bInf(V),
  });
  // Resting potential: root of the steady-state ionic current (bisection), used when no explicit V₀ is supplied.
  const restCurrent = (V: number) => { const s = steady(V); return iIon(V, s.m, s.h, s.n, s.a, s.b); };
  let lo = -90, hi = -40;
  for (let i = 0; i < 80; i++) { const mid = 0.5 * (lo + hi); if (restCurrent(mid) > 0) hi = mid; else lo = mid; }
  const vRest = 0.5 * (lo + hi);
  const V0 = cfg.initial.V ?? vRest;
  const s0 = steady(V0);
  const y0 = Float64Array.of(V0, cfg.initial.m ?? s0.m, cfg.initial.h ?? s0.h, cfg.initial.n ?? s0.n, cfg.initial.a ?? s0.a, cfg.initial.b ?? s0.b);
  const deriv: Deriv = (t, y, d) => {
    const V = y[0]!, m = y[1]!, h = y[2]!, n = y[3]!, a = y[4]!, b = y[5]!;
    d[0] = (stim(t) - iIon(V, m, h, n, a, b)) / C;
    d[1] = k.am(V) * (1 - m) - k.bm(V) * m;
    d[2] = k.ah(V) * (1 - h) - k.bh(V) * h;
    d[3] = k.an(V) * (1 - n) - k.bn(V) * n;
    d[4] = (k.aInf(V) - a) / k.tauA(V);
    d[5] = (k.bInf(V) - b) / k.tauB(V);
  };
  const rushLarsen = (t: number, y: Float64Array, h: number) => {
    const V = y[0]!;
    const ab = (x: number, al: number, be: number) => { const inf = al / (al + be); return inf + (x - inf) * Math.exp(-h * (al + be)); };
    const it = (x: number, inf: number, tau: number) => inf + (x - inf) * Math.exp(-h / tau);
    const m = ab(y[1]!, k.am(V), k.bm(V)), hh = ab(y[2]!, k.ah(V), k.bh(V)), n = ab(y[3]!, k.an(V), k.bn(V));
    const a = it(y[4]!, k.aInf(V), k.tauA(V)), b = it(y[5]!, k.bInf(V), k.tauB(V));
    const gna = gNa * m * m * m * hh, gk = gK * n * n * n * n, ga = gA * a * a * a * b;
    const gTot = gna + gk + ga + gL;
    const vInf = (gna * CS_E.Na + gk * CS_E.K + ga * EA + gL * CS_E.L + stim(t + 0.5 * h)) / gTot;
    y[0] = vInf + (V - vInf) * Math.exp((-h * gTot) / C);
    y[1] = m; y[2] = hh; y[3] = n; y[4] = a; y[5] = b;
  };
  const res = runOde({
    cfg, ctx, y0, deriv, customStep: rushLarsen, recordKeys: ['V', 'a', 'b', 'n', 'I_A', 'I_ext'],
    record: (j, t, y, s) => {
      const V = y[0]!, a = y[4]!, b = y[5]!;
      s.V![j] = V; s.a![j] = a; s.b![j] = b; s.n![j] = y[3]!; s.I_A![j] = gA * a * a * a * b * (V - EA); s.I_ext![j] = stim(t);
    },
    spike: { index: 0, threshold: -10, rearm: -40 },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  addSpikeMetrics(out, res.spikeTimes, cfg);
  out.metrics.peakVoltageMv = maxOf(res.series.V!);
  out.metrics.restingPotentialMv = vRest;
  return out;
}

export const MODEL_003: ModelDefinition = {
  id: 'MODEL-003',
  name: 'Connor–Stevens',
  equations: [
    'C_m \\frac{dV}{dt} = I_{ext} - \\bar{g}_{Na} m^3 h (V - E_{Na}) - \\bar{g}_{K} n^4 (V - E_{K}) - \\bar{g}_{A} a^3 b (V - E_{A}) - \\bar{g}_{L}(V - E_{L})',
    '\\frac{da}{dt} = \\frac{a_\\infty(V) - a}{\\tau_a(V)}, \\qquad \\frac{db}{dt} = \\frac{b_\\infty(V) - b}{\\tau_b(V)}',
    'a_\\infty = \\left[\\frac{0.0761\\, e^{0.0314 (V + 94.22)}}{1 + e^{0.0346 (V + 1.17)}}\\right]^{1/3}, \\quad b_\\infty = \\left[\\frac{1}{1 + e^{0.0688 (V + 53.3)}}\\right]^{4}',
  ],
  params: CS_PARAMS,
  initial: [{ key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -68 }],
  stimulus: {
    label: 'Injected current density', unit: 'µA/cm²', description: 'Depolarizing current per unit membrane area.',
    default: { kind: 'step', amplitude: 12, startMs: 20, durationMs: 1e9 }, amplitudeRange: [0, 60], kinds: ['step', 'pulse-train', 'ramp', 'none'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-RUSH-LARSEN'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.01, minDtMs: 0.001, maxSafeDtMs: 0.025, defaultDurationMs: 300, maxDurationMs: 2000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential.' }] },
    { kind: 'traces', title: 'A-current gating', yLabel: 'gate value', series: [
      { key: 'a', label: 'a', unit: '', meaning: 'A-current activation gate.' },
      { key: 'b', label: 'b', unit: '', meaning: 'A-current inactivation gate: de-inactivates during the after-hyperpolarization and delays the next spike.' },
    ] },
    { kind: 'traces', title: 'A-type K⁺ current', yLabel: 'I_A (µA/cm²)', series: [{ key: 'I_A', label: 'I_A', unit: 'µA/cm²', meaning: 'Transient outward A-current that slows the approach to threshold.' }] },
  ],
  metrics: [...SPIKE_METRICS, { key: 'restingPotentialMv', label: 'Resting potential', unit: 'mV', description: 'Root of the steady-state ionic current, found by bisection.' }],
  presets: [
    { id: 'typeI', label: 'With A-current (low-frequency firing)', description: 'A-current allows arbitrarily low firing rates near rheobase.', stimulus: { kind: 'step', amplitude: 9.5, startMs: 20, durationMs: 1e9 }, durationMs: 600, experimentId: 'EXP-010' },
    { id: 'noA', label: 'A-current removed', description: 'ḡ_A = 0: firing onset jumps to a higher frequency.', params: { g_A_max: 0 }, stimulus: { kind: 'step', amplitude: 9.5, startMs: 20, durationMs: 1e9 }, durationMs: 600, experimentId: 'EXP-010' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 6, to: 30, steps: 13, metricKey: 'firingRateHz', experimentId: 'EXP-010' },
  kernelLimitations: ['Fixed reversal potentials (E_Na = 55, E_K = −72, E_L = −17 mV) from the reference parameter set.', 'Single compartment; kinetics fitted to crustacean axons.'],
  run: runCS,
};

// ───────────────────────── MODEL-004 FitzHugh–Nagumo ─────────────────────────

const FHN_PARAMS: ParamSpec[] = [
  { key: 'a_FHN', label: 'Offset a', symbol: 'a', unit: '', default: 0.7, min: 0.1, max: 1.5, step: 0.01, registryId: 'PARAM-015', description: 'Shifts the recovery nullcline and therefore the resting state.' },
  { key: 'b_FHN', label: 'Slope b', symbol: 'b', unit: '', default: 0.8, min: 0.1, max: 2, step: 0.01, registryId: 'PARAM-016', description: 'Slope of the linear recovery nullcline.' },
  { key: 'eps_FHN', label: 'Timescale ratio ε', symbol: '\\epsilon', unit: '', default: 0.08, min: 0.01, max: 0.5, step: 0.005, registryId: 'PARAM-017', description: 'Ratio of recovery to excitation time scales; small ε gives relaxation oscillations.' },
];

export function fhnFixedPoint(a: number, b: number, I: number): { v: number; w: number; trace: (eps: number) => number; det: (eps: number) => number } {
  // g(v) = v − v³/3 − (v + a)/b + I is strictly decreasing for b < 1; bracket and bisect.
  const g = (v: number) => v - (v * v * v) / 3 - (v + a) / b + I;
  let lo = -5, hi = 5;
  for (let i = 0; i < 100; i++) { const mid = 0.5 * (lo + hi); if (g(mid) > 0) lo = mid; else hi = mid; }
  const v = 0.5 * (lo + hi);
  return { v, w: (v + a) / b, trace: (eps) => 1 - v * v - eps * b, det: (eps) => eps * (1 - b * (1 - v * v)) };
}

function runFHN(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(FHN_PARAMS, cfg.params);
  const a = p('a_FHN'), b = p('b_FHN'), eps = p('eps_FHN');
  const stim = makeStimulus(cfg.stimulus, cfg.dtMs, cfg.durationMs, cfg.seed);
  const y0 = Float64Array.of(cfg.initial.v ?? -1.2, cfg.initial.w ?? -0.625);
  const deriv: Deriv = (t, y, d) => {
    const v = y[0]!, w = y[1]!;
    d[0] = v - (v * v * v) / 3 - w + stim(t);
    d[1] = eps * (v + a - b * w);
  };
  const res = runOde({
    cfg, ctx, y0, deriv, recordKeys: ['v', 'w', 'I_ext'],
    record: (j, t, y, s) => { s.v![j] = y[0]!; s.w![j] = y[1]!; s.I_ext![j] = stim(t); },
    spike: { index: 0, threshold: 1.0, rearm: 0 },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const I = cfg.stimulus.kind === 'none' ? cfg.stimulus.baseline : cfg.stimulus.baseline + cfg.stimulus.amplitude;
  const vs = linspace(-2.5, 2.5, 201);
  out.curves.v_nullcline = curveFrom(vs, (v) => v - (v * v * v) / 3 + I);
  out.curves.w_nullcline = curveFrom(vs, (v) => (v + a) / b);
  const fp = fhnFixedPoint(a, b, I);
  const half = Math.floor(res.t.length / 2);
  const tail = res.series.v!.subarray(half);
  out.metrics.fixedPointV = fp.v;
  out.metrics.fixedPointW = fp.w;
  out.metrics.jacobianTrace = fp.trace(eps);
  out.metrics.jacobianDet = fp.det(eps);
  out.metrics.lateAmplitude = maxOf(tail) - minOf(tail);
  out.metrics.spikeCount = res.spikeTimes.length;
  const sm = spikeMetrics(res.spikeTimes, cfg.stimulus.startMs, cfg.durationMs);
  out.metrics.oscillationPeriod = sm.meanIsiMs;
  out.curves.spikeTimes = { x: Float64Array.from(res.spikeTimes), y: new Float64Array(res.spikeTimes.length) };
  out.notes.push(
    fp.trace(eps) < 0 && fp.det(eps) > 0
      ? `Fixed point (v* = ${fp.v.toFixed(3)}) is linearly stable: trace ${fp.trace(eps).toFixed(3)} < 0.`
      : `Fixed point (v* = ${fp.v.toFixed(3)}) is unstable (trace ${fp.trace(eps).toFixed(3)}): trajectories converge to a limit cycle.`,
  );
  return out;
}

export const MODEL_004: ModelDefinition = {
  id: 'MODEL-004',
  name: 'FitzHugh–Nagumo',
  equations: ['\\frac{dv}{dt} = v - \\frac{v^3}{3} - w + I_{ext}', '\\frac{dw}{dt} = \\epsilon\\,(v + a - b\\,w)'],
  params: FHN_PARAMS,
  initial: [
    { key: 'v', label: 'Fast variable v₀', unit: '', default: -1.2 },
    { key: 'w', label: 'Recovery variable w₀', unit: '', default: -0.625 },
  ],
  stimulus: {
    label: 'External drive', unit: 'dimensionless', description: 'Constant input that shifts the cubic v-nullcline upward.',
    default: { kind: 'step', amplitude: 0.5, startMs: 0, durationMs: 1e9 }, amplitudeRange: [-0.5, 1.5], kinds: ['step', 'pulse-train', 'ramp', 'sine', 'none'],
  },
  solvers: ['SOLVER-RK4', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.05, minDtMs: 0.005, maxSafeDtMs: 0.25, defaultDurationMs: 300, maxDurationMs: 5000,
  timeUnit: 'dimensionless time',
  stochastic: false,
  views: [
    { kind: 'phase', title: '(v, w) phase plane with nullclines', xKey: 'v', yKey: 'w', xLabel: 'v', yLabel: 'w', curves: [{ key: 'v_nullcline', label: 'v-nullcline (cubic)' }, { key: 'w_nullcline', label: 'w-nullcline (linear)' }] },
    { kind: 'traces', title: 'State variables', yLabel: 'value', spikeMarkers: true, series: [
      { key: 'v', label: 'v', unit: '', meaning: 'Fast regenerative variable (voltage-like).' },
      { key: 'w', label: 'w', unit: '', meaning: 'Slow recovery variable.' },
    ] },
  ],
  metrics: [
    { key: 'fixedPointV', label: 'Fixed point v*', unit: '', description: 'Intersection of the two nullclines.', digits: 4 },
    { key: 'jacobianTrace', label: 'Jacobian trace', unit: '', description: 'Trace of the linearization at the fixed point; negative with positive determinant means stable.', digits: 4 },
    { key: 'jacobianDet', label: 'Jacobian determinant', unit: '', description: 'Determinant of the linearization at the fixed point.', digits: 4 },
    { key: 'lateAmplitude', label: 'Late oscillation amplitude', unit: '', description: 'Peak-to-peak range of v over the second half of the run.' },
    { key: 'oscillationPeriod', label: 'Oscillation period', unit: 'time units', description: 'Mean interval between upward crossings of v = 1.' },
  ],
  presets: [
    { id: 'rest', label: 'Excitable rest (I = 0)', description: 'Stable fixed point (VAL-FHN-001).', stimulus: { kind: 'none', amplitude: 0 }, experimentId: 'EXP-011' },
    { id: 'cycle', label: 'Limit cycle (I = 0.5)', description: 'Hopf bifurcation crossed: sustained relaxation oscillation.', stimulus: { kind: 'step', amplitude: 0.5, startMs: 0, durationMs: 1e9 }, experimentId: 'EXP-011' },
    { id: 'kick', label: 'Single excursion from a kick', description: 'A brief pulse sends the trajectory around the cubic nullcline once.', stimulus: { kind: 'pulse-train', amplitude: 0.8, startMs: 20, pulseWidthMs: 4, pulseCount: 1, pulseIntervalMs: 100 } },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 0, to: 1.5, steps: 16, metricKey: 'lateAmplitude', experimentId: 'EXP-011' },
  kernelLimitations: ['Dimensionless phenomenological variables: v and w do not map onto specific ion channels or millivolts.'],
  run: runFHN,
};
