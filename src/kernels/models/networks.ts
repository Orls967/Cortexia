// MODEL-020 feedforward synfire chain, MODEL-021 Brunel balanced network, MODEL-022 Vogels inhibitory plasticity.
// Specification: docs/06-computational-models/SPIKING_NETWORKS.md. Sparse connectivity is stored in CSR typed
// arrays and axonal delays in a circular buffer, giving O(N + active synapses) work per step.
import { peakFrequency, welchPsd } from '../analytics/fft';
import { meanOf, paramReader, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import type { MetricSpec, ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';

const MAX_SPIKES = 600_000;

class SpikeLog {
  times = new Float64Array(65536);
  ids = new Uint32Array(65536);
  count = 0;
  dropped = 0;
  push(t: number, id: number): void {
    if (this.count >= MAX_SPIKES) { this.dropped++; return; }
    if (this.count === this.times.length) {
      const nt = new Float64Array(this.times.length * 2); nt.set(this.times); this.times = nt;
      const ni = new Uint32Array(this.ids.length * 2); ni.set(this.ids); this.ids = ni;
    }
    this.times[this.count] = t; this.ids[this.count] = id; this.count++;
  }
  finish() { return { times: this.times.slice(0, this.count), ids: this.ids.slice(0, this.count) }; }
}

interface Csr { rowPtr: Uint32Array; colIdx: Uint32Array }

/** Builds outgoing CSR adjacency (presynaptic → targets) from per-target presynaptic lists. */
function csrFromInLists(n: number, inLists: Uint32Array[], targetOffset = 0): Csr & { synOfIn: Uint32Array[] } {
  const counts = new Uint32Array(n + 1);
  for (const list of inLists) for (let k = 0; k < list.length; k++) counts[list[k]! + 1] = counts[list[k]! + 1]! + 1;
  for (let i = 0; i < n; i++) counts[i + 1] = counts[i + 1]! + counts[i]!;
  const rowPtr = Uint32Array.from(counts);
  const colIdx = new Uint32Array(rowPtr[n]!);
  const fill = Uint32Array.from(rowPtr.subarray(0, n));
  const synOfIn = inLists.map((l) => new Uint32Array(l.length));
  inLists.forEach((list, post) => {
    for (let k = 0; k < list.length; k++) {
      const pre = list[k]!;
      const pos = fill[pre]!;
      colIdx[pos] = post + targetOffset;
      synOfIn[post]![k] = pos;
      fill[pre] = pos + 1;
    }
  });
  return { rowPtr, colIdx, synOfIn };
}

/** Online per-neuron ISI statistics for CV_ISI. */
class IsiStats {
  last: Float64Array; n: Uint32Array; sum: Float64Array; sum2: Float64Array;
  constructor(n: number) { this.last = new Float64Array(n).fill(NaN); this.n = new Uint32Array(n); this.sum = new Float64Array(n); this.sum2 = new Float64Array(n); }
  spike(i: number, t: number, after: number): void {
    const l = this.last[i]!;
    if (t >= after && !Number.isNaN(l) && l >= after) { const d = t - l; this.n[i] = this.n[i]! + 1; this.sum[i] = this.sum[i]! + d; this.sum2[i] = this.sum2[i]! + d * d; }
    this.last[i] = t;
  }
  meanCv(from: number, to: number, minIsis = 4): number {
    let s = 0, c = 0;
    for (let i = from; i < to; i++) {
      const k = this.n[i]!;
      if (k < minIsis) continue;
      const m = this.sum[i]! / k, v = Math.max(0, this.sum2[i]! / k - m * m);
      s += Math.sqrt(v) / m; c++;
    }
    return c ? s / c : NaN;
  }
}

function boxSmooth(x: Float64Array, w: number): Float64Array {
  const out = new Float64Array(x.length);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += x[i]!;
    if (i >= w) acc -= x[i - w]!;
    out[i] = acc / Math.min(i + 1, w);
  }
  return out;
}

const NET_METRICS: MetricSpec[] = [
  { key: 'meanRateEHz', label: 'Mean excitatory rate', unit: 'Hz', description: 'Average firing rate of excitatory neurons after the initial transient.', analyticId: 'ANALYTIC-009' },
  { key: 'meanRateIHz', label: 'Mean inhibitory rate', unit: 'Hz', description: 'Average firing rate of inhibitory neurons after the initial transient.', analyticId: 'ANALYTIC-009' },
  { key: 'cvIsi', label: 'Mean CV of ISI', unit: '', description: 'Coefficient of variation of inter-spike intervals averaged over neurons; ≈ 1 for Poisson-like irregular firing.', analyticId: 'ANALYTIC-010', digits: 3 },
  { key: 'synchronyChi', label: 'Synchrony index χ', unit: '', description: 'Golomb–Rinzel index: variance of the population-averaged voltage relative to single-cell variance (0 asynchronous, 1 fully synchronous).', analyticId: 'ANALYTIC-015', digits: 3 },
];

// ───────────────────────── MODEL-021 Brunel ─────────────────────────

const BRUNEL_PARAMS: ParamSpec[] = [
  { key: 'g_Brunel', label: 'Relative inhibitory strength', symbol: 'g', unit: '', default: 5, min: 1, max: 10, step: 0.1, registryId: 'PARAM-063', description: 'Ratio J_I / J_E. Inhibition balances excitation at g = 4; larger values are inhibition-dominated.', group: 'Balance' },
  { key: 'eta_Brunel', label: 'External drive ratio', symbol: '\\eta', unit: '', default: 2, min: 0.5, max: 6, step: 0.05, registryId: 'PARAM-064', description: 'External Poisson rate relative to the rate needed to reach threshold without recurrent input.', group: 'Balance' },
  { key: 'D_Brunel', label: 'Synaptic delay', symbol: 'D', unit: 'ms', default: 1.5, min: 0.2, max: 5, step: 0.1, registryId: 'PARAM-065', description: 'Axonal transmission delay; sets the period of fast network oscillations.', group: 'Synapses' },
  { key: 'N', label: 'Network size', symbol: 'N', unit: 'neurons', default: 3000, min: 200, max: 4000, step: 100, integer: true, description: '80% excitatory, 20% inhibitory (browser cap 4,000).', group: 'Network' },
  { key: 'epsilon', label: 'Connection probability', symbol: '\\epsilon', unit: '', default: 0.1, min: 0.02, max: 0.3, step: 0.005, description: 'Each neuron receives C_E = εN_E excitatory and C_I = εN_I inhibitory inputs.', group: 'Network' },
  { key: 'J_E', label: 'Excitatory PSP amplitude', symbol: 'J_E', unit: 'mV', default: 0.42, min: 0.02, max: 2, step: 0.01, description: 'Voltage jump caused by one excitatory spike. The default keeps J_E·C_E ≈ 100 mV, the value of Brunel\'s 12,500-neuron network (0.1 mV × 1,000 inputs), so the balance of recurrent and external input is preserved at browser scale. Change it together with N or ε.', group: 'Synapses' },
  { key: 'tau_m', label: 'Membrane time constant', symbol: '\\tau_m', unit: 'ms', default: 20, min: 5, max: 50, step: 0.5, description: 'Membrane time constant.', group: 'Neurons' },
  { key: 'V_th', label: 'Threshold', symbol: '\\theta', unit: 'mV', default: 20, min: 10, max: 30, step: 0.5, description: 'Spike threshold relative to rest.', group: 'Neurons' },
  { key: 'V_reset', label: 'Reset', symbol: 'V_r', unit: 'mV', default: 10, min: 0, max: 19, step: 0.5, description: 'Reset potential relative to rest.', group: 'Neurons' },
  { key: 'tau_ref', label: 'Refractory period', symbol: '\\tau_{ref}', unit: 'ms', default: 2, min: 0.5, max: 5, step: 0.1, description: 'Absolute refractory period.', group: 'Neurons' },
];

export interface BrunelResult extends ModelOutput { popRateE: Float64Array }

function runBrunel(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(BRUNEL_PARAMS, cfg.params);
  const g = p('g_Brunel'), eta = p('eta_Brunel'), D = p('D_Brunel'), N = Math.round(p('N')), eps = p('epsilon'), J = p('J_E');
  const tau = p('tau_m'), theta = p('V_th'), Vr = p('V_reset'), tref = p('tau_ref');
  if (N > 4000) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'Network size exceeds the 4,000-neuron browser envelope.');
  const NE = Math.round(0.8 * N), NI = N - NE, CE = Math.max(1, Math.round(eps * NE)), CI = Math.max(1, Math.round(eps * NI));
  if ((CE + CI) * N > 2_500_000) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'Synapse count exceeds the 2,500,000-synapse browser envelope; lower N or ε.');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const rng = new Rng(cfg.seed);
  // Fixed in-degree random connectivity.
  const inLists: Uint32Array[] = [];
  for (let i = 0; i < N; i++) {
    const list = new Uint32Array(CE + CI);
    list.set(rng.sample(NE, CE, i < NE ? i : -1), 0);
    const inh = rng.sample(NI, CI, i >= NE ? i - NE : -1);
    for (let k = 0; k < CI; k++) list[CE + k] = NE + inh[k]!;
    inLists.push(list);
  }
  const csr = csrFromInLists(N, inLists);
  const delaySteps = Math.max(1, Math.round(D / dt));
  const K = delaySteps + 1;
  const ring = new Float64Array(K * N);
  const V = new Float64Array(N);
  for (let i = 0; i < N; i++) V[i] = Vr + (theta - Vr) * rng.next();
  const refr = new Int32Array(N);
  const refSteps = Math.round(tref / dt);
  const decay = Math.exp(-dt / tau);
  const extMean = (eta * theta * dt) / (J * tau); // expected external spikes per neuron per step
  const log = new SpikeLog();
  const isi = new IsiStats(N);
  const transient = Math.min(100, cfg.durationMs / 4);
  const nBins = Math.ceil(cfg.durationMs);
  const countE = new Float64Array(nBins), countI = new Float64Array(nBins);
  const vTrace = [new Float64Array(nBins), new Float64Array(nBins)];
  const sumV = new Float64Array(N), sumV2 = new Float64Array(N);
  let sumPop = 0, sumPop2 = 0, samples = 0;
  const sampleEvery = Math.max(1, Math.round(1 / dt));
  let spikesE = 0, spikesI = 0;
  for (let step = 0; step < nSteps; step++) {
    const t = step * dt;
    const slot = (step % K) * N, target = ((step + delaySteps) % K) * N;
    const bin = Math.min(nBins - 1, Math.floor(t));
    for (let i = 0; i < N; i++) {
      if (refr[i]! > 0) { refr[i] = refr[i]! - 1; ring[slot + i] = 0; continue; }
      let v = V[i]! * decay + ring[slot + i]! + J * rng.poisson(extMean);
      ring[slot + i] = 0;
      if (v >= theta) {
        v = Vr; refr[i] = refSteps;
        const w = i < NE ? J : -g * J;
        for (let q = csr.rowPtr[i]!, e = csr.rowPtr[i + 1]!; q < e; q++) { const tgt = csr.colIdx[q]!; ring[target + tgt] = ring[target + tgt]! + w; }
        log.push(t, i);
        isi.spike(i, t, transient);
        if (i < NE) { countE[bin] = countE[bin]! + 1; if (t >= transient) spikesE++; } else { countI[bin] = countI[bin]! + 1; if (t >= transient) spikesI++; }
      }
      V[i] = v;
    }
    if (step % sampleEvery === 0) {
      if (bin < nBins) { vTrace[0]![bin] = V[0]!; vTrace[1]![bin] = V[NE]!; }
      if (t >= transient) {
        let pop = 0;
        for (let i = 0; i < N; i++) { const v = V[i]!; pop += v; sumV[i] = sumV[i]! + v; sumV2[i] = sumV2[i]! + v * v; }
        pop /= N; sumPop += pop; sumPop2 += pop * pop; samples++;
      }
    }
    if (ctx?.onProgress && step % 500 === 0) ctx.onProgress(step / nSteps);
  }
  const span = (cfg.durationMs - transient) / 1000;
  const tAxis = Float64Array.from({ length: nBins }, (_, i) => i + 0.5);
  const rateE = Float64Array.from(countE, (c) => (c * 1000) / NE), rateI = Float64Array.from(countI, (c) => (c * 1000) / NI);
  const out: ModelOutput = {
    t: tAxis,
    series: { rate_E: boxSmooth(rateE, 5), rate_I: boxSmooth(rateI, 5), V_sample_E: vTrace[0]!, V_sample_I: vTrace[1]! },
    curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED',
  };
  const sp = log.finish();
  out.spikes = { times: sp.times, ids: sp.ids, n: N, groups: [{ name: 'Excitatory', from: 0, to: NE, kind: 'E' }, { name: 'Inhibitory', from: NE, to: N, kind: 'I' }] };
  let meanVar = 0;
  for (let i = 0; i < N; i++) { const m = sumV[i]! / samples; meanVar += Math.max(0, sumV2[i]! / samples - m * m); }
  meanVar /= N;
  const popVar = Math.max(0, sumPop2 / samples - (sumPop / samples) ** 2);
  const t0 = Math.floor(transient);
  const tailCounts = Float64Array.from({ length: Math.max(0, nBins - t0) }, (_, i) => countE[t0 + i]! + countI[t0 + i]!);
  const mc = meanOf(tailCounts);
  let vc = 0;
  for (let i = 0; i < tailCounts.length; i++) vc += (tailCounts[i]! - mc) ** 2;
  out.metrics.meanRateEHz = spikesE / NE / span;
  out.metrics.meanRateIHz = spikesI / NI / span;
  out.metrics.cvIsi = isi.meanCv(0, N);
  out.metrics.synchronyChi = samples > 1 && meanVar > 0 ? Math.sqrt(popVar / meanVar) : NaN;
  out.metrics.populationFano = mc > 0 ? vc / Math.max(1, tailCounts.length - 1) / mc : NaN;
  let band = NaN, peakHz = NaN;
  if (tailCounts.length >= 128) {
    const psd = welchPsd(Float64Array.from(tailCounts, (c) => (c * 1000) / N), 1000, 256);
    out.curves.rate_psd = { x: psd.freq, y: psd.power };
    peakHz = peakFrequency(psd, 10, 450);
    // Share of the 10–450 Hz population-rate power that lies within ±15% of the spectral peak.
    let near = 0, total = 0;
    for (let k = 0; k < psd.freq.length; k++) {
      const fq = psd.freq[k]!;
      if (fq < 10 || fq > 450) continue;
      total += psd.power[k]!;
      if (fq >= 0.85 * peakHz && fq <= 1.15 * peakHz) near += psd.power[k]!;
    }
    band = total > 0 ? near / total : NaN;
  }
  out.metrics.populationPeakHz = peakHz;
  out.metrics.peakBandFraction = band;
  out.metrics.nuThrHz = (1000 * theta) / (J * CE * tau);
  out.metrics.synapseCount = (CE + CI) * N;
  out.metrics.inDegreeE = CE;
  out.metrics.weightTimesInDegreeMv = J * CE;
  const cv = out.metrics.cvIsi, chi = out.metrics.synchronyChi, rate = out.metrics.meanRateEHz;
  const pct = Number.isFinite(band) ? `${(100 * band).toFixed(0)}%` : 'n/a';
  // Regime labels follow measured statistics (thresholds calibrated on this kernel at N = 2,000–4,000).
  out.metrics.regime = cv < 0.3 ? 1 : band >= 0.42 && peakHz >= 130 ? 3 : chi >= 0.28 ? 4 : 2;
  out.notes.push(
    out.metrics.regime === 1 ? `Synchronous-regular regime: excitation dominates and neurons fire regularly (CV = ${cv.toFixed(2)}) at ${rate.toFixed(0)} Hz, close to the limit set by the refractory period.`
      : out.metrics.regime === 3 ? `Synchronous-irregular regime, fast oscillation: single cells fire irregularly (CV = ${cv.toFixed(2)}) while the population rate oscillates at ${peakHz.toFixed(0)} Hz (${pct} of its power lies near that frequency); the period is set by the synaptic delay.`
        : out.metrics.regime === 4 ? `Synchronous-irregular regime, slow oscillation: low, irregular firing (${rate.toFixed(1)} Hz, CV = ${cv.toFixed(2)}) with coherent population waves near ${peakHz.toFixed(0)} Hz (synchrony χ = ${chi.toFixed(2)}).`
          : `Asynchronous-irregular regime: Poisson-like firing (CV = ${Number.isFinite(cv) ? cv.toFixed(2) : 'n/a'}) at ${rate.toFixed(1)} Hz with weak population synchrony (χ = ${Number.isFinite(chi) ? chi.toFixed(2) : 'n/a'}). The residual fast ripple around ${Number.isFinite(peakHz) ? peakHz.toFixed(0) : 'n/a'} Hz is a finite-size effect of a ${N.toLocaleString()}-neuron network.`,
  );
  if (Math.abs(J * CE - 100) > 20) out.notes.push(`J_E·C_E = ${(J * CE).toFixed(0)} mV differs from the 100 mV of Brunel's network, so the mean recurrent input no longer balances the external drive in the same way and the (g, η) regime boundaries shift.`);
  if (log.dropped > 0) out.notes.push(`Raster storage capped at ${MAX_SPIKES.toLocaleString()} spikes; ${log.dropped.toLocaleString()} later spikes were counted in the rates but not stored.`);
  return out;
}

