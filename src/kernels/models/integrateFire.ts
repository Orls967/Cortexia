// MODEL-005 CUBA-LIF, MODEL-006 COBA-LIF, MODEL-007 QIF, MODEL-008 AdEx, MODEL-009 Izhikevich.
// Point-neuron unit system: pF, nS, pA, mV, ms (pF·mV/ms = pA = nS·mV). MΩ·pA = 10⁻³ mV.
import { DIVERGENCE_NOTE } from '../core/odeRun';
import { curveFrom, diverged, finishRecorder, linspace, makeRecorder, maxOf, meanOf, paramReader, spikeMetrics, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import { makeStimulus } from '../core/stimulus';
import type { MetricSpec, ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';

const RATE_METRICS: MetricSpec[] = [
  { key: 'spikeCount', label: 'Spike count', unit: 'spikes', description: 'Number of threshold crossings (emitted spikes).', analyticId: 'ANALYTIC-009', digits: 0 },
  { key: 'firingRateHz', label: 'Firing rate', unit: 'Hz', description: 'Steady firing rate, 1000 / mean inter-spike interval.', analyticId: 'ANALYTIC-009' },
  { key: 'firstSpikeLatencyMs', label: 'First-spike latency', unit: 'ms', description: 'Time from stimulus onset to the first spike.', analyticId: 'ANALYTIC-012' },
  { key: 'cvIsi', label: 'CV of ISI', unit: '', description: 'Coefficient of variation of inter-spike intervals.', analyticId: 'ANALYTIC-010', digits: 3 },
];

function finalize(out: ModelOutput, spikes: number[], cfg: RunConfig): void {
  const m = spikeMetrics(spikes, cfg.stimulus.startMs, cfg.durationMs);
  out.metrics.spikeCount = m.spikeCount;
  out.metrics.firingRateHz = m.firingRateHz;
  out.metrics.firstSpikeLatencyMs = m.firstSpikeLatencyMs;
  out.metrics.cvIsi = m.cvIsi;
  out.metrics.adaptationRatio = m.adaptationRatio;
  out.curves.spikeTimes = { x: Float64Array.from(spikes), y: new Float64Array(spikes.length) };
  if (spikes.length > 1) {
    const isi = new Float64Array(spikes.length - 1);
    const idx = new Float64Array(spikes.length - 1);
    for (let i = 1; i < spikes.length; i++) { isi[i - 1] = spikes[i]! - spikes[i - 1]!; idx[i - 1] = i; }
    out.curves.isiSequence = { x: idx, y: isi };
  }
}

// ───────────────────────── MODEL-005 CUBA-LIF ─────────────────────────

const LIF_PARAMS: ParamSpec[] = [
  { key: 'tau_m_LIF', label: 'Membrane time constant', symbol: '\\tau_m', unit: 'ms', default: 20, min: 2, max: 100, step: 0.5, registryId: 'PARAM-018', description: 'Product R_m C_m; time for the membrane to relax 63% toward its steady state.' },
  { key: 'R_m_LIF', label: 'Membrane input resistance', symbol: 'R_m', unit: 'MΩ', default: 100, min: 10, max: 500, step: 1, registryId: 'PARAM-019', description: 'Converts injected current into steady-state depolarization (100 MΩ × 100 pA = 10 mV).' },
  { key: 'V_th_LIF', label: 'Spike threshold', symbol: 'V_{th}', unit: 'mV', default: -50, min: -60, max: -35, step: 0.5, registryId: 'PARAM-020', description: 'Voltage at which a spike is emitted and the membrane is reset.' },
  { key: 'V_reset_LIF', label: 'Reset potential', symbol: 'V_{reset}', unit: 'mV', default: -65, min: -80, max: -52, step: 0.5, registryId: 'PARAM-021', description: 'Voltage immediately after a spike.' },
  { key: 'tau_ref_LIF', label: 'Absolute refractory period', symbol: '\\tau_{ref}', unit: 'ms', default: 2, min: 0, max: 10, step: 0.1, registryId: 'PARAM-022', description: 'Interval after each spike during which the voltage is clamped at reset.' },
  { key: 'E_L_LIF', label: 'Leak reversal potential', symbol: 'E_L', unit: 'mV', default: -70, min: -85, max: -55, step: 0.5, description: 'Resting potential in the absence of input.' },
];

/** Closed-form CUBA-LIF firing rate (EQ-LIF-FI). Current in pA, resistance in MΩ. */
export function lifAnalyticRate(I: number, tau: number, R: number, EL: number, Vth: number, Vreset: number, tref: number): number {
  const drive = R * I * 1e-3;
  if (drive + EL <= Vth) return 0;
  return 1000 / (tref + tau * Math.log((drive + EL - Vreset) / (drive + EL - Vth)));
}

function runLif(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(LIF_PARAMS, cfg.params);
  const tau = p('tau_m_LIF'), R = p('R_m_LIF'), Vth = p('V_th_LIF'), Vreset = p('V_reset_LIF'), tref = p('tau_ref_LIF'), EL = p('E_L_LIF');
  if (Vreset >= Vth) throw new SimulationError('ERR_INVALID_PARAMS', 'Reset potential must lie below the spike threshold.');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rec = makeRecorder(['V', 'I_ext'], nSteps);
  const spikes: number[] = [];
  let V = cfg.initial.V ?? EL;
  let refrLeft = 0;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.V![0] = V; rec.s.I_ext![0] = stim(0); rec.written = 1;
  const dv = (v: number, I: number) => (-(v - EL) + R * I * 1e-3) / tau;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I = stim(t);
    if (cfg.solver === 'SOLVER-EXACT-LIF') {
      // Exact propagator for piecewise-constant input, with analytic threshold-crossing time inside the step.
      let remaining = dt, tl = t, guard = 0;
      const vInf = EL + R * I * 1e-3;
      while (remaining > 1e-15) {
        if (++guard > 10000) throw new SimulationError('ERR_NUMERICAL_DIVERGENCE', 'Spike cascade inside a single step; check threshold and reset.', t);
        if (refrLeft > 0) {
          const d = Math.min(refrLeft, remaining);
          refrLeft -= d; remaining -= d; tl += d; V = Vreset;
          continue;
        }
        const vNext = vInf + (V - vInf) * Math.exp(-remaining / tau);
        if (vInf > Vth && vNext >= Vth) {
          const tc = tau * Math.log((vInf - V) / (vInf - Vth));
          spikes.push(tl + tc);
          V = Vreset; refrLeft = tref; remaining -= tc; tl += tc;
          if (tref === 0 && tc <= 0) break;
        } else {
          V = vNext; remaining = 0;
        }
      }
    } else if (refrLeft > 0) {
      refrLeft = Math.max(0, refrLeft - dt);
      V = Vreset;
    } else {
      const prev = V;
      if (cfg.solver === 'SOLVER-FE') {
        V = V + dt * dv(V, I);
      } else {
        // SOLVER-HYBRID-SPIKE: RK4 sub-step with linear threshold interpolation (input constant over the step).
        const k1 = dv(V, I), k2 = dv(V + 0.5 * dt * k1, I), k3 = dv(V + 0.5 * dt * k2, I), k4 = dv(V + dt * k3, I);
        V = V + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      }
      if (V >= Vth) {
        const frac = cfg.solver === 'SOLVER-FE' ? 1 : (Vth - prev) / (V - prev);
        spikes.push(t + frac * dt);
        V = Vreset;
        refrLeft = Math.max(0, tref - (1 - frac) * dt);
      }
    }
    if (diverged(V)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.V![j] = V; rec.s.I_ext![j] = stim(k * dt); rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  finalize(out, spikes, cfg);
  const I0 = cfg.stimulus.baseline + cfg.stimulus.amplitude;
  const rheobase = ((Vth - EL) / R) * 1e3;
  out.metrics.rheobasePa = rheobase;
  out.metrics.analyticRateHz = lifAnalyticRate(I0, tau, R, EL, Vth, Vreset, tref);
  if (cfg.stimulus.kind === 'step' && spikes.length > 2) {
    out.metrics.relativeErrorPct = (100 * Math.abs(out.metrics.firingRateHz! - out.metrics.analyticRateHz)) / out.metrics.analyticRateHz;
  }
  out.curves.fI_analytic = curveFrom(linspace(0, Math.max(600, 1.5 * I0), 121), (I) => lifAnalyticRate(I, tau, R, EL, Vth, Vreset, tref));
  out.curves.fI_simulated = { x: Float64Array.of(I0), y: Float64Array.of(out.metrics.firingRateHz ?? 0) };
  return out;
}

export const MODEL_005: ModelDefinition = {
  id: 'MODEL-005',
  name: 'Leaky Integrate-and-Fire (current-based)',
  equations: [
    '\\tau_m \\frac{dV}{dt} = -(V - E_L) + R_m I_{ext}(t)',
    'V \\ge V_{th} \\;\\Rightarrow\\; \\text{spike},\\; V \\leftarrow V_{reset},\\; \\text{clamp for } \\tau_{ref}',
    'f(I) = \\left[\\tau_{ref} + \\tau_m \\ln\\frac{R_m I + E_L - V_{reset}}{R_m I + E_L - V_{th}}\\right]^{-1}',
  ],
  params: LIF_PARAMS,
  initial: [{ key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -70 }],
  stimulus: {
    label: 'Injected current', unit: 'pA', description: 'Electrode current into the cell (positive = depolarizing).',
    default: { kind: 'step', amplitude: 300, startMs: 20, durationMs: 1e9 }, amplitudeRange: [0, 800], kinds: ['step', 'pulse-train', 'ramp', 'sine', 'ou-noise', 'none'],
  },
  solvers: ['SOLVER-EXACT-LIF', 'SOLVER-HYBRID-SPIKE', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-EXACT-LIF', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.5, defaultDurationMs: 500, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Subthreshold membrane potential; spikes are instantaneous reset events.' }] },
    { kind: 'curve', title: 'f–I curve: closed form vs this run', xLabel: 'I (pA)', yLabel: 'f (Hz)', meaning: 'Steady firing rate as a function of injected current.', curves: [{ key: 'fI_analytic', label: 'Analytical EQ-LIF-FI' }, { key: 'fI_simulated', label: 'Simulated', points: true }] },
    { kind: 'traces', title: 'Stimulus', yLabel: 'I (pA)', series: [{ key: 'I_ext', label: 'I_ext', unit: 'pA', meaning: 'Injected current waveform.' }] },
  ],
  metrics: [
    ...RATE_METRICS,
    { key: 'analyticRateHz', label: 'Analytical rate', unit: 'Hz', description: 'Closed-form firing rate for a constant current of this amplitude.' },
    { key: 'relativeErrorPct', label: 'Numerical vs analytical error', unit: '%', description: 'Relative difference between simulated and closed-form firing rate (VAL-LIF-001 tolerance 0.2%).', digits: 4 },
    { key: 'rheobasePa', label: 'Rheobase', unit: 'pA', description: 'Minimum constant current that reaches threshold: (V_th − E_L) / R_m.' },
  ],
  presets: [
    { id: 'supra', label: 'Suprathreshold step (300 pA)', description: 'Regular firing; compare with the closed-form rate.', stimulus: { kind: 'step', amplitude: 300, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-012' },
    { id: 'sub', label: 'Subthreshold step (150 pA)', description: 'Exponential charging without spikes.', stimulus: { kind: 'step', amplitude: 150, startMs: 20, durationMs: 1e9 } },
    { id: 'noise', label: 'Ornstein–Uhlenbeck noisy drive', description: 'Fluctuation-driven irregular firing (seeded, reproducible).', stimulus: { kind: 'ou-noise', amplitude: 190, sigma: 60, tauMs: 5, startMs: 0, durationMs: 1e9 }, durationMs: 2000, experimentId: 'EXP-017' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 200, to: 600, steps: 17, metricKey: 'firingRateHz', experimentId: 'EXP-012' },
  kernelLimitations: ['No spike waveform, no adaptation, no voltage-dependent conductances.', 'Input current is held constant across each solver step.'],
  run: runLif,
};

// ───────────────────────── MODEL-006 COBA-LIF ─────────────────────────

const COBA_PARAMS: ParamSpec[] = [
  { key: 'C_m_COBA', label: 'Membrane capacitance', symbol: 'C_m', unit: 'pF', default: 200, min: 50, max: 600, step: 5, registryId: 'PARAM-023', description: 'Total membrane capacitance of the cell.', group: 'Membrane' },
  { key: 'g_L_COBA', label: 'Leak conductance', symbol: 'g_L', unit: 'nS', default: 10, min: 1, max: 50, step: 0.5, registryId: 'PARAM-024', description: 'Resting leak conductance; τ_m = C_m / g_L when synapses are silent.', group: 'Membrane' },
  { key: 'E_L', label: 'Leak reversal', symbol: 'E_L', unit: 'mV', default: -70, min: -85, max: -55, step: 0.5, description: 'Leak reversal potential.', group: 'Membrane' },
  { key: 'V_th', label: 'Spike threshold', symbol: 'V_{th}', unit: 'mV', default: -50, min: -60, max: -35, step: 0.5, description: 'Spike threshold.', group: 'Membrane' },
  { key: 'V_reset', label: 'Reset potential', symbol: 'V_{reset}', unit: 'mV', default: -65, min: -80, max: -52, step: 0.5, description: 'Post-spike reset potential.', group: 'Membrane' },
  { key: 'tau_ref', label: 'Refractory period', symbol: '\\tau_{ref}', unit: 'ms', default: 2, min: 0, max: 10, step: 0.1, description: 'Absolute refractory period.', group: 'Membrane' },
  { key: 'E_E', label: 'Excitatory reversal', symbol: 'E_E', unit: 'mV', default: 0, min: -20, max: 20, step: 1, description: 'Reversal potential of AMPA-type excitation.', group: 'Synapses' },
  { key: 'E_I', label: 'Inhibitory reversal', symbol: 'E_I', unit: 'mV', default: -75, min: -90, max: -55, step: 1, description: 'Reversal potential of GABA_A-type inhibition. Near rest it acts by shunting.', group: 'Synapses' },
  { key: 'tau_E', label: 'Excitatory decay', symbol: '\\tau_E', unit: 'ms', default: 5, min: 1, max: 20, step: 0.5, description: 'Decay time constant of excitatory conductance.', group: 'Synapses' },
  { key: 'tau_I', label: 'Inhibitory decay', symbol: '\\tau_I', unit: 'ms', default: 10, min: 1, max: 30, step: 0.5, description: 'Decay time constant of inhibitory conductance.', group: 'Synapses' },
  { key: 'w_E', label: 'Excitatory quantal conductance', symbol: 'w_E', unit: 'nS', default: 0.6, min: 0, max: 5, step: 0.05, description: 'Conductance increment per excitatory presynaptic spike.', group: 'Synapses' },
  { key: 'w_I', label: 'Inhibitory quantal conductance', symbol: 'w_I', unit: 'nS', default: 2.0, min: 0, max: 10, step: 0.1, description: 'Conductance increment per inhibitory presynaptic spike.', group: 'Synapses' },
  { key: 'rate_E', label: 'Excitatory input rate', symbol: '\\nu_E', unit: 'Hz', default: 3000, min: 0, max: 20000, step: 50, description: 'Summed Poisson rate of all excitatory afferents.', group: 'Presynaptic drive' },
  { key: 'rate_I', label: 'Inhibitory input rate', symbol: '\\nu_I', unit: 'Hz', default: 600, min: 0, max: 10000, step: 50, description: 'Summed Poisson rate of all inhibitory afferents.', group: 'Presynaptic drive' },
];

function runCoba(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(COBA_PARAMS, cfg.params);
  const C = p('C_m_COBA'), gL = p('g_L_COBA'), EL = p('E_L'), Vth = p('V_th'), Vreset = p('V_reset'), tref = p('tau_ref');
  const EE = p('E_E'), EI = p('E_I'), tauE = p('tau_E'), tauI = p('tau_I'), wE = p('w_E'), wI = p('w_I'), rE = p('rate_E'), rI = p('rate_I');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rng = new Rng(cfg.seed);
  const rec = makeRecorder(['V', 'g_E', 'g_I', 'I_syn'], nSteps);
  const spikes: number[] = [];
  let V = cfg.initial.V ?? EL, gE = cfg.initial.g_E ?? 0, gI = cfg.initial.g_I ?? 0, refrLeft = 0;
  const decE = Math.exp(-dt / tauE), decI = Math.exp(-dt / tauI);
  let sumGE = 0, sumGI = 0, sumV = 0, freeSteps = 0;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  const f = (v: number, ge: number, gi: number, I: number) => (-gL * (v - EL) - ge * (v - EE) - gi * (v - EI) + I) / C;
  rec.s.V![0] = V; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I = stim(t);
    // Conductances decay exactly; presynaptic Poisson events arrive at the start of the step.
    gE += wE * rng.poisson((rE * dt) / 1000);
    gI += wI * rng.poisson((rI * dt) / 1000);
    const gE1 = gE * decE, gI1 = gI * decI;
    if (refrLeft > 0) {
      refrLeft = Math.max(0, refrLeft - dt);
      V = Vreset;
    } else {
      const prev = V;
      if (cfg.solver === 'SOLVER-RK4' || cfg.solver === 'SOLVER-HYBRID-SPIKE') {
        const gEm = Math.sqrt(gE * gE1) || 0.5 * (gE + gE1), gIm = Math.sqrt(gI * gI1) || 0.5 * (gI + gI1);
        const k1 = f(V, gE, gI, I), k2 = f(V + 0.5 * dt * k1, gEm, gIm, I), k3 = f(V + 0.5 * dt * k2, gEm, gIm, I), k4 = f(V + dt * k3, gE1, gI1, I);
        V += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      } else {
        throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by MODEL-006.`);
      }
      if (V >= Vth) {
        const frac = (Vth - prev) / (V - prev);
        spikes.push(t + frac * dt);
        V = Vreset;
        refrLeft = Math.max(0, tref - (1 - frac) * dt);
      } else {
        sumV += V; freeSteps++;
      }
    }
    gE = gE1; gI = gI1;
    sumGE += gE; sumGI += gI;
    if (diverged(V)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) {
        rec.t[j] = k * dt; rec.s.V![j] = V; rec.s.g_E![j] = gE; rec.s.g_I![j] = gI;
        rec.s.I_syn![j] = gE * (V - EE) + gI * (V - EI); rec.written = j + 1;
      }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  finalize(out, spikes, cfg);
  const mGE = sumGE / nSteps, mGI = sumGI / nSteps;
  out.metrics.firingRateHz = (spikes.length * 1000) / cfg.durationMs;
  out.metrics.meanGE = mGE;
  out.metrics.meanGI = mGI;
  out.metrics.effectiveTauMs = C / (gL + mGE + mGI);
  out.metrics.conductanceRatio = (mGE + mGI) / gL;
  out.metrics.meanFreeVoltageMv = freeSteps ? sumV / freeSteps : NaN;
  out.metrics.predictedMeanGE = (wE * rE * tauE) / 1000;
  out.metrics.predictedMeanGI = (wI * rI * tauI) / 1000;
  if (out.metrics.conductanceRatio > 1) out.notes.push(`High-conductance state: synaptic conductance is ${out.metrics.conductanceRatio.toFixed(1)}× the leak, shortening the effective membrane time constant to ${out.metrics.effectiveTauMs.toFixed(1)} ms.`);
  return out;
}

export const MODEL_006: ModelDefinition = {
  id: 'MODEL-006',
  name: 'Leaky Integrate-and-Fire (conductance-based)',
  equations: [
    'C_m \\frac{dV}{dt} = -g_L (V - E_L) - g_E(t)(V - E_E) - g_I(t)(V - E_I) + I_{ext}(t)',
    '\\frac{dg_X}{dt} = -\\frac{g_X}{\\tau_X} + w_X \\sum_f \\delta(t - t_X^{(f)}), \\quad X \\in \\{E, I\\}',
    'V \\ge V_{th} \\;\\Rightarrow\\; V \\leftarrow V_{reset},\\; \\text{clamp for } \\tau_{ref}',
  ],
  params: COBA_PARAMS,
  initial: [
    { key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -70 },
    { key: 'g_E', label: 'Excitatory conductance g_E(0)', unit: 'nS', default: 0 },
    { key: 'g_I', label: 'Inhibitory conductance g_I(0)', unit: 'nS', default: 0 },
  ],
  stimulus: {
    label: 'Injected current', unit: 'pA', description: 'Additional electrode current on top of the synaptic bombardment.',
    default: { kind: 'none', amplitude: 0 }, amplitudeRange: [-200, 600], kinds: ['none', 'step', 'pulse-train', 'sine'],
  },
  solvers: ['SOLVER-HYBRID-SPIKE', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.25, defaultDurationMs: 1000, maxDurationMs: 10000,
  stochastic: true,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential under fluctuating synaptic conductances.' }] },
    { kind: 'traces', title: 'Synaptic conductances', yLabel: 'g (nS)', series: [
      { key: 'g_E', label: 'g_E', unit: 'nS', meaning: 'Total excitatory (AMPA-like) conductance.' },
      { key: 'g_I', label: 'g_I', unit: 'nS', meaning: 'Total inhibitory (GABA_A-like) conductance.' },
    ] },
    { kind: 'traces', title: 'Net synaptic current (outward positive)', yLabel: 'I_syn (pA)', series: [{ key: 'I_syn', label: 'I_syn', unit: 'pA', meaning: 'g_E (V − E_E) + g_I (V − E_I); negative values depolarize.' }] },
  ],
  metrics: [
    ...RATE_METRICS,
    { key: 'meanGE', label: 'Mean g_E', unit: 'nS', description: 'Time-averaged excitatory conductance; predicted value w_E ν_E τ_E.' },
    { key: 'meanGI', label: 'Mean g_I', unit: 'nS', description: 'Time-averaged inhibitory conductance; predicted value w_I ν_I τ_I.' },
    { key: 'effectiveTauMs', label: 'Effective membrane time constant', unit: 'ms', description: 'C_m / (g_L + ⟨g_E⟩ + ⟨g_I⟩): shortened in the high-conductance state.' },
    { key: 'conductanceRatio', label: 'Synaptic / leak conductance', unit: '', description: 'Ratio (⟨g_E⟩ + ⟨g_I⟩) / g_L.' },
  ],
  presets: [
    { id: 'balanced', label: 'Balanced bombardment', description: 'Irregular firing driven by fluctuations.', experimentId: 'EXP-013' },
    { id: 'shunt', label: 'Strong shunting inhibition', description: 'Raising inhibitory rate lowers gain without large hyperpolarization.', params: { rate_I: 2400 }, experimentId: 'EXP-013' },
    { id: 'quiet', label: 'Quiescent network (low conductance)', description: 'Sparse input; membrane time constant returns to C_m / g_L.', params: { rate_E: 300, rate_I: 60 }, stimulus: { kind: 'step', amplitude: 250, startMs: 100, durationMs: 1e9 } },
  ],
  sweep: { paramKey: 'rate_I', from: 0, to: 3000, steps: 11, metricKey: 'firingRateHz', experimentId: 'EXP-013' },
  kernelLimitations: ['Presynaptic activity is homogeneous Poisson; no short-term plasticity or correlations between afferents.', 'Single-exponential conductances with instantaneous rise.'],
  run: runCoba,
};

// ───────────────────────── MODEL-007 QIF ─────────────────────────

const QIF_PARAMS: ParamSpec[] = [
  { key: 'a0_QIF', label: 'Quadratic curvature', symbol: 'a_0', unit: '1/mV', default: 0.08, min: 0.01, max: 0.5, step: 0.005, registryId: 'PARAM-025', description: 'Curvature of the quadratic voltage nonlinearity; sets the sharpness of spike initiation.' },
  { key: 'V_c_QIF', label: 'Critical (unstable) voltage', symbol: 'V_c', unit: 'mV', default: -55, min: -62, max: -45, step: 0.5, registryId: 'PARAM-026', description: 'Unstable fixed point for zero input: voltages above it escape to a spike.' },
  { key: 'V_rest_QIF', label: 'Resting potential', symbol: 'V_{rest}', unit: 'mV', default: -65, min: -80, max: -60, step: 0.5, description: 'Stable fixed point for zero input.' },
  { key: 'tau_m_QIF', label: 'Membrane time constant', symbol: '\\tau_m', unit: 'ms', default: 20, min: 2, max: 100, step: 0.5, description: 'Membrane time constant.' },
  { key: 'R_m_QIF', label: 'Input resistance', symbol: 'R_m', unit: 'MΩ', default: 100, min: 10, max: 500, step: 1, description: 'Converts current to voltage drive.' },
  { key: 'V_peak_QIF', label: 'Spike cutoff', symbol: 'V_{peak}', unit: 'mV', default: 30, min: 0, max: 50, step: 1, description: 'Voltage at which the divergent upstroke is cut off and reset.' },
  { key: 'V_reset_QIF', label: 'Reset potential', symbol: 'V_{reset}', unit: 'mV', default: -65, min: -90, max: -56, step: 0.5, description: 'Voltage after reset.' },
];

export function qifAnalyticRate(I: number, a0: number, Vrest: number, Vc: number, tau: number, R: number, Vpeak: number, Vreset: number): number {
  const delta = Vc - Vrest;
  const k2 = (R * I * 1e-3 - (a0 * delta * delta) / 4) / a0;
  if (k2 <= 0) return 0;
  const k = Math.sqrt(k2), vm = 0.5 * (Vrest + Vc);
  const T = (tau / (a0 * k)) * (Math.atan((Vpeak - vm) / k) - Math.atan((Vreset - vm) / k));
  return 1000 / T;
}

function runQif(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(QIF_PARAMS, cfg.params);
  const a0 = p('a0_QIF'), Vc = p('V_c_QIF'), Vrest = p('V_rest_QIF'), tau = p('tau_m_QIF'), R = p('R_m_QIF'), Vpeak = p('V_peak_QIF'), Vreset = p('V_reset_QIF');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rec = makeRecorder(['V', 'I_ext'], nSteps);
  const spikes: number[] = [];
  let V = cfg.initial.V ?? Vrest;
  const f = (v: number, I: number) => (a0 * (v - Vrest) * (v - Vc) + R * I * 1e-3) / tau;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.V![0] = V; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I0 = stim(t), I1 = stim(t + dt), Im = stim(t + 0.5 * dt);
    const prev = V;
    const k1 = f(V, I0), k2 = f(V + 0.5 * dt * k1, Im), k3 = f(V + 0.5 * dt * k2, Im), k4 = f(V + dt * k3, I1);
    V += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if (!Number.isFinite(V) || V >= Vpeak) {
      const frac = Number.isFinite(V) ? (Vpeak - prev) / (V - prev) : 0.5;
      spikes.push(t + frac * dt);
      V = Vreset;
    }
    if (V < -1e4) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.V![j] = V; rec.s.I_ext![j] = I1; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  finalize(out, spikes, cfg);
  const I0 = cfg.stimulus.baseline + cfg.stimulus.amplitude;
  const rheobase = ((a0 * (Vc - Vrest) ** 2) / 4 / R) * 1e3;
  out.metrics.rheobasePa = rheobase;
  out.metrics.analyticRateHz = qifAnalyticRate(I0, a0, Vrest, Vc, tau, R, Vpeak, Vreset);
  out.curves.fI_analytic = curveFrom(linspace(0, Math.max(4 * rheobase, 1.5 * I0), 161), (I) => qifAnalyticRate(I, a0, Vrest, Vc, tau, R, Vpeak, Vreset));
  out.curves.fI_simulated = { x: Float64Array.of(I0), y: Float64Array.of(out.metrics.firingRateHz ?? 0) };
  return out;
}

export const MODEL_007: ModelDefinition = {
  id: 'MODEL-007',
  name: 'Quadratic Integrate-and-Fire',
  equations: [
    '\\tau_m \\frac{dV}{dt} = a_0 (V - V_{rest})(V - V_c) + R_m I_{ext}(t)',
    'V \\ge V_{peak} \\;\\Rightarrow\\; V \\leftarrow V_{reset}',
    'I_{rh} = \\frac{a_0 (V_c - V_{rest})^2}{4 R_m}, \\qquad f \\propto \\sqrt{I - I_{rh}} \\text{ near onset (SNIC)}',
  ],
  params: QIF_PARAMS,
  initial: [{ key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -65 }],
  stimulus: {
    label: 'Injected current', unit: 'pA', description: 'Electrode current (positive = depolarizing).',
    default: { kind: 'step', amplitude: 40, startMs: 20, durationMs: 1e9 }, amplitudeRange: [0, 200], kinds: ['step', 'pulse-train', 'ramp', 'ou-noise', 'none'],
  },
  solvers: ['SOLVER-HYBRID-SPIKE', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.05, minDtMs: 0.01, maxSafeDtMs: 0.2, defaultDurationMs: 1000, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential with intrinsic quadratic spike upstroke.' }] },
    { kind: 'curve', title: 'f–I curve: closed form vs this run', xLabel: 'I (pA)', yLabel: 'f (Hz)', meaning: 'Type I excitability: firing rate grows continuously from zero.', curves: [{ key: 'fI_analytic', label: 'Analytical (arctangent period)' }, { key: 'fI_simulated', label: 'Simulated', points: true }] },
  ],
  metrics: [
    ...RATE_METRICS,
    { key: 'analyticRateHz', label: 'Analytical rate', unit: 'Hz', description: 'Closed-form rate from the integral of the quadratic flow between reset and peak.' },
    { key: 'rheobasePa', label: 'Rheobase', unit: 'pA', description: 'Current at which the two fixed points merge (saddle-node).' },
  ],
  presets: [
    { id: 'near', label: 'Just above rheobase', description: 'Long latency and slow firing: the hallmark of a SNIC bifurcation.', stimulus: { kind: 'step', amplitude: 21, startMs: 20, durationMs: 1e9 }, durationMs: 3000, experimentId: 'EXP-014' },
    { id: 'strong', label: 'Strong drive', description: 'Rate approaches the square-root scaling regime.', stimulus: { kind: 'step', amplitude: 80, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-014' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 18, to: 60, steps: 15, metricKey: 'firingRateHz', experimentId: 'EXP-014' },
  kernelLimitations: ['The spike upstroke is cut off at V_peak; no repolarizing current is modelled.', 'No adaptation or refractory conductance.'],
  run: runQif,
};

// ───────────────────────── MODEL-008 AdEx ─────────────────────────

const ADEX_PARAMS: ParamSpec[] = [
  { key: 'Delta_T_AdEx', label: 'Slope factor', symbol: '\\Delta_T', unit: 'mV', default: 2.0, min: 0.5, max: 6, step: 0.1, registryId: 'PARAM-027', description: 'Sharpness of exponential spike initiation by Na⁺ channel activation.', group: 'Spike initiation' },
  { key: 'V_T_AdEx', label: 'Effective threshold', symbol: 'V_T', unit: 'mV', default: -50.4, min: -60, max: -40, step: 0.1, registryId: 'PARAM-028', description: 'Voltage where the exponential current equals the leak slope.', group: 'Spike initiation' },
  { key: 'a_AdEx', label: 'Subthreshold adaptation', symbol: 'a', unit: 'nS', default: 4.0, min: -2, max: 20, step: 0.1, registryId: 'PARAM-029', description: 'Coupling of the adaptation current to subthreshold voltage.', group: 'Adaptation' },
  { key: 'b_AdEx', label: 'Spike-triggered adaptation', symbol: 'b', unit: 'pA', default: 80.5, min: 0, max: 300, step: 0.5, registryId: 'PARAM-030', description: 'Increment of the adaptation current at each spike.', group: 'Adaptation' },
  { key: 'tau_w_AdEx', label: 'Adaptation time constant', symbol: '\\tau_w', unit: 'ms', default: 144, min: 10, max: 500, step: 1, registryId: 'PARAM-031', description: 'Decay time of the adaptation current.', group: 'Adaptation' },
  { key: 'C_m', label: 'Membrane capacitance', symbol: 'C_m', unit: 'pF', default: 281, min: 50, max: 600, step: 1, description: 'Total membrane capacitance.', group: 'Membrane' },
  { key: 'g_L', label: 'Leak conductance', symbol: 'g_L', unit: 'nS', default: 30, min: 1, max: 60, step: 0.5, description: 'Leak conductance.', group: 'Membrane' },
  { key: 'E_L', label: 'Leak reversal', symbol: 'E_L', unit: 'mV', default: -70.6, min: -85, max: -55, step: 0.1, description: 'Leak reversal potential.', group: 'Membrane' },
  { key: 'V_reset', label: 'Reset potential', symbol: 'V_{reset}', unit: 'mV', default: -70.6, min: -85, max: -45, step: 0.1, description: 'Reset potential; raising it toward V_T produces bursting.', group: 'Membrane' },
  { key: 'V_peak', label: 'Spike cutoff', symbol: 'V_{peak}', unit: 'mV', default: 0, min: -20, max: 30, step: 1, description: 'Voltage at which a spike is registered and the reset applied.', group: 'Membrane' },
];

function runAdex(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(ADEX_PARAMS, cfg.params);
  const dT = p('Delta_T_AdEx'), VT = p('V_T_AdEx'), a = p('a_AdEx'), b = p('b_AdEx'), tauW = p('tau_w_AdEx');
  const C = p('C_m'), gL = p('g_L'), EL = p('E_L'), Vreset = p('V_reset'), Vpeak = p('V_peak');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rec = makeRecorder(['V', 'w', 'I_ext'], nSteps);
  const spikes: number[] = [];
  let V = cfg.initial.V ?? EL, w = cfg.initial.w ?? 0;
  // Solver guard-rail: exponent capped at 20 (NEURON_MODELS §8).
  const fV = (v: number, ww: number, I: number) => (-gL * (v - EL) + gL * dT * Math.exp(Math.min(20, (v - VT) / dT)) - ww + I) / C;
  const fW = (v: number, ww: number) => (a * (v - EL) - ww) / tauW;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.V![0] = V; rec.s.w![0] = w; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I0 = stim(t), Im = stim(t + 0.5 * dt), I1 = stim(t + dt);
    const prev = V;
    const k1v = fV(V, w, I0), k1w = fW(V, w);
    const k2v = fV(V + 0.5 * dt * k1v, w + 0.5 * dt * k1w, Im), k2w = fW(V + 0.5 * dt * k1v, w + 0.5 * dt * k1w);
    const k3v = fV(V + 0.5 * dt * k2v, w + 0.5 * dt * k2w, Im), k3w = fW(V + 0.5 * dt * k2v, w + 0.5 * dt * k2w);
    const k4v = fV(V + dt * k3v, w + dt * k3w, I1), k4w = fW(V + dt * k3v, w + dt * k3w);
    V += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    w += (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (!Number.isFinite(V) || V >= Vpeak) {
      const frac = Number.isFinite(V) && V > prev ? Math.min(1, Math.max(0, (Vpeak - prev) / (V - prev))) : 0.5;
      spikes.push(t + frac * dt);
      V = Vreset;
      if (!Number.isFinite(w)) w = 0;
      w += b;
    }
    if (diverged(w) || V < -1e4) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.V![j] = V; rec.s.w![j] = w; rec.s.I_ext![j] = I1; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  finalize(out, spikes, cfg);
  out.metrics.meanAdaptationPa = meanOf(series.w!);
  const vs = linspace(-90, -40, 201);
  const I = cfg.stimulus.baseline + cfg.stimulus.amplitude;
  out.curves.V_nullcline = curveFrom(vs, (v) => -gL * (v - EL) + gL * dT * Math.exp(Math.min(20, (v - VT) / dT)) + I);
  out.curves.w_nullcline = curveFrom(vs, (v) => a * (v - EL));
  if (Number.isFinite(out.metrics.adaptationRatio) && out.metrics.adaptationRatio! > 1.2) out.notes.push(`Spike-frequency adaptation: the last inter-spike interval is ${out.metrics.adaptationRatio!.toFixed(2)}× the first.`);
  return out;
}

export const MODEL_008: ModelDefinition = {
  id: 'MODEL-008',
  name: 'Adaptive Exponential Integrate-and-Fire',
  equations: [
    'C_m \\frac{dV}{dt} = -g_L (V - E_L) + g_L \\Delta_T \\exp\\!\\left(\\frac{V - V_T}{\\Delta_T}\\right) - w + I_{ext}(t)',
    '\\tau_w \\frac{dw}{dt} = a (V - E_L) - w',
    'V \\ge V_{peak} \\;\\Rightarrow\\; V \\leftarrow V_{reset},\\; w \\leftarrow w + b',
  ],
  params: ADEX_PARAMS,
  initial: [
    { key: 'V', label: 'Membrane potential V₀', unit: 'mV', default: -70.6 },
    { key: 'w', label: 'Adaptation current w₀', unit: 'pA', default: 0 },
  ],
  stimulus: {
    label: 'Injected current', unit: 'pA', description: 'Electrode current (positive = depolarizing).',
    default: { kind: 'step', amplitude: 500, startMs: 20, durationMs: 1e9 }, amplitudeRange: [0, 1500], kinds: ['step', 'pulse-train', 'ramp', 'sine', 'ou-noise', 'none'],
  },
  solvers: ['SOLVER-HYBRID-SPIKE', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.05, minDtMs: 0.005, maxSafeDtMs: 0.1, defaultDurationMs: 500, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'V (mV)', spikeMarkers: true, series: [{ key: 'V', label: 'V', unit: 'mV', meaning: 'Membrane potential with exponential spike initiation.' }] },
    { kind: 'traces', title: 'Adaptation current', yLabel: 'w (pA)', series: [{ key: 'w', label: 'w', unit: 'pA', meaning: 'Adaptation current: grows with each spike and slows firing.' }] },
    { kind: 'curve', title: 'Inter-spike interval sequence', xLabel: 'interval index', yLabel: 'ISI (ms)', meaning: 'Successive inter-spike intervals; a rising sequence indicates spike-frequency adaptation.', curves: [{ key: 'isiSequence', label: 'ISI', points: true }] },
    { kind: 'phase', title: '(V, w) phase plane', xKey: 'V', yKey: 'w', xLabel: 'V (mV)', yLabel: 'w (pA)', curves: [{ key: 'V_nullcline', label: 'V-nullcline' }, { key: 'w_nullcline', label: 'w-nullcline' }] },
  ],
  metrics: [
    ...RATE_METRICS,
    { key: 'adaptationRatio', label: 'Adaptation ratio', unit: '', description: 'Last inter-spike interval divided by the first (VAL-ADEX-001 expects > 1.8 for regular spiking).' },
    { key: 'meanAdaptationPa', label: 'Mean adaptation current', unit: 'pA', description: 'Time-averaged w.' },
  ],
  presets: [
    { id: 'rs', label: 'Regular spiking with adaptation', description: 'Cortical pyramidal defaults (Brette & Gerstner 2005).', stimulus: { kind: 'step', amplitude: 500, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-015' },
    { id: 'tonic', label: 'Tonic spiking (no spike-triggered adaptation)', description: 'b = 0 removes adaptation.', params: { b_AdEx: 0, a_AdEx: 0 }, stimulus: { kind: 'step', amplitude: 500, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-015' },
    { id: 'burst', label: 'Bursting', description: 'High reset potential re-triggers spikes within a burst.', params: { V_reset: -47.4, b_AdEx: 60, tau_w_AdEx: 100, a_AdEx: 2 }, stimulus: { kind: 'step', amplitude: 650, startMs: 20, durationMs: 1e9 }, experimentId: 'EXP-015' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 300, to: 1000, steps: 15, metricKey: 'firingRateHz', experimentId: 'EXP-020' },
  kernelLimitations: ['Spike waveform above V_peak is not modelled; the upstroke is truncated and reset.', 'A single adaptation variable lumps several K⁺ currents with different time scales.'],
  run: runAdex,
};

// ───────────────────────── MODEL-009 Izhikevich ─────────────────────────

const IZH_PARAMS: ParamSpec[] = [
  { key: 'a_Izh', label: 'Recovery rate a', symbol: 'a', unit: '1/ms', default: 0.02, min: 0.01, max: 0.2, step: 0.005, registryId: 'PARAM-032', description: 'Time scale of the recovery variable u; larger values recover faster.' },
  { key: 'b_Izh', label: 'Subthreshold sensitivity b', symbol: 'b', unit: '', default: 0.2, min: 0.05, max: 0.3, step: 0.005, registryId: 'PARAM-033', description: 'Coupling of u to subthreshold fluctuations of v.' },
  { key: 'c_Izh', label: 'Voltage reset c', symbol: 'c', unit: 'mV', default: -65, min: -70, max: -45, step: 0.5, registryId: 'PARAM-034', description: 'After-spike reset of v.' },
  { key: 'd_Izh', label: 'Recovery jump d', symbol: 'd', unit: '', default: 8, min: 0.5, max: 16, step: 0.1, registryId: 'PARAM-035', description: 'After-spike increment of u.' },
];

function runIzh(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(IZH_PARAMS, cfg.params);
  const a = p('a_Izh'), b = p('b_Izh'), c = p('c_Izh'), d = p('d_Izh');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const rec = makeRecorder(['v', 'u', 'I_ext'], nSteps);
  const spikes: number[] = [];
  let v = cfg.initial.v ?? -65, u = cfg.initial.u ?? b * v;
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  rec.s.v![0] = v; rec.s.u![0] = u; rec.written = 1;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    const I = stim(t);
    const prev = v;
    // Hybrid scheme: two half-steps for v (numerical stability of the quadratic), one step for u.
    v += 0.5 * dt * (0.04 * v * v + 5 * v + 140 - u + I);
    v += 0.5 * dt * (0.04 * v * v + 5 * v + 140 - u + I);
    u += dt * a * (b * v - u);
    let shown = v;
    if (v >= 30) {
      const frac = v > prev ? Math.min(1, Math.max(0, (30 - prev) / (v - prev))) : 1;
      spikes.push(t + frac * dt);
      shown = 30;
      v = c;
      u += d;
    }
    if (diverged(v) || diverged(u)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) {
      const j = k / rec.stride;
      if (j < rec.n) { rec.t[j] = k * dt; rec.s.v![j] = shown; rec.s.u![j] = u; rec.s.I_ext![j] = I; rec.written = j + 1; }
    }
    if (ctx?.onProgress && k % 20000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  finalize(out, spikes, cfg);
  // Burst statistics: spikes separated by < 10 ms are grouped into one burst.
  let bursts = 0, inBurst = 0, maxPerBurst = 0;
  for (let i = 0; i < spikes.length; i++) {
    if (i === 0 || spikes[i]! - spikes[i - 1]! > 10) { bursts++; inBurst = 1; } else inBurst++;
    maxPerBurst = Math.max(maxPerBurst, inBurst);
  }
  out.metrics.burstCount = bursts;
  out.metrics.spikesPerBurst = bursts ? spikes.length / bursts : 0;
  out.metrics.maxSpikesPerBurst = maxPerBurst;
  out.metrics.peakVoltageMv = maxOf(series.v!);
  const vs = linspace(-80, 30, 221);
  out.curves.v_nullcline = curveFrom(vs, (x) => 0.04 * x * x + 5 * x + 140 + (cfg.stimulus.baseline + cfg.stimulus.amplitude));
  out.curves.u_nullcline = curveFrom(vs, (x) => b * x);
  return out;
}

export const MODEL_009: ModelDefinition = {
  id: 'MODEL-009',
  name: 'Izhikevich',
  equations: [
    '\\frac{dv}{dt} = 0.04 v^2 + 5 v + 140 - u + I_{ext}(t)',
    '\\frac{du}{dt} = a (b v - u)',
    'v \\ge 30\\,\\text{mV} \\;\\Rightarrow\\; v \\leftarrow c,\\; u \\leftarrow u + d',
  ],
  params: IZH_PARAMS,
  initial: [
    { key: 'v', label: 'Membrane potential v₀', unit: 'mV', default: -65 },
    { key: 'u', label: 'Recovery variable u₀', unit: '', default: -13 },
  ],
  stimulus: {
    label: 'Input current', unit: 'model units (≈ pA)', description: 'Phenomenological drive; does not correspond to a specific physical current scale.',
    default: { kind: 'step', amplitude: 10, startMs: 20, durationMs: 1e9 }, amplitudeRange: [-10, 40], kinds: ['step', 'pulse-train', 'ramp', 'sine', 'ou-noise', 'none'],
  },
  solvers: ['SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.02, maxSafeDtMs: 0.5, defaultDurationMs: 500, maxDurationMs: 10000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Membrane potential', yLabel: 'v (mV)', spikeMarkers: true, series: [{ key: 'v', label: 'v', unit: 'mV', meaning: 'Membrane potential (spikes clipped at +30 mV).' }] },
    { kind: 'traces', title: 'Recovery variable', yLabel: 'u', series: [{ key: 'u', label: 'u', unit: '', meaning: 'Recovery variable lumping K⁺ activation and Na⁺ inactivation.' }] },
    { kind: 'phase', title: '(v, u) phase plane', xKey: 'v', yKey: 'u', xLabel: 'v (mV)', yLabel: 'u', curves: [{ key: 'v_nullcline', label: 'v-nullcline' }, { key: 'u_nullcline', label: 'u-nullcline' }] },
  ],
  metrics: [
    ...RATE_METRICS,
    { key: 'burstCount', label: 'Burst count', unit: 'bursts', description: 'Groups of spikes separated by less than 10 ms.', digits: 0 },
    { key: 'spikesPerBurst', label: 'Mean spikes per burst', unit: '', description: 'Spike count divided by burst count; 1 means tonic spiking.' },
    { key: 'adaptationRatio', label: 'Adaptation ratio', unit: '', description: 'Last inter-spike interval divided by the first.' },
  ],
  presets: [
    { id: 'RS', label: 'Regular spiking (RS)', description: 'a = 0.02, b = 0.2, c = −65, d = 8.', params: { a_Izh: 0.02, b_Izh: 0.2, c_Izh: -65, d_Izh: 8 }, experimentId: 'EXP-016' },
    { id: 'IB', label: 'Intrinsically bursting (IB)', description: 'c = −55, d = 4: initial burst then tonic spikes.', params: { a_Izh: 0.02, b_Izh: 0.2, c_Izh: -55, d_Izh: 4 }, experimentId: 'EXP-016' },
    { id: 'CH', label: 'Chattering (CH)', description: 'c = −50, d = 2: repetitive high-frequency bursts.', params: { a_Izh: 0.02, b_Izh: 0.2, c_Izh: -50, d_Izh: 2 }, experimentId: 'EXP-016' },
    { id: 'FS', label: 'Fast spiking (FS)', description: 'a = 0.1: fast recovery, no adaptation.', params: { a_Izh: 0.1, b_Izh: 0.2, c_Izh: -65, d_Izh: 2 }, experimentId: 'EXP-016' },
    { id: 'LTS', label: 'Low-threshold spiking (LTS)', description: 'b = 0.25: low threshold with adaptation.', params: { a_Izh: 0.02, b_Izh: 0.25, c_Izh: -65, d_Izh: 2 }, experimentId: 'EXP-016' },
  ],
  sweep: { paramKey: 'stimulus.amplitude', from: 2, to: 30, steps: 15, metricKey: 'firingRateHz', experimentId: 'EXP-016' },
  kernelLimitations: [
    'Phenomenological: u and I do not map onto specific physical conductances in nS (must be disclosed per NEURON_MODELS §9).',
    'Spike shape is not a biophysical prediction; the peak is clipped at +30 mV.',
  ],
  run: runIzh,
};
