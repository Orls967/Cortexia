// MODEL-028 connectome graph diffusion and structural-to-functional prediction.
// Specification: docs/06-computational-models/NETWORK_MODELS.md. Every coupling matrix used here is
// SYNTHETIC_TOPOLOGY: no measured connectome is bundled with the application.
import {
  clusteringCoefficient, connectedComponents, distanceMatrix, lesionCurve, lesionOrder, louvain, pathMetrics, removeNodes, smallWorldness,
  type LesionStrategy,
} from '../analytics/graph';
import { finishRecorder, linspace, makeRecorder, paramReader, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import type { ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';
import { invertMatrix } from '../solvers/ode';
import { generateGraph, normalizeAdjacency, syntheticConnectome68, type GeneratedGraph } from './graphs';

const CONN_PARAMS: ParamSpec[] = [
  { key: 'G_Connectome', label: 'Global coupling gain', symbol: 'G', unit: '', default: 0.65, min: 0, max: 0.99, step: 0.01, registryId: 'PARAM-082', description: 'Scales how strongly each region is driven by its neighbours. The network is stable for G below 1 because the normalized coupling matrix has spectral radius 1.', group: 'Dynamics' },
  { key: 'sigma_Connectome', label: 'Regional noise amplitude', symbol: '\\sigma', unit: '', default: 0.1, min: 0.001, max: 1, step: 0.005, registryId: 'PARAM-084', description: 'Amplitude of the independent background noise driving every region.', group: 'Dynamics' },
  { key: 'tau_x', label: 'Regional decay time', symbol: '\\tau_x', unit: 'ms', default: 20, min: 2, max: 200, step: 1, description: 'Time constant with which an isolated region relaxes to baseline.', group: 'Dynamics' },
  { key: 'graph', label: 'Structural graph', symbol: 'W', unit: '', default: 0, min: 0, max: 5, step: 1, integer: true, description: 'Coupling topology. Every option is algorithmically generated (SYNTHETIC_TOPOLOGY), not a measured connectome.', group: 'Network', options: [
    { value: 0, label: 'Synthetic 68-region graph (Desikan–Killiany labels)' }, { value: 1, label: 'Ring lattice (k = 4)' }, { value: 2, label: 'Watts–Strogatz small world (k = 6, p = 0.1)' },
    { value: 3, label: 'Erdős–Rényi random (p = 0.1)' }, { value: 4, label: 'Barabási–Albert scale-free (m = 3)' }, { value: 5, label: 'Modular stochastic block model (4 modules)' },
  ] },
  { key: 'N_nodes', label: 'Number of regions', symbol: 'N', unit: '', default: 68, min: 10, max: 180, step: 1, integer: true, description: 'Node count of the generated topologies (the 68-region graph always has 68 nodes).', group: 'Network' },
  { key: 'graph_seed', label: 'Graph seed', symbol: '', unit: '', default: 1, min: 1, max: 9999, step: 1, integer: true, description: 'Seed of the graph generator, independent of the noise seed so the same network can be re-run with different noise.', group: 'Network' },
  { key: 'delays', label: 'Conduction delays', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Instantaneous coupling, or delays equal to inter-regional distance divided by conduction velocity (68-region graph only).', group: 'Conduction', options: [{ value: 0, label: 'Instantaneous coupling' }, { value: 1, label: 'Distance / velocity delays' }] },
  { key: 'v_cond_Connectome', label: 'Conduction velocity', symbol: 'v', unit: 'm/s', default: 6, min: 1, max: 30, step: 0.5, registryId: 'PARAM-083', description: 'Axonal conduction velocity used to convert distances into delays when delays are enabled.', group: 'Conduction' },
  { key: 'lesion', label: 'Lesion strategy', symbol: '', unit: '', default: 0, min: 0, max: 3, step: 1, integer: true, description: 'Which regions are removed before the simulation.', group: 'Lesion', options: [{ value: 0, label: 'Intact network' }, { value: 1, label: 'Random regions' }, { value: 2, label: 'Targeted: highest strength first' }, { value: 3, label: 'Targeted: highest betweenness first' }] },
  { key: 'lesion_fraction', label: 'Lesioned fraction', symbol: 'f', unit: '', default: 0.1, min: 0, max: 0.5, step: 0.01, description: 'Fraction of regions removed by the selected lesion strategy.', group: 'Lesion' },
];

/** Pearson correlation of the upper triangles of two symmetric matrices, restricted to node pairs that are both alive. */
export function upperTriangleCorrelation(a: Float64Array, b: Float64Array, n: number, alive?: Uint8Array): number {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, m = 0;
  for (let i = 0; i < n; i++) {
    if (alive && !alive[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (alive && !alive[j]) continue;
      const x = a[i * n + j]!, y = b[i * n + j]!;
      sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; m++;
    }
  }
  if (m < 2) return NaN;
  const cov = sab - (sa * sb) / m, va = saa - (sa * sa) / m, vb = sbb - (sb * sb) / m;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : NaN;
}

function correlationFromCovariance(c: Float64Array, n: number, alive: Uint8Array): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    for (let j = 0; j < n; j++) {
      if (!alive[j]) continue;
      const d = Math.sqrt(c[i * n + i]! * c[j * n + j]!);
      out[i * n + j] = d > 0 ? c[i * n + j]! / d : 0;
    }
  }
  return out;
}

export interface ConnectomeTheory {
  /** Stationary covariance of the Ornstein–Uhlenbeck network (Lyapunov solution for symmetric coupling). */
  covOu: Float64Array;
  /** Covariance of the spatial autoregressive model x = G W̃ x + σ ε. */
  covSar: Float64Array;
  /** max |A C + C Aᵀ − (σ²/τ_x) I|, a direct check of the Lyapunov equation. */
  lyapunovResidual: number;
}

/**
 * Closed-form covariances for the normalized coupling matrix W̃. With A = I − G W̃ and symmetric W̃, the OU system
 * τ_x dx = −A x dt + σ dW has stationary covariance C = σ² / (2 τ_x) · A⁻¹; the SAR model gives σ² A⁻¹ A⁻ᵀ.
 */
export function connectomeTheory(wn: Float64Array, n: number, G: number, sigma: number, tauX: number): ConnectomeTheory {
  const A = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i * n + j] = (i === j ? 1 : 0) - G * wn[i * n + j]!;
  const inv = invertMatrix(A, n);
  const covOu = Float64Array.from(inv, (v) => (sigma * sigma * v) / (2 * tauX));
  const covSar = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += inv[i * n + k]! * inv[j * n + k]!;
    covSar[i * n + j] = sigma * sigma * s; covSar[j * n + i] = sigma * sigma * s;
  }
  let res = 0;
  const q = (sigma * sigma) / tauX;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += A[i * n + k]! * covOu[k * n + j]! + covOu[i * n + k]! * A[j * n + k]!;
    res = Math.max(res, Math.abs(s - (i === j ? q : 0)));
  }
  return { covOu, covSar, lyapunovResidual: res };
}