export const MODEL_021: ModelDefinition = {
  id: 'MODEL-021',
  name: 'Brunel Balanced E/I Network',
  equations: [
    '\\tau_m \\frac{dV_i}{dt} = -(V_i - V_{rest}) + R I_{syn,i}(t)',
    'R I_{syn,i}(t) = \\tau_m \\Big[J_E \\sum_{j \\in \\mathcal{E}_i}\\sum_f \\delta(t - t_j^{(f)} - D) - g J_E \\sum_{k \\in \\mathcal{I}_i}\\sum_f \\delta(t - t_k^{(f)} - D) + J_E \\sum_f \\delta(t - t_{ext,i}^{(f)})\\Big]',
    '\\nu_{thr} = \\frac{\\theta}{J_E C_E \\tau_m}, \\qquad \\nu_{ext} = \\eta\\,\\nu_{thr}, \\qquad C_E = \\epsilon N_E',
  ],
  params: BRUNEL_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.02, maxSafeDtMs: 0.2, defaultDurationMs: 1000, maxDurationMs: 5000,
  stochastic: true,
  views: [
    { kind: 'raster', title: 'Spike raster (excitatory below, inhibitory above)', meaning: 'Each dot is one spike; vertical stripes reveal population synchrony.' },
    { kind: 'traces', title: 'Population firing rates (5 ms smoothing)', yLabel: 'rate (Hz)', series: [
      { key: 'rate_E', label: 'Excitatory', unit: 'Hz', meaning: 'Instantaneous mean firing rate of the excitatory population.' },
      { key: 'rate_I', label: 'Inhibitory', unit: 'Hz', meaning: 'Instantaneous mean firing rate of the inhibitory population.' },
    ] },
    { kind: 'traces', title: 'Sample membrane potentials (relative to rest)', yLabel: 'V (mV)', series: [
      { key: 'V_sample_E', label: 'E neuron', unit: 'mV', meaning: 'Membrane potential of one excitatory neuron sampled every millisecond.' },
      { key: 'V_sample_I', label: 'I neuron', unit: 'mV', meaning: 'Membrane potential of one inhibitory neuron sampled every millisecond.' },
    ] },
    { kind: 'curve', title: 'Population-rate power spectrum', xLabel: 'frequency (Hz)', yLabel: 'PSD (Hz²/Hz)', meaning: 'Welch spectrum of the population rate (LFP proxy); a peak marks a network oscillation.', curves: [{ key: 'rate_psd', label: 'PSD' }] },
  ],
  metrics: [
    ...NET_METRICS,
    { key: 'populationPeakHz', label: 'Population oscillation peak', unit: 'Hz', description: 'Frequency of the largest peak in the population-rate spectrum (10–450 Hz).', analyticId: 'ANALYTIC-004' },
    { key: 'peakBandFraction', label: 'Power near the spectral peak', unit: '', description: 'Share of 10–450 Hz population-rate power within ±15% of the peak frequency; high values indicate a coherent oscillation.', analyticId: 'ANALYTIC-004', digits: 3 },
    { key: 'regime', label: 'Regime code', unit: '', description: '1 = synchronous regular, 2 = asynchronous irregular, 3 = synchronous irregular (fast), 4 = synchronous irregular (slow), classified from CV, spectrum and synchrony.', digits: 0 },
    { key: 'weightTimesInDegreeMv', label: 'J_E · C_E', unit: 'mV', description: 'Total excitatory recurrent weight per neuron; 100 mV reproduces the input balance of Brunel (2000).' },
    { key: 'populationFano', label: 'Population Fano factor', unit: '', description: 'Variance over mean of 1 ms population spike counts.', analyticId: 'ANALYTIC-011' },
    { key: 'nuThrHz', label: 'Threshold rate ν_thr', unit: 'Hz', description: 'External rate per afferent needed to reach threshold without recurrence.' },
  ],
  presets: [
    { id: 'AI', label: 'Asynchronous irregular (g = 5, η = 2)', description: 'In-vivo-like balanced state.', params: { g_Brunel: 5, eta_Brunel: 2 }, experimentId: 'EXP-030' },
    { id: 'SR', label: 'Synchronous regular (g = 3, η = 2)', description: 'Excitation-dominated, high-rate regular firing.', params: { g_Brunel: 3, eta_Brunel: 2 }, durationMs: 300, experimentId: 'EXP-030' },
    { id: 'SIfast', label: 'Synchronous irregular, fast (g = 6, η = 4)', description: 'Fast global oscillation set by the delay.', params: { g_Brunel: 6, eta_Brunel: 4 }, durationMs: 500, experimentId: 'EXP-030' },
    { id: 'SIslow', label: 'Synchronous irregular, slow (g = 4.5, η = 0.9)', description: 'Low-rate slow oscillation near threshold.', params: { g_Brunel: 4.5, eta_Brunel: 0.9 }, durationMs: 1500, experimentId: 'EXP-030' },
  ],
  sweep: { paramKey: 'g_Brunel', from: 2, to: 8, steps: 9, metricKey: 'cvIsi', experimentId: 'EXP-030' },
  kernelLimitations: [
    'Delta synapses and current-based input: no conductance effects or synaptic time course.',
    'Scaled-down network: 3,000 neurons with C_E = 240 inputs instead of 12,500 neurons with C_E = 1,000. The weight is raised from 0.1 mV to 0.42 mV so that J_E·C_E ≈ 100 mV; with the 0.1 mV listed in the specification a network this small is driven far above threshold and fires regularly for every g.',
    'Larger synaptic weights and shared inputs make the asynchronous state noisier and more correlated than in the mean-field limit: χ is about 0.18 here, not the < 0.15 of a large sparse network.',
    'Spike times are resolved on the simulation grid (dt).',
  ],
  run: runBrunel,
};

