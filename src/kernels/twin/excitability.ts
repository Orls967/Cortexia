// Integrated Experiment A (EXP-040): neuronal excitability → synaptic response → microcircuit synchrony.
// Stage 1 measures the single-cell f–I relation of the AdEx neuron (MODEL-008). Stage 2/3 places the very same
// AdEx parameters into 800 excitatory cells of a conductance-based E/I microcircuit with exponential AMPA and
// GABA_A synapses (MODEL-006 / MODEL-013 kinetics). Stage 4 analyses the network output with the Module 11
// kernels. Both conditions use the same connectivity and noise seed, so differences come from the perturbation.
import { bandPower, peakFrequency, welchPsd } from '../analytics/fft';
import { binnedRates, groupSpikes, isiAnalysis, synchronyChi } from '../analytics/spikes';
import { configWith } from '../core/config';
import { Rng } from '../core/prng';
import type { ModelOutput, ParamSpec } from '../core/types';
import { MODEL_008 } from '../models/integrateFire';
import { outgoingFromInDegree, reader, type TwinDefinition, type TwinResult } from './common';

const PARAMS: ParamSpec[] = [
  { key: 'gL_base', label: 'Pyramidal leak conductance (baseline)', symbol: 'g_L^{base}', unit: 'nS', default: 30, min: 15, max: 45, step: 0.5, description: 'Leak conductance of the excitatory AdEx cells in the baseline condition.', group: 'Baseline' },
  { key: 'a_base', label: 'Subthreshold adaptation (baseline)', symbol: 'a^{base}', unit: 'nS', default: 4, min: 0, max: 20, step: 0.5, description: 'Subthreshold adaptation conductance of the excitatory cells in the baseline condition.', group: 'Baseline' },
  { key: 'tauG_base', label: 'GABA_A decay (baseline)', symbol: '\\tau_{GABA}^{base}', unit: 'ms', default: 10, min: 3, max: 25, step: 0.5, description: 'Decay time of inhibitory conductances in the baseline condition.', group: 'Baseline' },
  { key: 'gL_int', label: 'Pyramidal leak conductance (intervention)', symbol: 'g_L^{int}', unit: 'nS', default: 24, min: 15, max: 45, step: 0.5, description: 'Leak conductance after the excitability perturbation. Lower values make the cells more excitable.', group: 'Intervention' },
  { key: 'a_int', label: 'Subthreshold adaptation (intervention)', symbol: 'a^{int}', unit: 'nS', default: 4, min: 0, max: 20, step: 0.5, description: 'Subthreshold adaptation after the perturbation.', group: 'Intervention' },
  { key: 'tauG_int', label: 'GABA_A decay (intervention)', symbol: '\\tau_{GABA}^{int}', unit: 'ms', default: 10, min: 3, max: 25, step: 0.5, description: 'Decay time of inhibitory conductances after the perturbation; it sets the period of the network rhythm.', group: 'Intervention' },
  { key: 'duration', label: 'Network simulation time', symbol: 'T', unit: 'ms', default: 1500, min: 600, max: 3000, step: 100, description: 'Simulated time per condition.', group: 'Run' },
];

// Fixed microcircuit constants (documented in the limitations).
const NET = {
  NE: 800, NI: 200, KE: 80, KI: 20, dt: 0.1, delayMs: 1.0,
  E: { C: 281, EL: -70.6, VT: -50.4, dT: 2, tauW: 144, b: 40, Vr: -60, Vpeak: 0, tref: 2 },
  I: { C: 100, gL: 10, EL: -65, Vth: -50, Vr: -60, tref: 1 },
  EE: 0, EI: -75, tauAmpa: 5,
  wEE: 0.25, wEI: 1.6, wIE: 3.2, wII: 1.0,
  extRateE: 4600, extWE: 0.8, extRateI: 1000, extWI: 0.5,
};

interface Condition { gL: number; a: number; tauG: number }

function singleCell(c: Condition) {
  const base = { g_L: c.gL, a_AdEx: c.a, b_AdEx: NET.E.b, V_reset: NET.E.Vr };
  const probe = MODEL_008.run(configWith(MODEL_008, { params: base, durationMs: 50 }));
  const rheobase = probe.metrics.rheobasePa ?? NaN;
  const currents = Float64Array.from({ length: 9 }, (_, i) => Math.max(0, rheobase - 100) + i * 100);
  const rates = Float64Array.from(currents, (I) => {
    const o = MODEL_008.run(configWith(MODEL_008, { params: base, durationMs: 1200, stimulus: { kind: 'step', amplitude: I, startMs: 50, durationMs: 1e9 } }));
    const sp = Array.from(o.curves.spikeTimes?.x ?? []).filter((t) => t > 600);
    return sp.length > 1 ? (1000 * (sp.length - 1)) / (sp[sp.length - 1]! - sp[0]!) : 0;
  });
  // f–I gain: least-squares slope over the firing part of the curve.
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let i = 0; i < currents.length; i++) if (rates[i]! > 0) { sx += currents[i]!; sy += rates[i]!; sxx += currents[i]! ** 2; sxy += currents[i]! * rates[i]!; n++; }
  const gain = n > 1 ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : NaN;
  return { rheobase, currents, rates, gain };
}