function buildGraph(kind: number, nNodes: number, seed: number): GeneratedGraph {
  return kind === 0 ? syntheticConnectome68(seed) : generateGraph(kind, nNodes, seed);
}

function runConnectome(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(CONN_PARAMS, cfg.params);
  const G = p('G_Connectome'), sigma = p('sigma_Connectome'), tauX = p('tau_x'), kind = Math.round(p('graph'));
  const wantDelays = Math.round(p('delays')) === 1, v = p('v_cond_Connectome'), lesion = Math.round(p('lesion')), frac = p('lesion_fraction');
  if (!(G >= 0 && G < 1)) throw new SimulationError('ERR_INVALID_PARAMS', 'The global coupling gain must satisfy 0 ≤ G < 1 for a stable network.');
  const g = buildGraph(kind, Math.round(p('N_nodes')), Math.round(p('graph_seed')));
  const n = g.n;
  if (n > 180) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'MODEL-028 is limited to 180 regions in the browser.');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;

  // Lesion: remove a fraction of the regions before simulating.
  const strategy: LesionStrategy | null = lesion === 1 ? 'random' : lesion === 2 ? 'degree' : lesion === 3 ? 'betweenness' : null;
  const adaptive = n <= 100;
  const nRemove = strategy ? Math.min(n - 2, Math.round(frac * n)) : 0;
  const removed = strategy && nRemove > 0 ? lesionOrder(g.weights, n, strategy, cfg.seed, strategy !== 'betweenness' || adaptive).subarray(0, nRemove) : new Int32Array(0);
  const alive = new Uint8Array(n).fill(1);
  for (let q = 0; q < removed.length; q++) alive[removed[q]!] = 0;
  const W = removed.length ? removeNodes(g.weights, n, removed) : g.weights;
  const wn = normalizeAdjacency(W, n);
  const theory = connectomeTheory(wn, n, G, sigma, tauX);

  // Sparse rows of the normalized coupling matrix.
  const rowPtr = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) { let c = 0; for (let j = 0; j < n; j++) if (wn[i * n + j] !== 0) c++; rowPtr[i + 1] = rowPtr[i]! + c; }
  const nnz = rowPtr[n]!;
  const colIdx = new Uint32Array(nnz), vals = new Float64Array(nnz);
  for (let i = 0, q = 0; i < n; i++) for (let j = 0; j < n; j++) if (wn[i * n + j] !== 0) { colIdx[q] = j; vals[q++] = wn[i * n + j]!; }

  const delays = wantDelays && !!g.distances;
  let dSteps: Int32Array | null = null, K = 1, maxDelayMs = 0;
  if (delays) {
    dSteps = new Int32Array(nnz);
    let mx = 0;
    for (let i = 0; i < n; i++) for (let q = rowPtr[i]!; q < rowPtr[i + 1]!; q++) {
      const ms = g.distances![i * n + colIdx[q]!]! / v; // mm / (m/s) = ms
      const s = Math.round(ms / dt);
      dSteps[q] = s;
      if (s > mx) mx = s;
      if (ms > maxDelayMs) maxDelayMs = ms;
    }
    K = mx + 1;
  }
  const hist = delays ? new Float64Array(K * n) : null;
  const rk4 = cfg.solver === 'SOLVER-RK4' && !delays;
  if (cfg.solver !== 'SOLVER-RK4' && cfg.solver !== 'SOLVER-EULER-MARUYAMA') throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by MODEL-028.`);

  const x = new Float64Array(n), k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
  const drift = (src: Float64Array, d: Float64Array) => {
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let q = rowPtr[i]!, e = rowPtr[i + 1]!; q < e; q++) c += vals[q]! * src[colIdx[q]!]!;
      d[i] = (-src[i]! + G * c) / tauX;
    }
  };
  const rng = new Rng(cfg.seed);
  const kick = (sigma / tauX) * Math.sqrt(dt);
  const slowest = tauX / (1 - G);
  const transient = Math.min(nSteps >> 2, Math.round((5 * slowest) / dt));
  const sampleEvery = Math.max(1, Math.round(2 / dt));
  const sum = new Float64Array(n), prod = new Float64Array(n * n);
  let samples = 0;
  // Example traces: the strongest and the weakest surviving region.
  let hub = -1, low = -1, hubS = -Infinity, lowS = Infinity, nAlive = 0;
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    nAlive++;
    let s = 0;
    for (let j = 0; j < n; j++) s += W[i * n + j]!;
    if (s > hubS) { hubS = s; hub = i; }
    if (s < lowS) { lowS = s; low = i; }
  }
  const rec = makeRecorder(['x_hub', 'x_peripheral', 'x_mean'], nSteps);
  const frames = Math.min(300, nSteps + 1), frameStride = Math.max(1, Math.floor(nSteps / Math.max(1, frames - 1)));
  const activity = new Float64Array(n * frames);
  let frame = 0;
  const snap = (j: number, t: number) => {
    let m = 0;
    for (let i = 0; i < n; i++) if (alive[i]) m += x[i]!;
    rec.t[j] = t; rec.s.x_hub![j] = x[hub]!; rec.s.x_peripheral![j] = x[low]!; rec.s.x_mean![j] = m / nAlive; rec.written = j + 1;
  };
  snap(0, 0);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  for (let s = 0; s < nSteps; s++) {
    if (hist && dSteps) {
      hist.set(x, (s % K) * n);
      for (let i = 0; i < n; i++) {
        let c = 0;
        for (let q = rowPtr[i]!, e = rowPtr[i + 1]!; q < e; q++) c += vals[q]! * hist[((((s - dSteps[q]!) % K) + K) % K) * n + colIdx[q]!]!;
        k1[i] = (-x[i]! + G * c) / tauX;
      }
      for (let i = 0; i < n; i++) x[i] = x[i]! + dt * k1[i]!;
    } else if (rk4) {
      drift(x, k1);
      for (let i = 0; i < n; i++) tmp[i] = x[i]! + 0.5 * dt * k1[i]!;
      drift(tmp, k2);
      for (let i = 0; i < n; i++) tmp[i] = x[i]! + 0.5 * dt * k2[i]!;
      drift(tmp, k3);
      for (let i = 0; i < n; i++) tmp[i] = x[i]! + dt * k3[i]!;
      drift(tmp, k4);
      for (let i = 0; i < n; i++) x[i] = x[i]! + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
    } else {
      drift(x, k1);
      for (let i = 0; i < n; i++) x[i] = x[i]! + dt * k1[i]!;
    }
    // Additive noise increment (Euler–Maruyama for the stochastic term in every solver mode).
    for (let i = 0; i < n; i++) x[i] = x[i]! + kick * rng.normal();
    if (!Number.isFinite(x[hub]!) || Math.abs(x[hub]!) > 1e4) { status = 'DIVERGED'; failedAtMs = (s + 1) * dt; break; }
    const k = s + 1;
    if (k >= transient && k % sampleEvery === 0) {
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const xi = x[i]!;
        sum[i] = sum[i]! + xi;
        const row = i * n;
        for (let j = 0; j <= i; j++) prod[row + j] = prod[row + j]! + xi * x[j]!;
      }
      samples++;
    }
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) snap(j, k * dt); }
    if (k % frameStride === 0 && frame < frames) { for (let i = 0; i < n; i++) activity[i * frames + frame] = alive[i] ? x[i]! : 0; frame++; }
    if (ctx?.onProgress && k % 1000 === 0) ctx.onProgress((0.8 * k) / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push('ERR_NUMERICAL_DIVERGENCE: regional activity became non-finite. Reduce dt or the coupling gain.'); }

  // Simulated functional connectivity (Pearson correlation of regional activity).
  const covSim = new Float64Array(n * n);
  if (samples > 1) {
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      const c = alive[i] && alive[j] ? prod[i * n + j]! / samples - (sum[i]! / samples) * (sum[j]! / samples) : 0;
      covSim[i * n + j] = c; covSim[j * n + i] = c;
    }
  }
  const fcSim = correlationFromCovariance(covSim, n, alive), fcOu = correlationFromCovariance(theory.covOu, n, alive), fcSar = correlationFromCovariance(theory.covSar, n, alive);
  const labels = g.labels ?? Array.from({ length: n }, (_, i) => `Node ${i + 1}`);
  const mat = (data: Float64Array) => ({ rows: n, cols: n, data, rowLabels: labels, colLabels: labels });
  out.matrices.SC = mat(Float64Array.from(W));
  out.matrices.FC_sim = mat(fcSim);
  out.matrices.FC_theory = mat(fcOu);
  out.matrices.FC_sar = mat(fcSar);
  const cols = frame;
  out.matrices.activity = { rows: n, cols, data: cols === frames ? activity : Float64Array.from({ length: n * cols }, (_, q) => activity[Math.floor(q / cols) * frames + (q % cols)]!), rowLabels: labels };

  const sx: number[] = [], sy: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (alive[i] && alive[j] && W[i * n + j] !== 0) { sx.push(W[i * n + j]!); sy.push(fcSim[i * n + j]!); }
  out.curves.sc_fc = { x: Float64Array.from(sx), y: Float64Array.from(sy) };
  ctx?.onProgress?.(0.85);

  // Topology of the intact graph (binary, undirected) and lesion robustness curves.
  const intact = g.weights;
  const pathIntact = pathMetrics(distanceMatrix(intact, n), n);
  const sw = smallWorldness(intact, n, 1, 20);
  const com = louvain(intact, n, 1);
  const fr = linspace(0, 0.8, 17);
  const reps = 8;
  const randEff = new Float64Array(fr.length), randLcc = new Float64Array(fr.length);
  for (let r = 0; r < reps; r++) {
    const c = lesionCurve(intact, n, lesionOrder(intact, n, 'random', 1000 + r), fr);
    for (let q = 0; q < fr.length; q++) { randEff[q] = randEff[q]! + c.efficiency[q]! / reps; randLcc[q] = randLcc[q]! + c.lcc[q]! / reps; }
  }
  const deg = lesionCurve(intact, n, lesionOrder(intact, n, 'degree'), fr);
  const btw = lesionCurve(intact, n, lesionOrder(intact, n, 'betweenness', 1, adaptive), fr);
  out.curves.lesion_random = { x: Float64Array.from(fr), y: randEff };
  out.curves.lesion_strength = { x: Float64Array.from(fr), y: deg.efficiency };
  out.curves.lesion_betweenness = { x: Float64Array.from(fr), y: btw.efficiency };
  out.curves.lcc_random = { x: Float64Array.from(fr), y: randLcc };
  out.curves.lcc_strength = { x: Float64Array.from(fr), y: deg.lcc };
  out.curves.lcc_betweenness = { x: Float64Array.from(fr), y: btw.lcc };
  const at = (c: Float64Array, f: number) => c[Math.round(f / 0.05)] ?? NaN;

  const effLesioned = removed.length ? pathMetrics(distanceMatrix(W, n, false, alive), n, alive).globalEfficiency / pathIntact.globalEfficiency : 1;
  out.metrics.scFcCorrelation = upperTriangleCorrelation(W, fcSim, n, alive);
  out.metrics.scFcTheoryCorrelation = upperTriangleCorrelation(W, fcOu, n, alive);
  out.metrics.fcTheoryCorrelation = upperTriangleCorrelation(fcSim, fcOu, n, alive);
  out.metrics.fcSarCorrelation = upperTriangleCorrelation(fcSim, fcSar, n, alive);
  out.metrics.sarVsOuCorrelation = upperTriangleCorrelation(fcSar, fcOu, n, alive);
  out.metrics.lyapunovResidual = theory.lyapunovResidual;
  out.metrics.slowestModeMs = slowest;
  out.metrics.nodes = n;
  out.metrics.clustering = clusteringCoefficient(intact, n).mean;
  out.metrics.pathLength = pathIntact.charPathLength;
  out.metrics.globalEfficiency = pathIntact.globalEfficiency;
  out.metrics.modularity = com.q;
  out.metrics.communities = com.count;
  out.metrics.smallWorldSigma = sw.sigma;
  out.metrics.lesionedNodes = removed.length;
  out.metrics.lesionEfficiencyRatio = effLesioned;
  out.metrics.lesionLcc = connectedComponents(W, n, alive).largest / n;
  out.metrics.efficiencyAt20Random = at(randEff, 0.2);
  out.metrics.efficiencyAt20Targeted = at(btw.efficiency, 0.2);
  out.metrics.fcSamples = samples;

  out.notes.push(`Coupling graph provenance: ${g.provenance} — ${g.description}.`);
  out.notes.push(`Simulated FC vs the closed-form Ornstein–Uhlenbeck prediction: r = ${out.metrics.fcTheoryCorrelation.toFixed(3)} over ${samples.toLocaleString()} samples${delays ? ' (the closed form assumes instantaneous coupling, so delays lower the agreement)' : ''}. Structure–function correlation: simulated r(SC, FC) = ${out.metrics.scFcCorrelation.toFixed(3)}, noise-free prediction ${out.metrics.scFcTheoryCorrelation.toFixed(3)}.`);
  if (!delays && out.metrics.fcTheoryCorrelation < 0.9) out.notes.push('Pairwise correlations are weak at this coupling gain, so finite-sample noise limits how closely a simulated FC matrix can match the prediction; a longer run or a larger G raises the agreement.');
  out.notes.push('Functional connectivity is a statistical dependency between regional signals; it does not establish a direct anatomical connection or a causal direction.');
  if (delays) out.notes.push(`Conduction delays up to ${maxDelayMs.toFixed(1)} ms (distance / ${v} m/s) were applied with first-order Euler–Maruyama integration.`);
  if (wantDelays && !delays) out.notes.push('Delays were ignored: only the 68-region graph carries a spatial layout from which distances can be derived.');
  if (removed.length) out.notes.push(`${removed.length} of ${n} regions were removed (${strategy === 'random' ? 'random' : strategy === 'degree' ? 'highest strength first' : 'highest betweenness first'}); global efficiency among the surviving regions is ${(100 * effLesioned).toFixed(1)}% of the intact value and the largest connected component holds ${(100 * out.metrics.lesionLcc).toFixed(0)}% of all regions.`);
  const gap = out.metrics.efficiencyAt20Random - out.metrics.efficiencyAt20Targeted;
  out.notes.push(`Robustness: after removing 20% of regions the survivors keep ${(100 * out.metrics.efficiencyAt20Random).toFixed(0)}% of global efficiency for random lesions and ${(100 * out.metrics.efficiencyAt20Targeted).toFixed(0)}% for betweenness-targeted lesions. ${gap > 0.15 ? 'This topology depends on a few hubs: targeted attack is far more damaging than random failure.' : 'Degrees are fairly homogeneous in this topology, so targeted and random lesions differ only modestly; the scale-free graph shows the classic hub vulnerability.'}`);
  ctx?.onProgress?.(1);
  return out;
}

export const MODEL_028: ModelDefinition = {
  id: 'MODEL-028',
  name: 'Connectome Graph Diffusion',
  equations: [
    '\\tilde{\\mathbf{W}} = \\mathbf{D}^{-1/2}\\,\\mathbf{W}\\,\\mathbf{D}^{-1/2}, \\qquad \\mathbf{L} = \\mathbf{I} - \\tilde{\\mathbf{W}}, \\qquad D_{ii} = \\sum_j W_{ij}',
    '\\tau_x \\frac{d\\mathbf{x}}{dt} = -\\left(\\mathbf{I} - G\\,\\tilde{\\mathbf{W}}\\right)\\mathbf{x}(t) + \\sigma\\,\\boldsymbol{\\xi}(t)',
    '\\mathbf{C}_{OU} = \\frac{\\sigma^2}{2\\tau_x}\\left(\\mathbf{I} - G\\,\\tilde{\\mathbf{W}}\\right)^{-1} \\quad (\\tilde{\\mathbf{W}} \\text{ symmetric}), \\qquad \\mathbf{C}_{SAR} = \\sigma^2 \\left(\\mathbf{I} - G\\tilde{\\mathbf{W}}\\right)^{-1}\\left(\\mathbf{I} - G\\tilde{\\mathbf{W}}^\\top\\right)^{-1}',
    '\\mathrm{FC}_{ij} = \\frac{C_{ij}}{\\sqrt{C_{ii}\\,C_{jj}}}',
  ],
  params: CONN_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-RK4', 'SOLVER-EULER-MARUYAMA'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 0.5, minDtMs: 0.1, maxSafeDtMs: 2, defaultDurationMs: 20000, maxDurationMs: 30000,
  stochastic: true,
  views: [
    { kind: 'matrix', title: 'Structural connectivity W (synthetic)', key: 'SC', xLabel: 'source region', yLabel: 'target region', meaning: 'Coupling weights of the generated structural graph. Synthetic topology, not a measured connectome.' },
    { kind: 'matrix', title: 'Simulated functional connectivity', key: 'FC_sim', xLabel: 'region', yLabel: 'region', diverging: true, meaning: 'Pearson correlation between the simulated activity of every pair of regions.' },
    { kind: 'matrix', title: 'Predicted functional connectivity (closed form)', key: 'FC_theory', xLabel: 'region', yLabel: 'region', diverging: true, meaning: 'Correlation matrix from the stationary covariance of the linear network, computed without simulation.' },
    { kind: 'curve', title: 'Structure–function relation', xLabel: 'structural weight W_ij', yLabel: 'simulated FC_ij', meaning: 'Functional correlation of every structurally connected pair against its coupling weight.', curves: [{ key: 'sc_fc', label: 'connected pairs', points: true }] },
    { kind: 'curve', title: 'Lesion robustness: global efficiency', xLabel: 'fraction of regions removed', yLabel: 'E_glob(f) / E_glob(0)', meaning: 'Global efficiency among the surviving regions as regions are removed at random or in order of strength or betweenness.', curves: [{ key: 'lesion_random', label: 'Random (mean of 8)' }, { key: 'lesion_strength', label: 'Targeted: strength' }, { key: 'lesion_betweenness', label: 'Targeted: betweenness', dashed: true }] },
    { kind: 'curve', title: 'Lesion robustness: largest connected component', xLabel: 'fraction of regions removed', yLabel: 'LCC / N', meaning: 'Share of regions that remain mutually reachable as regions are removed.', curves: [{ key: 'lcc_random', label: 'Random (mean of 8)' }, { key: 'lcc_strength', label: 'Targeted: strength' }, { key: 'lcc_betweenness', label: 'Targeted: betweenness', dashed: true }] },
    { kind: 'traces', title: 'Regional activity', yLabel: 'x (a.u.)', series: [
      { key: 'x_hub', label: 'strongest region', unit: '', meaning: 'Activity of the region with the largest total structural weight.' },
      { key: 'x_peripheral', label: 'weakest region', unit: '', meaning: 'Activity of the region with the smallest total structural weight.' },
      { key: 'x_mean', label: 'network mean', unit: '', meaning: 'Activity averaged over all surviving regions.', dashed: true },
    ] },
    { kind: 'matrix', title: 'Activity of all regions over time', key: 'activity', xLabel: 'time →', yLabel: 'region', diverging: true, meaning: 'Activity of every region across the run; correlated bands indicate functionally coupled regions.' },
  ],
  metrics: [
    { key: 'scFcCorrelation', label: 'SC–FC correlation', unit: '', description: 'Pearson correlation between structural weights and simulated functional correlations over all region pairs.', analyticId: 'ANALYTIC-021', digits: 3 },
    { key: 'fcTheoryCorrelation', label: 'Simulated vs predicted FC', unit: '', description: 'Agreement between simulated FC and the closed-form Ornstein–Uhlenbeck prediction.', analyticId: 'ANALYTIC-021', digits: 3 },
    { key: 'fcSarCorrelation', label: 'Simulated vs SAR-model FC', unit: '', description: 'Agreement between simulated FC and the spatial-autoregressive formula.', analyticId: 'ANALYTIC-021', digits: 3 },
    { key: 'globalEfficiency', label: 'Global efficiency', unit: '', description: 'Mean inverse shortest path length of the intact graph (binary).', analyticId: 'ANALYTIC-018', digits: 3 },
    { key: 'clustering', label: 'Clustering coefficient', unit: '', description: 'Mean local clustering of the intact graph (binary).', analyticId: 'ANALYTIC-017', digits: 3 },
    { key: 'pathLength', label: 'Characteristic path length', unit: 'steps', description: 'Mean shortest path of the intact graph (binary).', analyticId: 'ANALYTIC-018', digits: 3 },
    { key: 'modularity', label: 'Modularity Q', unit: '', description: 'Newman–Girvan modularity of the Louvain partition of the intact graph.', analyticId: 'ANALYTIC-019', digits: 3 },
    { key: 'smallWorldSigma', label: 'Small-worldness σ', unit: '', description: 'Clustering and path length relative to 20 degree-preserving random graphs; above 1 indicates small-world organization.', analyticId: 'ANALYTIC-018', digits: 3 },
    { key: 'lesionEfficiencyRatio', label: 'Efficiency after lesion', unit: '', description: 'Global efficiency among the surviving regions of the simulated network, relative to the intact graph.', analyticId: 'ANALYTIC-019', digits: 3 },
    { key: 'efficiencyAt20Random', label: 'Efficiency at 20% random loss', unit: '', description: 'Relative global efficiency after removing 20% of regions at random (mean of 8 orders).', analyticId: 'ANALYTIC-019', digits: 3 },
    { key: 'efficiencyAt20Targeted', label: 'Efficiency at 20% targeted loss', unit: '', description: 'Relative global efficiency after removing the 20% of regions with the highest betweenness.', analyticId: 'ANALYTIC-019', digits: 3 },
    { key: 'lesionLcc', label: 'Largest component after lesion', unit: '', description: 'Fraction of regions in the largest connected component of the simulated network.', analyticId: 'ANALYTIC-019', digits: 3 },
    { key: 'slowestModeMs', label: 'Slowest mode', unit: 'ms', description: 'Relaxation time of the slowest network mode, τ_x / (1 − G).' },
  ],
  presets: [
    { id: 'intact', label: 'Intact synthetic connectome', description: 'Simulated FC follows the closed-form prediction and correlates with structure.', experimentId: 'EXP-038' },
    { id: 'hub', label: 'Targeted hub lesion (15%)', description: 'Removing the highest-betweenness regions degrades efficiency sharply.', params: { lesion: 3, lesion_fraction: 0.15 }, experimentId: 'EXP-038' },
    { id: 'random', label: 'Random lesion (15%)', description: 'Removing the same number of random regions has a much smaller effect.', params: { lesion: 1, lesion_fraction: 0.15 }, experimentId: 'EXP-038' },
    { id: 'strong', label: 'Strong coupling (G = 0.9)', description: 'Near the stability limit correlations are large and the simulated FC matches the prediction closely.', params: { G_Connectome: 0.9 }, durationMs: 30000 },
    { id: 'delays', label: 'Conduction delays (v = 6 m/s)', description: 'Distance-dependent delays reduce zero-lag correlations.', params: { delays: 1 }, durationMs: 10000 },
    { id: 'smallworld', label: 'Small-world topology', description: 'Watts–Strogatz graph: high clustering with short paths.', params: { graph: 2, N_nodes: 100 } },
    { id: 'scalefree', label: 'Scale-free graph: hub vulnerability', description: 'Barabási–Albert graph with its highest-betweenness hubs removed: efficiency collapses, unlike under random failure.', params: { graph: 4, N_nodes: 100, lesion: 3, lesion_fraction: 0.15 } },
  ],
  sweep: { paramKey: 'G_Connectome', from: 0.1, to: 0.95, steps: 10, metricKey: 'scFcCorrelation', experimentId: 'EXP-038' },
  kernelLimitations: [
    'Linear noise-driven regional dynamics: no oscillations, saturation or region-specific physiology.',
    'All coupling graphs are synthetic. The 68-region graph uses Desikan–Killiany labels with schematic coordinates and an exponential distance rule; it is not a measured connectome.',
    'The closed-form covariance C = σ²/(2τ_x)·(I − G W̃)⁻¹ holds for symmetric, instantaneous coupling. The formula (I − G W̃)⁻¹(I − G W̃ᵀ)⁻¹ quoted in the specification is the spatial-autoregressive model and is reported separately.',
    'Lesion robustness is computed on the binary graph: efficiency is evaluated among the surviving regions, and fragmentation is reported separately as the largest connected component.',
    'The synthetic 68-region graph has a fairly homogeneous degree distribution and does not reproduce the rich-club hub structure reported for measured human connectomes.',
    'With delays the closed-form prediction no longer applies and integration is first order.',
  ],
  run: runConnectome,
};