// ───────────────────────── MODEL-020 Synfire chain ─────────────────────────

const SYN_PARAMS: ParamSpec[] = [
  { key: 'p_ff_SNN', label: 'Inter-layer connection probability', symbol: 'p_{ff}', unit: '', default: 0.25, min: 0.05, max: 1, step: 0.01, registryId: 'PARAM-061', description: 'Probability that a neuron in layer k projects to a given neuron in layer k + 1.', group: 'Feedforward projection' },
  { key: 'J_ff_SNN', label: 'Feedforward synaptic weight', symbol: 'J_{ff}', unit: 'mV', default: 0.4, min: 0.05, max: 2, step: 0.01, registryId: 'PARAM-062', description: 'Voltage jump caused by one feedforward spike.', group: 'Feedforward projection' },
  { key: 'layers', label: 'Number of layers', symbol: 'L', unit: '', default: 8, min: 3, max: 10, step: 1, integer: true, description: 'Depth of the feedforward chain.', group: 'Architecture' },
  { key: 'M', label: 'Excitatory neurons per layer', symbol: 'M', unit: '', default: 150, min: 50, max: 200, step: 10, integer: true, description: 'Width of each layer. A full volley delivers p_ff·J_ff·M = 15 mV on average, about twice the distance from the background potential to threshold.', group: 'Architecture' },
  { key: 'a1', label: 'Initial packet size', symbol: 'a_1', unit: 'spikes', default: 120, min: 0, max: 200, step: 1, integer: true, description: 'Number of layer-1 neurons forced to spike in the stimulus volley (capped at M).', group: 'Stimulus packet' },
  { key: 'sigma1', label: 'Initial packet jitter', symbol: '\\sigma_1', unit: 'ms', default: 1, min: 0, max: 10, step: 0.1, description: 'Temporal standard deviation of the stimulus volley.', group: 'Stimulus packet' },
  { key: 'g_ffi', label: 'Feedforward inhibition strength', symbol: 'g_{ffi}', unit: '', default: 2, min: 0, max: 8, step: 0.1, description: 'Inhibitory weight relative to J_ff from each layer\'s gating interneurons (0 disables them).', group: 'Feedforward inhibition' },
  { key: 'bg_mean', label: 'Background depolarization', symbol: '\\mu_{bg}', unit: 'mV', default: 8, min: 0, max: 14, step: 0.1, description: 'Mean depolarization above rest from background input.', group: 'Background' },
  { key: 'bg_sigma', label: 'Background fluctuation', symbol: '\\sigma_{bg}', unit: 'mV', default: 2, min: 0, max: 5, step: 0.1, description: 'Standard deviation of the membrane potential from background noise.', group: 'Background' },
  { key: 'delay', label: 'Axonal delay', symbol: '\\tau_d', unit: 'ms', default: 1.5, min: 0.5, max: 5, step: 0.1, description: 'Transmission delay between layers.', group: 'Feedforward projection' },
];
const SYN = { EL: -70, Vth: -55, Vreset: -70, tau: 20, tref: 2, tStim: 50, inhDelay: 1.0 };