function network(c: Condition, durationMs: number, seed: number, onProgress?: (f: number) => void): ModelOutput {
  const { NE, NI, dt } = NET;
  const N = NE + NI, nSteps = Math.round(durationMs / dt);
  const wiring = new Rng(seed ^ 0x1234abcd), rng = new Rng(seed);
  const pick = (n: number, k: number, ex: number) => wiring.sample(n, k, ex);
  const outEE = outgoingFromInDegree(NE, NE, NET.KE, pick, true), outEI = outgoingFromInDegree(NE, NI, NET.KE, pick, false);
  const outIE = outgoingFromInDegree(NI, NE, NET.KI, pick, false), outII = outgoingFromInDegree(NI, NI, NET.KI, pick, true);
  const dSteps = Math.max(1, Math.round(NET.delayMs / dt)), K = dSteps + 1;
  const ringE = new Float64Array(K * N), ringI = new Float64Array(K * N);
  const V = new Float64Array(N), w = new Float64Array(NE), gE = new Float64Array(N), gI = new Float64Array(N), refr = new Int32Array(N);
  for (let i = 0; i < N; i++) V[i] = (i < NE ? NET.E.EL : NET.I.EL) + 10 * wiring.next();
  const decE = Math.exp(-dt / NET.tauAmpa), decI = Math.exp(-dt / c.tauG), decW = Math.exp(-dt / NET.E.tauW);
  const extE = (NET.extRateE * dt) / 1000, extI = (NET.extRateI * dt) / 1000;
  const refE = Math.round(NET.E.tref / dt), refI = Math.round(NET.I.tref / dt);
  const times: number[] = [], ids: number[] = [];
  const nBins = Math.ceil(durationMs);
  const cE = new Float64Array(nBins), cI = new Float64Array(nBins), lfp = new Float64Array(nBins), vS = new Float64Array(nBins);
  const perMs = Math.round(1 / dt);
  for (let step = 0; step < nSteps; step++) {
    const t = step * dt, slot = (step % K) * N, target = ((step + dSteps) % K) * N, bin = Math.min(nBins - 1, Math.floor(t));
    let synCurrent = 0;
    for (let i = 0; i < N; i++) {
      const isE = i < NE;
      const ge = gE[i]! * decE + ringE[slot + i]! + (isE ? NET.extWE * rng.poisson(extE) : NET.extWI * rng.poisson(extI));
      const gi = gI[i]! * decI + ringI[slot + i]!;
      ringE[slot + i] = 0; ringI[slot + i] = 0;
      gE[i] = ge; gI[i] = gi;
      let v = V[i]!;
      if (isE) {
        // Adaptation: exact relaxation toward a (V − E_L).
        const wInf = c.a * (v - NET.E.EL);
        w[i] = wInf + (w[i]! - wInf) * decW;
        synCurrent += ge * (v - NET.EE) + gi * (v - NET.EI);
      }
      if (refr[i]! > 0) { refr[i] = refr[i]! - 1; continue; }
      let fired = false;
      if (isE) {
        // Exponential-Euler for the linear conductances; the exponential spike current and adaptation enter explicitly.
        const gTot = c.gL + ge + gi;
        const drive = c.gL * NET.E.EL + ge * NET.EE + gi * NET.EI + c.gL * NET.E.dT * Math.exp(Math.min(20, (v - NET.E.VT) / NET.E.dT)) - w[i]!;
        const vInf = drive / gTot;
        v = vInf + (v - vInf) * Math.exp((-dt * gTot) / NET.E.C);
        if (!(v < NET.E.Vpeak)) { v = NET.E.Vr; w[i] = w[i]! + NET.E.b; refr[i] = refE; fired = true; }
      } else {
        const gTot = NET.I.gL + ge + gi;
        const vInf = (NET.I.gL * NET.I.EL + ge * NET.EE + gi * NET.EI) / gTot;
        v = vInf + (v - vInf) * Math.exp((-dt * gTot) / NET.I.C);
        if (v >= NET.I.Vth) { v = NET.I.Vr; refr[i] = refI; fired = true; }
      }
      V[i] = v;
      if (!fired) continue;
      times.push(t); ids.push(i);
      if (isE) {
        cE[bin] = cE[bin]! + 1;
        for (const q of outEE[i]!) ringE[target + q] = ringE[target + q]! + NET.wEE;
        for (const q of outEI[i]!) ringE[target + NE + q] = ringE[target + NE + q]! + NET.wEI;
      } else {
        const j = i - NE;
        cI[bin] = cI[bin]! + 1;
        for (const q of outIE[j]!) ringI[target + q] = ringI[target + q]! + NET.wIE;
        for (const q of outII[j]!) ringI[target + NE + q] = ringI[target + NE + q]! + NET.wII;
      }
    }
    lfp[bin] = lfp[bin]! - synCurrent / NE / perMs;
    if (step % perMs === 0) vS[bin] = V[0]!;
    if (onProgress && step % 1000 === 0) onProgress(step / nSteps);
  }
  const out: ModelOutput = { t: Float64Array.from({ length: nBins }, (_, i) => i + 0.5), series: {}, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  const smooth = (x: Float64Array, n: number, k: number) => { const o = new Float64Array(x.length); let acc = 0; for (let i = 0; i < x.length; i++) { acc += x[i]!; if (i >= k) acc -= x[i - k]!; o[i] = (acc * 1000) / n / Math.min(i + 1, k); } return o; };
  out.series.rate_E = smooth(cE, NE, 3);
  out.series.rate_I = smooth(cI, NI, 3);
  out.series.lfp_proxy = lfp;
  out.series.V_sample = vS;
  out.spikes = { times: Float64Array.from(times), ids: Uint32Array.from(ids), n: N, groups: [{ name: 'Excitatory (AdEx)', from: 0, to: NE, kind: 'E' }, { name: 'Inhibitory', from: NE, to: N, kind: 'I' }] };
  // Stage 4: Module 11 analytics on the network output (first 300 ms discarded as transient).
  const from = 300;
  const span = (durationMs - from) / 1000;
  let nE = 0, nI = 0;
  for (let k = 0; k < times.length; k++) if (times[k]! >= from) { if (ids[k]! < NE) nE++; else nI++; }
  const lateTimes = times.filter((x) => x >= from), lateIds = ids.filter((_, k) => times[k]! >= from);
  const trains = groupSpikes(lateTimes, lateIds, NE).filter((tr) => tr.length >= 4);
  const psd = welchPsd(lfp.subarray(from), 1000, 512);
  const total = bandPower(psd, 5, 200), gamma = bandPower(psd, 30, 80);
  const keep = psd.freq.findIndex((f) => f > 150);
  out.curves.lfp_psd = { x: psd.freq.slice(1, keep), y: psd.power.slice(1, keep) };
  out.metrics.rateEHz = nE / NE / span;
  out.metrics.rateIHz = nI / NI / span;
  out.metrics.cvIsi = trains.length ? isiAnalysis(trains).cv : NaN;
  out.metrics.synchronyChi = synchronyChi(binnedRates(groupSpikes(lateTimes.map((x) => x - from), lateIds, 200), durationMs - from, 5));
  out.metrics.gammaPower = gamma;
  out.metrics.gammaFraction = total > 0 ? gamma / total : NaN;
  out.metrics.peakFrequencyHz = peakFrequency(psd, 10, 150);
  return out;
}

export const TWIN_EXCITABILITY: TwinDefinition = {
  id: 'EXP-040',
  title: 'Neuronal excitability → synaptic response → microcircuit synchrony',
  anchorEntityIds: ['ANAT-DLPFC', 'CIRC-003', 'CELL-PYRAMIDAL-L23', 'CELL-INTERNEURON-PV-BASKET'],
  anchorNote: 'The microcircuit is a generic pyramidal–interneuron gamma motif. Its association with layer 2/3 of prefrontal cortex is a conceptual anchor through the knowledge graph, not a claim that the simulation reproduces that tissue.',
  params: PARAMS,
  views: [
    { kind: 'curve', title: 'Stage 1 · single-cell f–I curve', xLabel: 'I (pA)', yLabel: 'f (Hz)', meaning: 'Steady firing rate of one isolated AdEx cell versus injected current, with this condition\'s leak and adaptation.', curves: [{ key: 'fI', label: 'AdEx f–I', points: true }] },
    { kind: 'raster', title: 'Stage 3 · microcircuit spike raster', meaning: 'Spikes of the 800 excitatory and 200 inhibitory cells.' },
    { kind: 'traces', title: 'Stage 3 · population rates (3 ms smoothing)', yLabel: 'rate (Hz)', series: [
      { key: 'rate_E', label: 'Excitatory', unit: 'Hz', meaning: 'Mean firing rate of the excitatory AdEx population.' },
      { key: 'rate_I', label: 'Inhibitory', unit: 'Hz', meaning: 'Mean firing rate of the fast-spiking inhibitory population.' },
    ] },
    { kind: 'curve', title: 'Stage 4 · LFP-proxy power spectrum', xLabel: 'frequency (Hz)', yLabel: 'PSD (pA²/Hz)', meaning: 'Welch spectrum of the mean synaptic current onto excitatory cells, a common proxy for the local field potential.', curves: [{ key: 'lfp_psd', label: 'PSD' }] },
    { kind: 'traces', title: 'Stage 4 · LFP proxy', yLabel: 'mean synaptic current (pA)', series: [{ key: 'lfp_proxy', label: 'LFP proxy', unit: 'pA', meaning: 'Mean inward synaptic current onto excitatory cells, sampled per millisecond.' }] },
  ],
  stages: [
    { index: 1, title: 'Cellular excitability', tier: 'Tier 2', coupling: 'MECHANISTIC', modelIds: ['MODEL-008'], entityIds: ['MODEL-008', 'MECH-017', 'CELL-PYRAMIDAL-L23'], input: 'Leak conductance g_L and adaptation a', output: 'Rheobase and f–I gain of one AdEx cell', timescale: 'ms – s' },
    { index: 2, title: 'Synaptic kernels', tier: 'Tier 2', coupling: 'MECHANISTIC', modelIds: ['MODEL-006', 'MODEL-013'], entityIds: ['MECH-022', 'MECH-024', 'MOL-REC-AMPAR', 'MOL-REC-GABAA'], input: 'Spikes of every cell', output: 'AMPA (τ = 5 ms) and GABA_A conductances', timescale: 'ms' },
    { index: 3, title: 'E/I microcircuit', tier: 'Tier 3', coupling: 'MECHANISTIC', modelIds: ['MODEL-021'], entityIds: ['CIRC-003', 'MECH-043', 'MECH-042'], input: 'The same AdEx parameters in 800 excitatory cells, 200 inhibitory cells, sparse random wiring', output: 'Spike raster, population rates, mean synaptic current', timescale: 'ms – s' },
    { index: 4, title: 'Signal analytics', tier: 'Tier 5', coupling: 'MECHANISTIC', modelIds: [], entityIds: ['ANALYTIC-004', 'ANALYTIC-010', 'ANALYTIC-015'], input: 'Raster and LFP proxy', output: 'Rates, CV of ISI, synchrony χ, gamma-band power', timescale: 'analysis' },
    { index: 5, title: 'Functional context', tier: 'Tier 1', coupling: 'CONCEPTUAL', modelIds: [], entityIds: ['ANAT-DLPFC', 'COG-WORKING-MEMORY'], input: 'Baseline versus intervention differences', output: 'Scoped educational interpretation', timescale: 'interpretive' },
  ],
  validationBoundary: 'Demonstrates how single-cell excitability shifts E/I balance and rhythm in a generic microcircuit (Brunel 2000; Vogels et al. 2011). It is not a model of any disorder and supports no clinical or diagnostic conclusion.',
  limitations: [
    'Fixed microcircuit: 800 AdEx excitatory and 200 leaky integrate-and-fire inhibitory cells, in-degree 80 excitatory and 20 inhibitory, 1 ms delay, Poisson background input.',
    'Synaptic weights (nS): E→E 0.25, E→I 1.6, I→E 3.2, I→I 1.0; spike-triggered adaptation b = 40 pA and reset −60 mV are fixed.',
    'Single-exponential conductances; no NMDA, short-term plasticity, dendrites or laminar structure.',
    'The LFP proxy is the mean synaptic current onto excitatory cells, not a field potential computed from geometry.',
  ],
  references: ['REF-BRUNEL-2000', 'REF-BRETTE-GERSTNER-2005', 'REF-VOGELS-2011'],
  provenance: 'SYNTHETIC_SIMULATION',
  run(values, seed, onProgress): TwinResult {
    const p = reader(PARAMS, values);
    const base: Condition = { gL: p('gL_base'), a: p('a_base'), tauG: p('tauG_base') }, int: Condition = { gL: p('gL_int'), a: p('a_int'), tauG: p('tauG_int') };
    const T = p('duration');
    onProgress?.(0.02, 'Stage 1: single-cell f–I curves');
    const sb = singleCell(base), si = singleCell(int);
    onProgress?.(0.1, 'Stage 3: baseline microcircuit');
    const nb = network(base, T, seed, (f) => onProgress?.(0.1 + 0.44 * f, 'Stage 3: baseline microcircuit'));
    const ni = network(int, T, seed, (f) => onProgress?.(0.55 + 0.44 * f, 'Stage 3: perturbed microcircuit'));
    nb.curves.fI = { x: sb.currents, y: sb.rates }; ni.curves.fI = { x: si.currents, y: si.rates };
    const cmp = (key: string, label: string, unit: string, b: number, i: number, description: string, analyticId?: string, digits?: number) => ({ key, label, unit, baseline: b, intervention: i, description, ...(analyticId ? { analyticId } : {}), ...(digits !== undefined ? { digits } : {}) });
    const comparisons = [
      cmp('rheobase', 'Single-cell rheobase', 'pA', sb.rheobase, si.rheobase, 'Smallest current that sustains firing of one isolated cell (closed form of the AdEx model).'),
      cmp('gain', 'Single-cell f–I gain', 'Hz/nA', 1000 * sb.gain, 1000 * si.gain, 'Slope of the firing-rate versus current relation above rheobase.'),
      cmp('rateE', 'Excitatory population rate', 'Hz', nb.metrics.rateEHz!, ni.metrics.rateEHz!, 'Mean firing rate of excitatory cells in the microcircuit.', 'ANALYTIC-009'),
      cmp('rateI', 'Inhibitory population rate', 'Hz', nb.metrics.rateIHz!, ni.metrics.rateIHz!, 'Mean firing rate of inhibitory cells in the microcircuit.', 'ANALYTIC-009'),
      cmp('cv', 'CV of inter-spike intervals', '', nb.metrics.cvIsi!, ni.metrics.cvIsi!, 'Irregularity of excitatory firing.', 'ANALYTIC-010', 3),
      cmp('chi', 'Synchrony index χ', '', nb.metrics.synchronyChi!, ni.metrics.synchronyChi!, 'Population synchrony of 200 excitatory cells (5 ms bins).', 'ANALYTIC-015', 3),
      cmp('gamma', 'Gamma-band power (30–80 Hz)', 'pA²', nb.metrics.gammaPower!, ni.metrics.gammaPower!, 'Power of the LFP proxy in the gamma band.', 'ANALYTIC-004'),
      cmp('peak', 'Spectral peak', 'Hz', nb.metrics.peakFrequencyHz!, ni.metrics.peakFrequencyHz!, 'Frequency of the largest LFP-proxy spectral peak between 10 and 150 Hz.', 'ANALYTIC-004'),
    ];
    const pct = (b: number, i: number) => (b !== 0 ? `${i >= b ? '+' : ''}${(100 * (i - b) / Math.abs(b)).toFixed(0)}%` : 'n/a');
    const summaries = [
      `Rheobase ${sb.rheobase.toFixed(0)} → ${si.rheobase.toFixed(0)} pA; f–I gain ${(1000 * sb.gain).toFixed(1)} → ${(1000 * si.gain).toFixed(1)} Hz/nA.`,
      `AMPA decay 5 ms in both conditions; GABA_A decay ${base.tauG} → ${int.tauG} ms.`,
      `Excitatory rate ${nb.metrics.rateEHz!.toFixed(1)} → ${ni.metrics.rateEHz!.toFixed(1)} Hz; inhibitory rate ${nb.metrics.rateIHz!.toFixed(1)} → ${ni.metrics.rateIHz!.toFixed(1)} Hz.`,
      `Gamma power changed by ${pct(nb.metrics.gammaPower!, ni.metrics.gammaPower!)}; spectral peak ${nb.metrics.peakFrequencyHz!.toFixed(0)} → ${ni.metrics.peakFrequencyHz!.toFixed(0)} Hz; χ ${nb.metrics.synchronyChi!.toFixed(2)} → ${ni.metrics.synchronyChi!.toFixed(2)}.`,
      'Interpretation is limited to this generic motif: changes in rhythm strength illustrate E/I-balance sensitivity; they are not a prediction about prefrontal function or cognition.',
    ];
    onProgress?.(1, 'Done');
    return {
      experimentId: 'EXP-040', conditions: { baseline: nb, intervention: ni }, comparisons,
      stages: TWIN_EXCITABILITY.stages.map((s, k) => ({ ...s, summary: summaries[k]! })),
      notes: ['Both conditions share the same wiring and noise seed; only the listed parameters differ.'],
    };
  },
};
