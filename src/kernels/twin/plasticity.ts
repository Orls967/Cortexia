// Integrated Experiment B (EXP-041): pair-based STDP → directed weight reorganization → population recall.
// Stage 1 fixes the STDP window (MODEL-024, EQ-STDP-WINDOW). Stage 2 trains a sparse recurrent LIF network: three
// overlapping cue groups are each activated as a repeating temporal sequence, so the asymmetric window strengthens
// forward (early → late) synapses and weakens backward ones. Stage 3 probes recall by stimulating only the first
// quarter of each sequence, before and after training, and analyses the learned weight graph with Module 11.
// "Baseline" = the network before training; "intervention" = the same network after training.
import { clusteringCoefficient, degreeMetrics } from '../analytics/graph';
import { Rng } from '../core/prng';
import type { ModelOutput, ParamSpec } from '../core/types';
import { reader, type TwinDefinition, type TwinResult } from './common';

const PARAMS: ParamSpec[] = [
  { key: 'A_plus', label: 'Potentiation amplitude', symbol: 'A_+', unit: '', default: 0.01, min: 0, max: 0.05, step: 0.0005, description: 'Fractional weight increase (of w_max) for a pre-before-post pair at Δt → 0.', group: 'STDP rule' },
  { key: 'A_minus', label: 'Depression amplitude', symbol: 'A_-', unit: '', default: 0.0105, min: 0, max: 0.05, step: 0.0005, description: 'Fractional weight decrease (of w_max) for a post-before-pre pair at Δt → 0.', group: 'STDP rule' },
  { key: 'tau_plus', label: 'Potentiation time constant', symbol: '\\tau_+', unit: 'ms', default: 16.8, min: 5, max: 50, step: 0.1, description: 'Width of the potentiation side of the STDP window.', group: 'STDP rule' },
  { key: 'tau_minus', label: 'Depression time constant', symbol: '\\tau_-', unit: 'ms', default: 33.7, min: 5, max: 100, step: 0.1, description: 'Width of the depression side of the STDP window.', group: 'STDP rule' },
  { key: 'overlap', label: 'Cue overlap', symbol: 'n_{ov}', unit: 'neurons', default: 20, min: 0, max: 60, step: 5, integer: true, description: 'Number of excitatory neurons shared by neighbouring cue groups.', group: 'Training' },
  { key: 'train_s', label: 'Training time', symbol: 'T_{train}', unit: 's', default: 10, min: 2, max: 10, step: 1, description: 'Simulated training duration.', group: 'Training' },
  { key: 'sweep_ms', label: 'Sequence duration', symbol: 'T_{seq}', unit: 'ms', default: 60, min: 20, max: 120, step: 5, description: 'Time over which the neurons of a cue group are activated in order during one presentation.', group: 'Training' },
];

const NET = { NE: 400, NI: 100, group: 120, pEE: 0.25, wMax: 6, w0: 0.15, EL: -65, Vth: -50, Vr: -65, tau: 20, tref: 3, delay: 1.5, dt: 0.1, bgSigma: 1.5, pEI: 0.2, wEI: 1.2, pIE: 0.3, wIE: 1.5, cueEvery: 100, probeFraction: 0.25, recallWindow: 120 };

interface Net {
  pre: Uint32Array; post: Uint32Array; w: Float64Array;
  outPtr: Uint32Array; outSyn: Uint32Array; inPtr: Uint32Array; inSyn: Uint32Array;
  eiTargets: Uint32Array[]; ieTargets: Uint32Array[];
  groups: number[][];
}