function runSynfire(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(SYN_PARAMS, cfg.params);
  const pff = p('p_ff_SNN'), J = p('J_ff_SNN'), L = Math.round(p('layers')), M = Math.round(p('M')), a1 = Math.min(M, Math.round(p('a1'))), sigma1 = p('sigma1');
  const gffi = p('g_ffi'), mu = p('bg_mean'), sig = p('bg_sigma'), delay = p('delay');
  const MI = gffi > 0 ? Math.max(1, Math.round(M / 4)) : 0;
  const per = M + MI, N = L * per;
  if (N > 3000) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'Synfire network exceeds the 3,000-neuron browser envelope.');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const rng = new Rng(cfg.seed);
  const eIdx = (layer: number, k: number) => layer * per + k;
  const iIdx = (layer: number, k: number) => layer * per + M + k;
  // Outgoing target lists: E(k) → E(k+1) and I(k+1) with delay; I(k) → E(k) with the extra inhibitory delay.
  const outE: number[][] = Array.from({ length: N }, () => []);
  const outI: number[][] = Array.from({ length: N }, () => []);
  for (let layer = 0; layer + 1 < L; layer++) {
    for (let pre = 0; pre < M; pre++) {
      for (let post = 0; post < M; post++) if (rng.next() < pff) outE[eIdx(layer, pre)]!.push(eIdx(layer + 1, post));
      for (let post = 0; post < MI; post++) if (rng.next() < pff) outE[eIdx(layer, pre)]!.push(iIdx(layer + 1, post));
    }
  }
  for (let layer = 1; layer < L; layer++) for (let pre = 0; pre < MI; pre++) for (let post = 0; post < M; post++) if (rng.next() < 0.5) outI[iIdx(layer, pre)]!.push(eIdx(layer, post));
  const dE = Math.max(1, Math.round(delay / dt)), dI = Math.max(1, Math.round(SYN.inhDelay / dt));
  const K = Math.max(dE, dI) + 1;
  const ring = new Float64Array(K * N);
  const V = new Float64Array(N), refr = new Int32Array(N);
  for (let i = 0; i < N; i++) V[i] = SYN.EL + mu + sig * rng.normal();
  const decay = Math.exp(-dt / SYN.tau), noise = sig * Math.sqrt(1 - decay * decay), refSteps = Math.round(SYN.tref / dt);
  // Stimulus volley: a₁ distinct layer-1 neurons, each forced to spike once at t_stim + N(0, σ₁).
  const forced = new Map<number, number[]>();
  const chosen = rng.sample(M, a1);
  for (let k = 0; k < a1; k++) {
    const step = Math.max(0, Math.round((SYN.tStim + sigma1 * rng.normal()) / dt));
    (forced.get(step) ?? forced.set(step, []).get(step)!).push(eIdx(0, chosen[k]!));
  }
  const log = new SpikeLog();
  const layerTimes: number[][] = Array.from({ length: L }, () => []);
  let spontaneous = 0;
  for (let step = 0; step < nSteps; step++) {
    const t = step * dt;
    const slot = (step % K) * N;
    const force = forced.get(step);
    for (let i = 0; i < N; i++) {
      let fire = false;
      if (refr[i]! > 0) { refr[i] = refr[i]! - 1; V[i] = SYN.Vreset; ring[slot + i] = 0; }
      else {
        // Exact Ornstein–Uhlenbeck update around the background mean plus delta synaptic kicks.
        const v = SYN.EL + mu + (V[i]! - SYN.EL - mu) * decay + noise * rng.normal() + ring[slot + i]!;
        ring[slot + i] = 0;
        V[i] = v;
        fire = v >= SYN.Vth;
      }
      if (force && force.includes(i)) fire = true;
      if (!fire) continue;
      V[i] = SYN.Vreset; refr[i] = refSteps;
      const layer = Math.floor(i / per), local = i - layer * per;
      const isE = local < M;
      if (isE) {
        const tgt = ((step + dE) % K) * N;
        for (const q of outE[i]!) ring[tgt + q] = ring[tgt + q]! + J;
        log.push(t, layer * M + local);
        layerTimes[layer]!.push(t);
        if (t < SYN.tStim - 5) spontaneous++;
      } else {
        const tgt = ((step + dI) % K) * N;
        for (const q of outI[i]!) ring[tgt + q] = ring[tgt + q]! - gffi * J;
      }
    }
    if (ctx?.onProgress && step % 500 === 0) ctx.onProgress(step / nSteps);
  }
  const sp = log.finish();
  const out: ModelOutput = { t: new Float64Array(0), series: {}, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  out.spikes = { times: sp.times, ids: sp.ids, n: L * M, groups: Array.from({ length: L }, (_, k) => ({ name: `Layer ${k + 1}`, from: k * M, to: (k + 1) * M, kind: 'E' as const })) };
  // Pulse-packet statistics per layer inside a window around the expected arrival time.
  const aK = new Float64Array(L), sK = new Float64Array(L), tK = new Float64Array(L), idx = Float64Array.from({ length: L }, (_, k) => k + 1);
  for (let k = 0; k < L; k++) {
    const centre = SYN.tStim + k * delay;
    const lo = centre - Math.max(6, 3 * sigma1), hi = centre + Math.max(12, 3 * sigma1 + 8);
    const inWin = layerTimes[k]!.filter((x) => x >= lo && x <= hi);
    aK[k] = inWin.length;
    if (inWin.length) {
      const m = inWin.reduce((a, b) => a + b, 0) / inWin.length;
      tK[k] = m;
      sK[k] = Math.sqrt(inWin.reduce((a, b) => a + (b - m) ** 2, 0) / inWin.length);
    } else { tK[k] = NaN; sK[k] = NaN; }
  }
  out.curves.packet_size = { x: idx, y: aK };
  out.curves.packet_jitter = { x: Float64Array.from(idx), y: sK };
  out.curves.packet_latency = { x: Float64Array.from(idx), y: tK };
  let survived = 0;
  for (let k = 0; k < L; k++) { if (aK[k]! >= 0.5 * M) survived = k + 1; else if (k > 0) break; }
  out.metrics.finalPacketSize = aK[L - 1]!;
  out.metrics.finalPacketJitterMs = sK[L - 1]!;
  out.metrics.layersReached = survived;
  out.metrics.propagated = aK[L - 1]! >= 0.5 * M ? 1 : 0;
  out.metrics.spontaneousRateHz = (spontaneous * 1000) / (L * M * Math.max(1, SYN.tStim - 5));
  out.metrics.meanLayerDelayMs = L > 1 && Number.isFinite(tK[L - 1]!) ? (tK[L - 1]! - tK[0]!) / (L - 1) : NaN;
  out.notes.push(out.metrics.propagated
    ? `The pulse packet propagated through all ${L} layers and sharpened to σ = ${sK[L - 1]!.toFixed(2)} ms: a stable synfire attractor.`
    : `The pulse packet died out after layer ${Math.max(1, survived)}: it was too small or too dispersed to recruit the next layer.`);
  return out;
}

export const MODEL_020: ModelDefinition = {
  id: 'MODEL-020',
  name: 'Feedforward Synfire Chain',
  equations: [
    '\\tau_m \\frac{dV_i^{(k)}}{dt} = -(V_i^{(k)} - E_L) + \\mu_{bg} + \\sigma_{bg}\\sqrt{2\\tau_m}\\,\\xi_i(t) + \\tau_m J_{ff} \\sum_{j \\in \\mathcal{P}_i^{(k-1)}}\\sum_f \\delta\\!\\left(t - t_j^{(f)} - \\tau_d\\right) - \\tau_m g_{ffi} J_{ff} \\sum_{q \\in \\mathcal{G}_i^{(k)}}\\sum_f \\delta\\!\\left(t - t_q^{(f)} - \\tau_{inh}\\right)',
    '(a_k, \\sigma_k) \\mapsto (a_{k+1}, \\sigma_{k+1}) \\quad \\text{(pulse-packet transmission map)}',
  ],
  params: SYN_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.02, maxSafeDtMs: 0.25, defaultDurationMs: 120, maxDurationMs: 5000,
  stochastic: true,
  views: [
    { kind: 'raster', title: 'Layer-by-layer spike raster', meaning: 'Excitatory spikes grouped by layer; a diagonal band is a propagating pulse packet.' },
    { kind: 'curve', title: 'Pulse-packet size per layer', xLabel: 'layer', yLabel: 'spikes in packet aₖ', meaning: 'Number of spikes in the volley at each layer.', curves: [{ key: 'packet_size', label: 'aₖ', points: true }] },
    { kind: 'curve', title: 'Pulse-packet temporal dispersion per layer', xLabel: 'layer', yLabel: 'σₖ (ms)', meaning: 'Temporal standard deviation of the volley at each layer.', curves: [{ key: 'packet_jitter', label: 'σₖ', points: true }] },
  ],
  metrics: [
    { key: 'propagated', label: 'Packet reached final layer', unit: '', description: '1 if at least half of the last layer fired in the expected window.', digits: 0 },
    { key: 'layersReached', label: 'Layers reached', unit: '', description: 'Number of consecutive layers in which at least half of the neurons fired.', digits: 0 },
    { key: 'finalPacketSize', label: 'Final packet size', unit: 'spikes', description: 'Spikes in the volley at the last layer.', digits: 0 },
    { key: 'finalPacketJitterMs', label: 'Final packet jitter', unit: 'ms', description: 'Temporal dispersion of the volley at the last layer.', digits: 3 },
    { key: 'meanLayerDelayMs', label: 'Mean inter-layer latency', unit: 'ms', description: 'Average advance of the packet per layer.', analyticId: 'ANALYTIC-012', digits: 3 },
    { key: 'spontaneousRateHz', label: 'Spontaneous rate', unit: 'Hz', description: 'Background firing rate before the stimulus.' },
  ],
  presets: [
    { id: 'stable', label: 'Strong synchronous packet', description: 'a₁ = 120, σ₁ = 1 ms: the volley grows to the full layer and sharpens as it travels.', params: { a1: 120, sigma1: 1 }, experimentId: 'EXP-029' },
    { id: 'weak', label: 'Small packet', description: 'a₁ = 60 fails to recruit the next layer and dies out.', params: { a1: 60, sigma1: 1 }, experimentId: 'EXP-029' },
    { id: 'dispersed', label: 'Dispersed packet', description: 'a₁ = 120 but σ₁ = 5 ms: feedforward inhibition closes the integration window before enough input has arrived.', params: { a1: 120, sigma1: 5 }, experimentId: 'EXP-029' },
    { id: 'noFfi', label: 'Without feedforward inhibition', description: 'g_ffi = 0 widens the integration window, so a dispersed packet can still ignite the chain.', params: { a1: 120, sigma1: 5, g_ffi: 0 }, experimentId: 'EXP-029' },
  ],
  sweep: { paramKey: 'a1', from: 30, to: 150, steps: 13, metricKey: 'finalPacketSize', experimentId: 'EXP-029' },
  kernelLimitations: ['Delta synapses; background input is a diffusion (Ornstein–Uhlenbeck) approximation rather than explicit Poisson afferents.', 'Purely feedforward: no recurrent connections within a layer.', 'Fixed neuron constants: E_L = −70 mV, V_th = −55 mV, τ_m = 20 ms, τ_ref = 2 ms.'],
  run: runSynfire,
};