function buildNet(seed: number, overlap: number): Net {
  const rng = new Rng(seed ^ 0x5bd1e995), { NE, NI } = NET;
  const pre: number[] = [], post: number[] = [];
  for (let i = 0; i < NE; i++) for (let j = 0; j < NE; j++) if (i !== j && rng.next() < NET.pEE) { pre.push(j); post.push(i); }
  const m = pre.length;
  const index = (key: number[], n: number) => {
    const ptr = new Uint32Array(n + 1);
    for (const k of key) ptr[k + 1] = ptr[k + 1]! + 1;
    for (let i = 0; i < n; i++) ptr[i + 1] = ptr[i + 1]! + ptr[i]!;
    const fill = Uint32Array.from(ptr.subarray(0, n)), syn = new Uint32Array(m);
    key.forEach((k, s) => { syn[fill[k]!] = s; fill[k] = fill[k]! + 1; });
    return { ptr, syn };
  };
  const o = index(pre, NE), inn = index(post, NE);
  const targets = (nPre: number, nPost: number, p: number) => Array.from({ length: nPre }, () => { const l: number[] = []; for (let q = 0; q < nPost; q++) if (rng.next() < p) l.push(q); return Uint32Array.from(l); });
  const step = NET.group - overlap;
  const groups = [0, 1, 2].map((g) => Array.from({ length: NET.group }, (_, k) => (g * step + k) % NE));
  return { pre: Uint32Array.from(pre), post: Uint32Array.from(post), w: new Float64Array(m).fill(NET.w0 * NET.wMax), outPtr: o.ptr, outSyn: o.syn, inPtr: inn.ptr, inSyn: inn.syn, eiTargets: targets(NE, NI, NET.pEI), ieTargets: targets(NI, NE, NET.pIE), groups };
}

interface Rule { Ap: number; Am: number; tp: number; tm: number }
interface SimOut { times: number[]; ids: number[]; forward: number[]; backward: number[]; sampleT: number[] }

/** Runs the network for `durationMs`. `forced` maps a step index to neurons that are made to spike at that step. */
function simulate(net: Net, durationMs: number, forced: Map<number, number[]>, rule: Rule | null, seed: number, order: Int32Array, onProgress?: (f: number) => void): SimOut {
  const { NE, NI, dt } = NET, N = NE + NI, nSteps = Math.round(durationMs / dt);
  const rng = new Rng(seed);
  const dS = Math.round(NET.delay / dt), K = dS + 1, ring = new Float64Array(K * N);
  const V = new Float64Array(N).fill(NET.EL), refr = new Int32Array(N), x = new Float64Array(NE), y = new Float64Array(NE);
  const decay = Math.exp(-dt / NET.tau), noise = NET.bgSigma * Math.sqrt(1 - decay * decay), refSteps = Math.round(NET.tref / dt);
  const dxp = rule ? Math.exp(-dt / rule.tp) : 1, dym = rule ? Math.exp(-dt / rule.tm) : 1;
  const out: SimOut = { times: [], ids: [], forward: [], backward: [], sampleT: [] };
  const sampleEvery = Math.round(250 / dt);
  for (let step = 0; step < nSteps; step++) {
    const t = step * dt, slot = (step % K) * N, target = ((step + dS) % K) * N, force = forced.get(step);
    if (rule) for (let i = 0; i < NE; i++) { x[i] = x[i]! * dxp; y[i] = y[i]! * dym; }
    for (let i = 0; i < N; i++) {
      let fire = false;
      if (refr[i]! > 0) { refr[i] = refr[i]! - 1; ring[slot + i] = 0; V[i] = NET.Vr; }
      else {
        const v = NET.EL + (V[i]! - NET.EL) * decay + noise * rng.normal() + ring[slot + i]!;
        ring[slot + i] = 0; V[i] = v; fire = v >= NET.Vth;
      }
      if (force && i < NE && force.includes(i)) fire = true;
      if (!fire) continue;
      V[i] = NET.Vr; refr[i] = refSteps;
      if (i < NE) {
        out.times.push(t); out.ids.push(i);
        for (let q = net.outPtr[i]!; q < net.outPtr[i + 1]!; q++) { const s = net.outSyn[q]!; const tg = net.post[s]!; ring[target + tg] = ring[target + tg]! + net.w[s]!; }
        for (const q of net.eiTargets[i]!) ring[target + NE + q] = ring[target + NE + q]! + NET.wEI;
        if (rule) {
          // Presynaptic spike of i: depress its outgoing synapses by A₋ y_post; postsynaptic spike of i: potentiate incoming by A₊ x_pre.
          for (let q = net.outPtr[i]!; q < net.outPtr[i + 1]!; q++) { const s = net.outSyn[q]!; net.w[s] = Math.max(0, net.w[s]! - rule.Am * NET.wMax * y[net.post[s]!]!); }
          for (let q = net.inPtr[i]!; q < net.inPtr[i + 1]!; q++) { const s = net.inSyn[q]!; net.w[s] = Math.min(NET.wMax, net.w[s]! + rule.Ap * NET.wMax * x[net.pre[s]!]!); }
          x[i] = x[i]! + 1; y[i] = y[i]! + 1;
        }
      } else {
        for (const q of net.ieTargets[i - NE]!) ring[target + q] = ring[target + q]! - NET.wIE;
      }
    }
    if (rule && step % sampleEvery === 0) { const fb = forwardBackward(net, order); out.forward.push(fb.forward); out.backward.push(fb.backward); out.sampleT.push(t); }
    if (onProgress && step % 2000 === 0) onProgress(step / nSteps);
  }
  return out;
}