// ───────────────────────── MODEL-022 Vogels iSTDP ─────────────────────────

const VOG_PARAMS: ParamSpec[] = [
  { key: 'rho0_Vogels', label: 'Target firing rate', symbol: '\\rho_0', unit: 'Hz', default: 5, min: 1, max: 20, step: 0.5, registryId: 'PARAM-066', description: 'Postsynaptic rate at which inhibitory potentiation and depression cancel.', group: 'Inhibitory plasticity' },
  { key: 'eta_Vogels', label: 'Learning rate', symbol: '\\eta', unit: '', default: 0.001, min: 0, max: 0.05, step: 0.0001, registryId: 'PARAM-067', description: 'Weight change per spike-pair event (0 freezes inhibitory weights).', group: 'Inhibitory plasticity' },
  { key: 'tau_STDP', label: 'Plasticity trace time constant', symbol: '\\tau_{STDP}', unit: 'ms', default: 20, min: 5, max: 100, step: 1, description: 'Coincidence window of the symmetric inhibitory STDP rule.', group: 'Inhibitory plasticity' },
  { key: 'W0', label: 'Initial I→E weight', symbol: 'W_0', unit: '', default: 0.02, min: 0, max: 2, step: 0.01, description: 'Initial relative strength of plastic inhibitory synapses (small = under-inhibited start).', group: 'Inhibitory plasticity' },
  { key: 'plastic_on', label: 'Plasticity onset', symbol: 't_{on}', unit: 'ms', default: 500, min: 0, max: 5000, step: 50, description: 'Time at which inhibitory plasticity is switched on.', group: 'Inhibitory plasticity' },
  { key: 'N', label: 'Network size', symbol: 'N', unit: 'neurons', default: 1000, min: 200, max: 2500, step: 100, integer: true, description: '80% excitatory, 20% inhibitory (browser cap 2,500).', group: 'Network' },
  { key: 'epsilon', label: 'Connection probability', symbol: '\\epsilon', unit: '', default: 0.1, min: 0.02, max: 0.2, step: 0.01, description: 'Sparse random connectivity.', group: 'Network' },
  { key: 'g_E_bar', label: 'Excitatory quantal conductance', symbol: '\\bar{g}_E', unit: 'nS', default: 0.3, min: 0.05, max: 2, step: 0.01, description: 'Conductance increment per excitatory spike.', group: 'Synapses' },
  { key: 'g_I_bar', label: 'Inhibitory unit conductance', symbol: '\\bar{g}_I', unit: 'nS', default: 10, min: 1, max: 40, step: 0.5, description: 'Conductance increment per inhibitory spike at W = 1.', group: 'Synapses' },
  { key: 'I_bg', label: 'Background current', symbol: 'I_{bg}', unit: 'pA', default: 200, min: 0, max: 400, step: 5, description: 'Constant depolarizing current to every neuron.', group: 'Neurons' },
];
const VOG = { C: 200, gL: 10, EL: -60, Vth: -50, Vreset: -60, tref: 5, EE: 0, EI: -80, tauE: 5, tauI: 10, delay: 0.8, WII: 0.1, Wmax: 3 };

function runVogels(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(VOG_PARAMS, cfg.params);
  const rho0 = p('rho0_Vogels'), eta = p('eta_Vogels'), tauS = p('tau_STDP'), W0 = p('W0'), tOn = p('plastic_on');
  const N = Math.round(p('N')), eps = p('epsilon'), gEbar = p('g_E_bar'), gIbar = p('g_I_bar'), Ibg = p('I_bg');
  if (N > 2500) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'Network size exceeds the 2,500-neuron browser envelope for MODEL-022.');
  const NE = Math.round(0.8 * N), NI = N - NE, KE = Math.max(1, Math.round(eps * NE)), KI = Math.max(1, Math.round(eps * NI));
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const rng = new Rng(cfg.seed);
  const alpha = 2 * (rho0 / 1000) * tauS;
  // Excitatory projections (fixed) and inhibitory projections (I→E plastic, I→I fixed) in CSR form.
  const inE: Uint32Array[] = [], inI: Uint32Array[] = [];
  for (let i = 0; i < N; i++) {
    inE.push(rng.sample(NE, KE, i < NE ? i : -1));
    inI.push(rng.sample(NI, KI, i >= NE ? i - NE : -1));
  }
  const csrE = csrFromInLists(NE, inE);
  const csrI = csrFromInLists(NI, inI);
  const W = new Float64Array(csrI.colIdx.length);
  for (let j = 0; j < NI; j++) for (let q = csrI.rowPtr[j]!; q < csrI.rowPtr[j + 1]!; q++) W[q] = csrI.colIdx[q]! < NE ? W0 : VOG.WII;
  const dSteps = Math.max(1, Math.round(VOG.delay / dt)), K = dSteps + 1;
  const ringE = new Float64Array(K * N), ringI = new Float64Array(K * N);
  const V = new Float64Array(N), gE = new Float64Array(N), gI = new Float64Array(N), x = new Float64Array(N), refr = new Int32Array(N);
  for (let i = 0; i < N; i++) V[i] = VOG.EL + (VOG.Vth - VOG.EL) * rng.next();
  const decE = Math.exp(-dt / VOG.tauE), decI = Math.exp(-dt / VOG.tauI), decX = Math.exp(-dt / tauS), refSteps = Math.round(VOG.tref / dt);
  const log = new SpikeLog();
  const nBins = Math.ceil(cfg.durationMs);
  const countE = new Float64Array(nBins), countI = new Float64Array(nBins);
  const wSamples = Math.floor(cfg.durationMs / 10) + 1;
  const wMean = new Float64Array(wSamples), wT = new Float64Array(wSamples);
  const iExc = new Float64Array(nBins), iInh = new Float64Array(nBins);
  const isi = new IsiStats(N);
  const lateFrom = Math.max(0, cfg.durationMs - Math.min(1000, cfg.durationMs / 3));
  let plasticSynapses = 0, wWritten = 0;
  for (let q = 0; q < W.length; q++) if (csrI.colIdx[q]! < NE) plasticSynapses++;
  const sampleEvery = Math.max(1, Math.round(1 / dt));
  for (let step = 0; step < nSteps; step++) {
    const t = step * dt;
    const slot = (step % K) * N, target = ((step + dSteps) % K) * N;
    const bin = Math.min(nBins - 1, Math.floor(t));
    const plastic = eta > 0 && t >= tOn;
    for (let i = 0; i < N; i++) {
      const ge = gE[i]! * decE + ringE[slot + i]!, gi = gI[i]! * decI + ringI[slot + i]!;
      ringE[slot + i] = 0; ringI[slot + i] = 0;
      gE[i] = ge; gI[i] = gi;
      x[i] = x[i]! * decX;
      if (refr[i]! > 0) { refr[i] = refr[i]! - 1; V[i] = VOG.Vreset; continue; }
      // Exponential-Euler membrane update (exact for conductances frozen over the step).
      const gTot = VOG.gL + ge + gi;
      const vInf = (VOG.gL * VOG.EL + ge * VOG.EE + gi * VOG.EI + Ibg) / gTot;
      const v = vInf + (V[i]! - vInf) * Math.exp((-dt * gTot) / VOG.C);
      if (v < VOG.Vth) { V[i] = v; continue; }
      V[i] = VOG.Vreset; refr[i] = refSteps;
      log.push(t, i);
      isi.spike(i, t, lateFrom);
      if (i < NE) {
        countE[bin] = countE[bin]! + 1;
        for (let q = csrE.rowPtr[i]!, e = csrE.rowPtr[i + 1]!; q < e; q++) { const tg = csrE.colIdx[q]!; ringE[target + tg] = ringE[target + tg]! + gEbar; }
        // Postsynaptic E spike: potentiate every incoming I→E synapse by η x_pre.
        if (plastic) { const pre = inI[i]!, syn = csrI.synOfIn[i]!; for (let k = 0; k < pre.length; k++) { const q = syn[k]!; W[q] = Math.min(VOG.Wmax, W[q]! + eta * x[NE + pre[k]!]!); } }
      } else {
        const j = i - NE;
        countI[bin] = countI[bin]! + 1;
        for (let q = csrI.rowPtr[j]!, e = csrI.rowPtr[j + 1]!; q < e; q++) {
          const tg = csrI.colIdx[q]!;
          // Presynaptic I spike: Δw = η (x_post − α) on I→E synapses, then deliver the conductance.
          if (plastic && tg < NE) W[q] = Math.min(VOG.Wmax, Math.max(0, W[q]! + eta * (x[tg]! - alpha)));
          ringI[target + tg] = ringI[target + tg]! + gIbar * W[q]!;
        }
      }
      x[i] = x[i]! + 1;
    }
    if (step % sampleEvery === 0 && bin < nBins) { iExc[bin] = -gE[0]! * (V[0]! - VOG.EE); iInh[bin] = -gI[0]! * (V[0]! - VOG.EI); }
    if (step % Math.round(10 / dt) === 0) {
      const k = Math.min(wSamples - 1, Math.round(t / 10));
      let s = 0;
      for (let q = 0; q < W.length; q++) if (csrI.colIdx[q]! < NE) s += W[q]!;
      wMean[k] = s / plasticSynapses; wT[k] = t;
      if (k + 1 > wWritten) wWritten = k + 1;
    }
    if (ctx?.onProgress && step % 500 === 0) ctx.onProgress(step / nSteps);
  }
  const tAxis = Float64Array.from({ length: nBins }, (_, i) => i + 0.5);
  const rateE = boxSmooth(Float64Array.from(countE, (c) => (c * 1000) / NE), 25), rateI = boxSmooth(Float64Array.from(countI, (c) => (c * 1000) / NI), 25);
  const out: ModelOutput = {
    t: tAxis, series: { rate_E: rateE, rate_I: rateI, I_exc: boxSmooth(iExc, 10), I_inh: boxSmooth(iInh, 10) },
    curves: { w_IE_mean: { x: wT.slice(0, wWritten), y: wMean.slice(0, wWritten) } }, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED',
  };
  const sp = log.finish();
  out.spikes = { times: sp.times, ids: sp.ids, n: N, groups: [{ name: 'Excitatory', from: 0, to: NE, kind: 'E' }, { name: 'Inhibitory', from: NE, to: N, kind: 'I' }] };
  const rateIn = (counts: Float64Array, from: number, to: number, n: number) => { let s = 0; for (let b = Math.floor(from); b < Math.min(nBins, Math.ceil(to)); b++) s += counts[b]!; return (s * 1000) / n / Math.max(1, to - from); };
  const early = Math.min(tOn > 50 ? tOn : 200, cfg.durationMs);
  out.metrics.initialRateEHz = rateIn(countE, Math.min(50, early / 2), early, NE);
  out.metrics.finalRateEHz = rateIn(countE, lateFrom, cfg.durationMs, NE);
  out.metrics.finalRateIHz = rateIn(countI, lateFrom, cfg.durationMs, NI);
  out.metrics.meanRateEHz = out.metrics.finalRateEHz;
  out.metrics.meanRateIHz = out.metrics.finalRateIHz;
  out.metrics.finalMeanWeight = wWritten ? wMean[wWritten - 1]! : W0;
  out.metrics.initialMeanWeight = W0;
  out.metrics.targetRateHz = rho0;
  out.metrics.rateErrorHz = out.metrics.finalRateEHz - rho0;
  out.metrics.cvIsi = isi.meanCv(0, NE, 3);
  let wMin = Infinity, wMaxSeen = -Infinity;
  for (let q = 0; q < W.length; q++) if (csrI.colIdx[q]! < NE) { if (W[q]! < wMin) wMin = W[q]!; if (W[q]! > wMaxSeen) wMaxSeen = W[q]!; }
  out.metrics.weightMin = wMin;
  out.metrics.weightMax = wMaxSeen;
  const t0 = Math.floor(lateFrom);
  out.metrics.lateExcCurrentPa = meanOf(iExc, t0);
  out.metrics.lateInhCurrentPa = meanOf(iInh, t0);
  out.notes.push(eta > 0
    ? `Inhibitory plasticity moved the excitatory rate from ${out.metrics.initialRateEHz.toFixed(1)} Hz to ${out.metrics.finalRateEHz.toFixed(1)} Hz (target ρ₀ = ${rho0} Hz); mean I→E weight grew from ${W0} to ${out.metrics.finalMeanWeight.toFixed(3)}.`
    : `Plasticity disabled: the network stays at ${out.metrics.finalRateEHz.toFixed(1)} Hz with fixed inhibitory weights.`);
  return out;
}