/** Mean weight of within-group synapses pointing forward (earlier → later in the trained sequence) and backward. */
function forwardBackward(net: Net, order: Int32Array): { forward: number; backward: number } {
  let f = 0, nf = 0, b = 0, nb = 0;
  for (let s = 0; s < net.w.length; s++) {
    const a = order[net.pre[s]!]!, c = order[net.post[s]!]!;
    if (a < 0 || c < 0 || Math.floor(a / 1000) !== Math.floor(c / 1000)) continue;
    if (c % 1000 > a % 1000) { f += net.w[s]!; nf++; } else { b += net.w[s]!; nb++; }
  }
  return { forward: nf ? f / nf : NaN, backward: nb ? b / nb : NaN };
}

function recallProbe(net: Net, seed: number, order: Int32Array): { fraction: number[]; spurious: number[]; out: SimOut; probeTimes: number[] } {
  const forced = new Map<number, number[]>(), probeTimes: number[] = [], spacing = 400;
  net.groups.forEach((g, k) => {
    const t0 = 100 + k * spacing;
    probeTimes.push(t0);
    const cue = g.slice(0, Math.round(NET.probeFraction * g.length));
    cue.forEach((n, q) => { const st = Math.round((t0 + (q / cue.length) * 12) / NET.dt); (forced.get(st) ?? forced.set(st, []).get(st)!).push(n); });
  });
  const out = simulate(net, 100 + net.groups.length * spacing, forced, null, seed, order);
  const fraction = net.groups.map((g, k) => {
    const rest = new Set(g.slice(Math.round(NET.probeFraction * g.length))), seen = new Set<number>();
    for (let q = 0; q < out.times.length; q++) if (out.times[q]! >= probeTimes[k]! && out.times[q]! < probeTimes[k]! + NET.recallWindow && rest.has(out.ids[q]!)) seen.add(out.ids[q]!);
    return seen.size / rest.size;
  });
  // Spurious activation: share of neurons outside the probed group that fire in the same window (0 = specific recall).
  const spurious = net.groups.map((g, k) => {
    const inGroup = new Set(g), seen = new Set<number>();
    for (let q = 0; q < out.times.length; q++) if (out.times[q]! >= probeTimes[k]! && out.times[q]! < probeTimes[k]! + NET.recallWindow && !inGroup.has(out.ids[q]!)) seen.add(out.ids[q]!);
    return seen.size / (NET.NE - g.length);
  });
  return { fraction, spurious, out, probeTimes };
}

function weightMatrix(net: Net): Float64Array {
  const n = NET.NE, m = new Float64Array(n * n);
  for (let s = 0; s < net.w.length; s++) m[net.post[s]! * n + net.pre[s]!] = net.w[s]!;
  return m;
}

function describeGraph(net: Net) {
  const n = NET.NE, wm = weightMatrix(net);
  const strong = Float64Array.from(wm, (v) => (v >= 0.5 * NET.wMax ? 1 : 0));
  const und = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (strong[i * n + j] || strong[j * n + i]) und[i * n + j] = 1;
  const deg = degreeMetrics(wm, n);
  let asym = 0, cnt = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = wm[i * n + j]!, b = wm[j * n + i]!; if (a > 0 && b > 0) { asym += Math.abs(a - b) / (a + b); cnt++; } }
  let strongCount = 0;
  for (const v of strong) strongCount += v;
  return { wm, clustering: clusteringCoefficient(und, n).mean, strongCount, asymmetry: cnt ? asym / cnt : NaN, inStrength: deg.inStrength, outStrength: deg.outStrength };
}