export const MODEL_022: ModelDefinition = {
  id: 'MODEL-022',
  name: 'Vogels Inhibitory-Plasticity Network',
  equations: [
    'C_m \\frac{dV_i}{dt} = -g_L (V_i - E_L) - g_{E,i}(V_i - E_E) - g_{I,i}(V_i - E_I) + I_{bg}',
    '\\frac{dx_i}{dt} = -\\frac{x_i}{\\tau_{STDP}} + \\sum_f \\delta(t - t_i^{(f)})',
    '\\text{pre (I) spike } j: \\; w_{ij}^{IE} \\leftarrow w_{ij}^{IE} + \\eta\\,(x_i - \\alpha), \\qquad \\alpha = 2 \\rho_0 \\tau_{STDP}',
    '\\text{post (E) spike } i: \\; w_{ij}^{IE} \\leftarrow w_{ij}^{IE} + \\eta\\,x_j',
  ],
  params: VOG_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.05, maxSafeDtMs: 0.2, defaultDurationMs: 10000, maxDurationMs: 10000,
  stochastic: true,
  views: [
    { kind: 'traces', title: 'Population firing rates (25 ms smoothing)', yLabel: 'rate (Hz)', series: [
      { key: 'rate_E', label: 'Excitatory', unit: 'Hz', meaning: 'Mean excitatory rate; plasticity drives it toward the target ρ₀.' },
      { key: 'rate_I', label: 'Inhibitory', unit: 'Hz', meaning: 'Mean inhibitory rate.' },
    ] },
    { kind: 'curve', title: 'Mean plastic I→E weight', xLabel: 't (ms)', yLabel: '⟨W_IE⟩', meaning: 'Average strength of plastic inhibitory synapses over time.', curves: [{ key: 'w_IE_mean', label: '⟨W_IE⟩' }] },
    { kind: 'traces', title: 'Excitatory and inhibitory currents into one neuron (inward positive, 10 ms smoothing)', yLabel: 'current (pA)', series: [
      { key: 'I_exc', label: 'Excitatory', unit: 'pA', meaning: 'Depolarizing synaptic current into a sample excitatory neuron.' },
      { key: 'I_inh', label: 'Inhibitory', unit: 'pA', meaning: 'Hyperpolarizing synaptic current (negative) into the same neuron; it grows to balance excitation.' },
    ] },
    { kind: 'raster', title: 'Spike raster', meaning: 'Activity before and after inhibitory plasticity equalizes rates.' },
  ],
  metrics: [
    { key: 'initialRateEHz', label: 'Initial excitatory rate', unit: 'Hz', description: 'Mean excitatory rate before plasticity starts.', analyticId: 'ANALYTIC-009' },
    { key: 'finalRateEHz', label: 'Final excitatory rate', unit: 'Hz', description: 'Mean excitatory rate over the last part of the run.', analyticId: 'ANALYTIC-009' },
    { key: 'targetRateHz', label: 'Target rate ρ₀', unit: 'Hz', description: 'Set point of the inhibitory plasticity rule.' },
    { key: 'finalMeanWeight', label: 'Final mean I→E weight', unit: '', description: 'Average plastic inhibitory weight at the end.', digits: 4 },
    { key: 'cvIsi', label: 'Late CV of ISI', unit: '', description: 'Irregularity of excitatory firing in the balanced state.', analyticId: 'ANALYTIC-010', digits: 3 },
    { key: 'finalRateIHz', label: 'Final inhibitory rate', unit: 'Hz', description: 'Mean inhibitory rate over the last part of the run.' },
  ],
  presets: [
    { id: 'balance', label: 'Self-organized E/I balance', description: 'Plasticity switches on at 500 ms and pulls the rate to ρ₀.', experimentId: 'EXP-031' },
    { id: 'frozen', label: 'Plasticity off (control)', description: 'Weak fixed inhibition: the network stays in a high-rate state.', params: { eta_Vogels: 0 }, durationMs: 2000, experimentId: 'EXP-031' },
    { id: 'target10', label: 'Higher target rate (10 Hz)', description: 'The set point moves with ρ₀.', params: { rho0_Vogels: 10 }, experimentId: 'EXP-031' },
  ],
  sweep: { paramKey: 'rho0_Vogels', from: 2, to: 14, steps: 7, metricKey: 'finalRateEHz', experimentId: 'EXP-031' },
  kernelLimitations: [
    'Scaled-down network (default N = 1,000 with ε = 0.1) instead of the 10,000-neuron network of Vogels et al. (2011); weights are rescaled accordingly.',
    'Learning is accelerated relative to biology so that balance emerges within seconds of simulated time.',
    'Fixed neuron constants: C = 200 pF, g_L = 10 nS, E_L = V_reset = −60 mV, V_th = −50 mV, τ_ref = 5 ms, E_E = 0 mV, E_I = −80 mV, τ_E = 5 ms, τ_I = 10 ms.',
    'E→E, E→I and I→I weights are static; only I→E synapses are plastic.',
  ],
  run: runVogels,
};