function conditionOutput(net: Net, probe: ReturnType<typeof recallProbe>, tr: SimOut | null): ModelOutput {
  const g = describeGraph(net), n = NET.NE;
  const out: ModelOutput = { t: new Float64Array(0), series: {}, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  // Display matrix: 4 × 4 block-averaged weights (100 × 100) keeps the heat map light.
  const B = 4, m = n / B, small = new Float64Array(m * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) small[Math.floor(i / B) * m + Math.floor(j / B)] = small[Math.floor(i / B) * m + Math.floor(j / B)]! + g.wm[i * n + j]! / (B * B);
  out.matrices.weights = { rows: m, cols: m, data: small };
  out.spikes = { times: Float64Array.from(probe.out.times), ids: Uint32Array.from(probe.out.ids), n, groups: [{ name: 'Excitatory neurons (index = sequence position)', from: 0, to: n, kind: 'E' }] };
  out.curves.recall = { x: Float64Array.from(probe.fraction, (_, k) => k + 1), y: Float64Array.from(probe.fraction) };
  out.curves.strength_balance = { x: Float64Array.from({ length: n }, (_, i) => i), y: Float64Array.from({ length: n }, (_, i) => g.outStrength[i]! - g.inStrength[i]!) };
  if (tr) { out.curves.w_forward = { x: Float64Array.from(tr.sampleT, (v) => v / 1000), y: Float64Array.from(tr.forward) }; out.curves.w_backward = { x: Float64Array.from(tr.sampleT, (v) => v / 1000), y: Float64Array.from(tr.backward) }; }
  const fb = forwardBackward(net, orderOf(net));
  let wMin = Infinity, wMax = -Infinity;
  for (const v of net.w) { if (v < wMin) wMin = v; if (v > wMax) wMax = v; }
  out.curves.spurious = { x: Float64Array.from(probe.spurious, (_, k) => k + 1), y: Float64Array.from(probe.spurious) };
  Object.assign(out.metrics, { recallMean: probe.fraction.reduce((a, b) => a + b, 0) / probe.fraction.length, spuriousMean: probe.spurious.reduce((a, b) => a + b, 0) / probe.spurious.length, forwardWeight: fb.forward, backwardWeight: fb.backward, directionality: (fb.forward - fb.backward) / (fb.forward + fb.backward), clustering: g.clustering, strongSynapses: g.strongCount, asymmetry: g.asymmetry, weightMin: wMin, weightMax: wMax });
  return out;
}

/** order[n] = 1000·group + position for neurons in exactly one cue group; −1 for overlap or unassigned neurons. */
function orderOf(net: Net): Int32Array {
  const order = new Int32Array(NET.NE).fill(-1), count = new Uint8Array(NET.NE);
  net.groups.forEach((g) => g.forEach((n) => { count[n] = count[n]! + 1; }));
  net.groups.forEach((g, k) => g.forEach((n, q) => { if (count[n] === 1) order[n] = 1000 * k + q; }));
  return order;
}

export const TWIN_PLASTICITY: TwinDefinition = {
  id: 'EXP-041',
  title: 'Pair-based STDP → directed weight reorganization → population recall',
  anchorEntityIds: ['ANAT-HIPPOCAMPUS-CA3', 'CIRC-007', 'CELL-PYRAMIDAL-CA3', 'COG-MEMORY-ENC-RET'],
  anchorNote: 'A recurrent excitatory network with plastic synapses is a classic abstraction of hippocampal CA3. The anchor is conceptual: the simulation shows sequence learning and cue-driven completion in a toy network, not episodic memory.',
  params: PARAMS,
  views: [
    { kind: 'matrix', title: 'Stage 2 · excitatory weight matrix (4 × 4 block average)', key: 'weights', xLabel: 'presynaptic neuron →', yLabel: 'postsynaptic neuron', meaning: 'Recurrent excitatory weights. After sequence training, weight concentrates just below the diagonal of each cue block: early neurons drive later ones.' },
    { kind: 'curve', title: 'Stage 2 · forward versus backward weights during training', xLabel: 'training time (s)', yLabel: 'mean weight (mV)', meaning: 'Mean within-group weight of synapses pointing along and against the trained sequence.', curves: [{ key: 'w_forward', label: 'Forward (early → late)' }, { key: 'w_backward', label: 'Backward (late → early)', dashed: true }] },
    { kind: 'raster', title: 'Stage 3 · recall probe (first quarter of each sequence stimulated)', meaning: 'Excitatory spikes during the three partial-cue probes at 100, 500 and 900 ms.' },
    { kind: 'curve', title: 'Stage 3 · pattern completion per cue group', xLabel: 'cue group', yLabel: 'fraction of non-cued group recalled', meaning: 'Share of the non-stimulated neurons of each group that fire within 120 ms of the partial cue.', curves: [{ key: 'recall', label: 'Recalled (rest of the cued group)', points: true }, { key: 'spurious', label: 'Spurious (neurons outside the group)', points: true, dashed: true }] },
    { kind: 'curve', title: 'Stage 3 · directed strength balance', xLabel: 'neuron index', yLabel: 'out-strength − in-strength (mV)', meaning: 'Directed degree asymmetry of each neuron in the weight graph: positive for sequence starters, negative for sequence ends.', curves: [{ key: 'strength_balance', label: 'out − in' }] },
  ],
  stages: [
    { index: 1, title: 'STDP rule', tier: 'Tier 2', coupling: 'MECHANISTIC', modelIds: ['MODEL-024'], entityIds: ['MODEL-024', 'MECH-035', 'MECH-032', 'MECH-034'], input: 'A₊, A₋, τ₊, τ₋', output: 'Asymmetric pair-based window applied online through pre/post traces', timescale: 'ms' },
    { index: 2, title: 'Recurrent network training', tier: 'Tier 3', coupling: 'MECHANISTIC', modelIds: ['MODEL-005', 'MODEL-021', 'MODEL-024'], entityIds: ['CIRC-007', 'CELL-PYRAMIDAL-CA3'], input: 'Three overlapping cue groups presented as temporal sequences', output: 'Bounded weight matrix W(t) ∈ [0, w_max]', timescale: 's' },
    { index: 3, title: 'Recall probe and network analytics', tier: 'Tier 5', coupling: 'MECHANISTIC', modelIds: [], entityIds: ['ANALYTIC-016', 'ANALYTIC-017', 'ANALYTIC-009'], input: 'Partial cue (first 25% of each sequence), learned weights', output: 'Recall fraction, directed strength, clustering of strong synapses', timescale: 'ms' },
    { index: 4, title: 'Functional context', tier: 'Tier 1', coupling: 'CONCEPTUAL', modelIds: [], entityIds: ['ANAT-HIPPOCAMPUS-CA3', 'COG-MEMORY-ENC-RET'], input: 'Before versus after training', output: 'Scoped interpretation as pattern completion', timescale: 'interpretive' },
  ],
  validationBoundary: 'Verifies that weights stay inside [0, w_max] and that the asymmetric window produces directed connectivity (Bi & Poo 1998). Pattern completion here is a network property of a toy model; it is not evidence about biological episodic memory. Unbounded Hebbian growth is prevented only by the hard bounds: no homeostatic scaling (Turrigiano 2008) is included.',
  limitations: [
    'Fixed network: 400 excitatory and 100 inhibitory leaky integrate-and-fire neurons, E→E probability 0.25, delta synapses with 1.5 ms delay, w_max = 6 mV, initial weight 0.15 w_max.',
    'Training forces each cue neuron to spike at its sequence position; spontaneous replay, theta rhythm and neuromodulation are absent.',
    'Additive STDP with hard bounds; only excitatory-to-excitatory synapses are plastic.',
    'Simulated training lasts seconds and uses 100 ms between cue presentations, far faster than behavioural learning.',
  ],
  references: ['REF-BI-POO-1998', 'REF-SQUIRE-2004', 'REF-TURRIGIANO-2008'],
  provenance: 'SYNTHETIC_SIMULATION',
  run(values, seed, onProgress): TwinResult {
    const p = reader(PARAMS, values);
    const rule: Rule = { Ap: p('A_plus'), Am: p('A_minus'), tp: p('tau_plus'), tm: p('tau_minus') };
    const net = buildNet(seed, Math.round(p('overlap'))), order = orderOf(net);
    onProgress?.(0.02, 'Stage 3: recall probe before training');
    const before = recallProbe(net, seed + 1, order);
    const baseline = conditionOutput(net, before, null);
    // Training schedule: groups take turns every 100 ms; within a presentation neurons fire in sequence order.
    const trainMs = 1000 * p('train_s'), sweep = p('sweep_ms'), forced = new Map<number, number[]>();
    let k = 0;
    for (let t0 = 50; t0 + sweep < trainMs; t0 += NET.cueEvery, k++) {
      const g = net.groups[k % net.groups.length]!;
      g.forEach((n, q) => { const st = Math.round((t0 + (q / g.length) * sweep) / NET.dt); (forced.get(st) ?? forced.set(st, []).get(st)!).push(n); });
    }
    const tr = simulate(net, trainMs, forced, rule, seed + 2, order, (f) => onProgress?.(0.05 + 0.85 * f, 'Stage 2: training with STDP'));
    onProgress?.(0.92, 'Stage 3: recall probe after training');
    const after = recallProbe(net, seed + 1, order);
    const intervention = conditionOutput(net, after, tr);
    baseline.curves.w_forward = { x: Float64Array.of(0, trainMs / 1000), y: Float64Array.of(NET.w0 * NET.wMax, NET.w0 * NET.wMax) };
    baseline.curves.w_backward = { x: Float64Array.of(0, trainMs / 1000), y: Float64Array.of(NET.w0 * NET.wMax, NET.w0 * NET.wMax) };
    const b = baseline.metrics, a = intervention.metrics;
    const cmp = (key: string, label: string, unit: string, description: string, analyticId?: string, digits = 3) => ({ key, label, unit, baseline: b[key]!, intervention: a[key]!, description, digits, ...(analyticId ? { analyticId } : {}) });
    const comparisons = [
      cmp('recallMean', 'Pattern completion', '', 'Mean fraction of non-cued group neurons recalled by a partial cue.', 'ANALYTIC-009'),
      cmp('spuriousMean', 'Spurious activation', '', 'Mean fraction of neurons outside the probed group that fire during the recall window; low values mean the recall is specific.', 'ANALYTIC-009'),
      cmp('forwardWeight', 'Forward weight', 'mV', 'Mean within-group weight along the trained sequence.'),
      cmp('backwardWeight', 'Backward weight', 'mV', 'Mean within-group weight against the trained sequence.'),
      cmp('directionality', 'Directionality index', '', '(forward − backward) / (forward + backward): 0 for a symmetric network.', 'ANALYTIC-016'),
      cmp('asymmetry', 'Reciprocal-pair asymmetry', '', 'Mean |w_ij − w_ji| / (w_ij + w_ji) over reciprocally connected pairs.', 'ANALYTIC-016'),
      cmp('clustering', 'Clustering of strong synapses', '', 'Clustering coefficient of the graph of synapses above half of w_max.', 'ANALYTIC-017'),
      cmp('strongSynapses', 'Strong synapses (≥ 0.5 w_max)', '', 'Number of synapses above half of the maximum weight.', undefined, 0),
      cmp('weightMax', 'Largest weight', 'mV', 'Must not exceed w_max = 6 mV (bounded-weight check).'),
    ];
    const summaries = [
      `Window: A₊ = ${rule.Ap}, τ₊ = ${rule.tp} ms; A₋ = ${rule.Am}, τ₋ = ${rule.tm} ms (integral ${(rule.Ap * rule.tp - rule.Am * rule.tm).toFixed(3)} ms: ${rule.Ap * rule.tp < rule.Am * rule.tm ? 'depression-dominated for uncorrelated firing' : 'potentiation-dominated'}).`,
      `${k} sequence presentations over ${p('train_s')} s: forward weight ${b.forwardWeight!.toFixed(2)} → ${a.forwardWeight!.toFixed(2)} mV, backward ${b.backwardWeight!.toFixed(2)} → ${a.backwardWeight!.toFixed(2)} mV; all weights stayed within [${a.weightMin!.toFixed(2)}, ${a.weightMax!.toFixed(2)}] mV.`,
      `A 25% cue recalled ${(100 * b.recallMean!).toFixed(0)}% of the remaining group before training and ${(100 * a.recallMean!).toFixed(0)}% after (spurious activation outside the group ${(100 * a.spuriousMean!).toFixed(0)}%); directionality index ${a.directionality!.toFixed(2)}.`,
      'Interpretation is limited to sequence learning in a toy recurrent network; the hippocampal anchor is conceptual.',
    ];
    onProgress?.(1, 'Done');
    return { experimentId: 'EXP-041', conditions: { baseline, intervention }, comparisons, stages: TWIN_PLASTICITY.stages.map((s, q) => ({ ...s, summary: summaries[q]! })), notes: ['Baseline = the untrained network; intervention = the same network after STDP training. The recall probe uses identical cue timing and noise in both.'] };
  },
};
