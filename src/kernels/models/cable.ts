// MODEL-010 Passive dendritic cable and Rall multi-compartment model.
// Compartmental form: C_k dV_k/dt = -g_L,k (V_k - E_L) + Σ g_kj (V_j - V_k) + I_k(t).
// Each cylinder is parameterized by its length constant λ and semi-infinite input conductance G∞:
// membrane conductance per unit length = G∞/λ, axial conductance of a segment Δx = G∞ λ/Δx.
// A daughter of relative diameter ρ has λ_d = λ ρ^{1/2} and G∞,d = G∞ ρ^{3/2} (Rall 1962).
import { DIVERGENCE_NOTE } from '../core/odeRun';
import { diverged, makeRecorder, finishRecorder, maxOf, paramReader, stepCount } from '../core/record';
import { makeStimulus } from '../core/stimulus';
import type { ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';
import { luDecompose, luSolve } from '../solvers/ode';

const CABLE_PARAMS: ParamSpec[] = [
  { key: 'lambda_cable', label: 'Electrotonic length constant', symbol: '\\lambda', unit: 'µm', default: 250, min: 50, max: 1000, step: 5, registryId: 'PARAM-036', description: 'Distance over which a steady voltage decays to 1/e in an infinite cable.', group: 'Cable' },
  { key: 'N_comp_cable', label: 'Number of compartments', symbol: 'N', unit: '', default: 20, min: 3, max: 50, step: 1, integer: true, registryId: 'PARAM-037', description: 'Spatial discretization of the dendrite (browser cap: 50).', group: 'Cable' },
  { key: 'length_um', label: 'Parent cable length', symbol: '\\ell', unit: 'µm', default: 500, min: 50, max: 2000, step: 10, description: 'Physical length of the parent dendritic cylinder.', group: 'Cable' },
  { key: 'tau_m', label: 'Membrane time constant', symbol: '\\tau_m', unit: 'ms', default: 20, min: 2, max: 100, step: 0.5, description: 'Membrane time constant r_m c_m.', group: 'Membrane' },
  { key: 'R_inf', label: 'Semi-infinite input resistance', symbol: 'R_\\infty', unit: 'MΩ', default: 100, min: 10, max: 1000, step: 5, description: 'Input resistance the parent cylinder would have if it were infinitely long (1 / G∞).', group: 'Membrane' },
  { key: 'E_L', label: 'Leak reversal', symbol: 'E_L', unit: 'mV', default: -70, min: -85, max: -55, step: 0.5, description: 'Resting potential of the passive membrane.', group: 'Membrane' },
  { key: 'inject_frac', label: 'Injection site (fraction of parent length)', symbol: 'x_{inj}/\\ell', unit: '', default: 0, min: 0, max: 1, step: 0.05, description: '0 injects at the proximal (somatic) end, 1 at the distal end of the parent.', group: 'Input' },
  { key: 'input_mode', label: 'Input waveform', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Stimulus waveform, or an alpha-function synaptic current of the same peak amplitude.', group: 'Input', options: [{ value: 0, label: 'Stimulus waveform (electrode)' }, { value: 1, label: 'Alpha-function EPSC at stimulus onset' }] },
  { key: 'tau_alpha', label: 'EPSC time-to-peak', symbol: '\\tau_\\alpha', unit: 'ms', default: 1, min: 0.2, max: 10, step: 0.1, description: 'Time constant of the alpha-function synaptic current.', group: 'Input' },
  { key: 'branch_mode', label: 'Morphology', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Unbranched cylinder or a parent that splits into two identical daughters.', group: 'Branching', options: [{ value: 0, label: 'Unbranched cylinder' }, { value: 1, label: 'Parent with two daughter branches' }] },
  { key: 'daughter_ratio', label: 'Daughter / parent diameter ratio', symbol: '\\rho', unit: '', default: 0.63, min: 0.2, max: 1.2, step: 0.01, description: 'Rall 3/2 matching requires 2 ρ^{3/2} = 1, i.e. ρ ≈ 0.63.', group: 'Branching' },
  { key: 'daughter_L', label: 'Daughter electrotonic length', symbol: 'L_d', unit: 'λ_d', default: 1.0, min: 0.1, max: 3, step: 0.05, description: 'Length of each daughter in units of its own length constant.', group: 'Branching' },
];

interface CableGeometry {
  n: number;
  /** Electrotonic distance of each node from the proximal end. */
  X: Float64Array;
  /** Physical position along the main path (µm), NaN-free for the plotted path. */
  pathNodes: number[];
  cap: Float64Array;
  gLeak: Float64Array;
  edges: { i: number; j: number; g: number }[];
  injectNode: number;
  totalL: number;
  rallSum: number;
}

export function buildCable(p: (k: string) => number): CableGeometry {
  const lambda = p('lambda_cable'), ell = p('length_um'), tau = p('tau_m');
  const G = 1000 / p('R_inf'); // nS
  const branch = p('branch_mode') >= 0.5;
  const nTotal = Math.max(3, Math.min(50, Math.round(p('N_comp_cable'))));
  const rho = p('daughter_ratio'), Ld = p('daughter_L');
  const np = branch ? Math.max(3, Math.round(nTotal / 2)) : nTotal;
  const nd = branch ? Math.max(2, Math.floor((nTotal - np) / 2)) : 0;
  const n = np + 2 * nd;
  const gLeak = new Float64Array(n), cap = new Float64Array(n), X = new Float64Array(n);
  const edges: CableGeometry['edges'] = [];
  const dx = ell / (np - 1);
  // Parent: node-centred grid with half-length end nodes (sealed-end Neumann boundary).
  for (let k = 0; k < np; k++) {
    const len = k === 0 || k === np - 1 ? dx / 2 : dx;
    gLeak[k] = (G / lambda) * len;
    X[k] = (k * dx) / lambda;
    if (k > 0) edges.push({ i: k - 1, j: k, g: (G * lambda) / dx });
  }
  const pathNodes = Array.from({ length: np }, (_, k) => k);
  if (branch) {
    const lambdaD = lambda * Math.sqrt(rho), GD = G * Math.pow(rho, 1.5);
    const dxd = (Ld * lambdaD) / nd;
    for (let b = 0; b < 2; b++) {
      for (let k = 1; k <= nd; k++) {
        const idx = np + b * nd + (k - 1);
        const len = k === nd ? dxd / 2 : dxd;
        gLeak[idx] = (GD / lambdaD) * len;
        X[idx] = ell / lambda + (k * dxd) / lambdaD;
        edges.push({ i: k === 1 ? np - 1 : idx - 1, j: idx, g: (GD * lambdaD) / dxd });
        if (b === 0) pathNodes.push(idx);
      }
      // The branch-point node also carries half a daughter segment of membrane.
      gLeak[np - 1] = gLeak[np - 1]! + (GD / lambdaD) * (dxd / 2);
    }
  }
  for (let k = 0; k < n; k++) cap[k] = tau * gLeak[k]!;
  const injectNode = Math.min(np - 1, Math.max(0, Math.round(p('inject_frac') * (np - 1))));
  return { n, X, pathNodes, cap, gLeak, edges, injectNode, totalL: ell / lambda + (branch ? Ld : 0), rallSum: branch ? 2 * Math.pow(rho, 1.5) : 1 };
}

function runCable(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(CABLE_PARAMS, cfg.params);
  const geo = buildCable(p);
  const { n } = geo;
  const EL = p('E_L'), tauAlpha = p('tau_alpha'), alphaMode = p('input_mode') >= 0.5;
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const stim = makeStimulus(cfg.stimulus, dt, cfg.durationMs, cfg.seed);
  const onset = cfg.stimulus.startMs, amp = cfg.stimulus.amplitude;
  const current = (t: number) => {
    if (!alphaMode) return stim(t);
    const s = (t - onset) / tauAlpha;
    return s > 0 ? cfg.stimulus.baseline + amp * s * Math.exp(1 - s) : cfg.stimulus.baseline;
  };
  // M = C⁻¹ A acting on u = V − E_L.
  const M = new Float64Array(n * n);
  for (let k = 0; k < n; k++) M[k * n + k] = -geo.gLeak[k]! / geo.cap[k]!;
  for (const e of geo.edges) {
    M[e.i * n + e.i] = M[e.i * n + e.i]! - e.g / geo.cap[e.i]!;
    M[e.j * n + e.j] = M[e.j * n + e.j]! - e.g / geo.cap[e.j]!;
    M[e.i * n + e.j] = M[e.i * n + e.j]! + e.g / geo.cap[e.i]!;
    M[e.j * n + e.i] = M[e.j * n + e.i]! + e.g / geo.cap[e.j]!;
  }
  const u = new Float64Array(n).fill((cfg.initial.V_1 ?? EL) - EL);
  const rhs = new Float64Array(n), next = new Float64Array(n);
  const inj = geo.injectNode, cInj = geo.cap[inj]!;
  const mulAdd = (out: Float64Array, x: Float64Array, scale: number) => {
    for (let i = 0; i < n; i++) {
      let s = 0;
      const row = i * n;
      for (let j = 0; j < n; j++) s += M[row + j]! * x[j]!;
      out[i] = x[i]! + scale * s;
    }
  };
  let lu: ReturnType<typeof luDecompose> | null = null;
  if (cfg.solver === 'SOLVER-CRANK-NICOLSON') {
    const L = new Float64Array(n * n);
    for (let i = 0; i < n * n; i++) L[i] = -0.5 * dt * M[i]!;
    for (let i = 0; i < n; i++) L[i * n + i] = L[i * n + i]! + 1;
    lu = luDecompose(L, n);
  } else if (cfg.solver !== 'SOLVER-RK4') {
    throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by MODEL-010.`);
  }
  const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
  const deriv = (t: number, x: Float64Array, d: Float64Array) => {
    for (let i = 0; i < n; i++) {
      let s = 0;
      const row = i * n;
      for (let j = 0; j < n; j++) s += M[row + j]! * x[j]!;
      d[i] = s;
    }
    d[inj] = d[inj]! + current(t) / cInj;
  };
  const path = geo.pathNodes;
  const rec = makeRecorder(['V_inject', 'V_proximal', 'V_distal', 'I_inj'], nSteps);
  const frames = Math.min(240, nSteps + 1);
  const frameStride = Math.max(1, Math.floor(nSteps / (frames - 1 || 1)));
  const heat = new Float64Array(path.length * frames);
  let frame = 0;
  const writeFrame = () => {
    if (frame >= frames) return;
    for (let r = 0; r < path.length; r++) heat[r * frames + frame] = u[path[r]!]! + EL;
    frame++;
  };
  const writeRec = (j: number, t: number) => {
    rec.t[j] = t; rec.s.V_inject![j] = u[inj]! + EL; rec.s.V_proximal![j] = u[0]! + EL;
    rec.s.V_distal![j] = u[path[path.length - 1]!]! + EL; rec.s.I_inj![j] = current(t); rec.written = j + 1;
  };
  writeRec(0, 0); writeFrame();
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    if (lu) {
      mulAdd(rhs, u, 0.5 * dt);
      rhs[inj] = rhs[inj]! + (dt * 0.5 * (current(t) + current(t + dt))) / cInj;
      luSolve(lu.lu, lu.perm, n, rhs, next);
      u.set(next);
    } else {
      deriv(t, u, k1);
      for (let q = 0; q < n; q++) tmp[q] = u[q]! + 0.5 * dt * k1[q]!;
      deriv(t + 0.5 * dt, tmp, k2);
      for (let q = 0; q < n; q++) tmp[q] = u[q]! + 0.5 * dt * k2[q]!;
      deriv(t + 0.5 * dt, tmp, k3);
      for (let q = 0; q < n; q++) tmp[q] = u[q]! + dt * k3[q]!;
      deriv(t + dt, tmp, k4);
      for (let q = 0; q < n; q++) u[q] = u[q]! + (dt / 6) * (k1[q]! + 2 * k2[q]! + 2 * k3[q]! + k4[q]!);
    }
    if (diverged(u[inj]!)) { status = 'DIVERGED'; failedAtMs = t; break; }
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) writeRec(j, k * dt); }
    if (k % frameStride === 0) writeFrame();
    if (ctx?.onProgress && k % 5000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  out.matrices.V_xt = {
    rows: path.length, cols: frame, data: frame === frames ? heat : Float64Array.from({ length: path.length * frame }, (_, q) => heat[Math.floor(q / frame) * frames + (q % frame)]!),
  };
  // Final spatial profile along the main path, normalized to the injection node, with the sealed-end analytic solution.
  const xs = new Float64Array(path.length), ys = new Float64Array(path.length), ana = new Float64Array(path.length);
  const u0 = u[inj]!;
  const Xinj = geo.X[inj]!;
  for (let r = 0; r < path.length; r++) {
    const X = geo.X[path[r]!]!;
    xs[r] = X;
    ys[r] = Math.abs(u0) > 1e-12 ? u[path[r]!]! / u0 : 0;
    // Sealed finite cable (electrotonic length L): cosh(L − X)/cosh(L − X_inj) distal to the site, cosh(X)/cosh(X_inj) proximal.
    ana[r] = X >= Xinj ? Math.cosh(geo.totalL - X) / Math.cosh(geo.totalL - Xinj) : Math.cosh(X) / Math.cosh(Xinj);
  }
  out.curves.profile_numeric = { x: xs, y: ys };
  out.curves.profile_analytic = { x: Float64Array.from(xs), y: ana };
  let maxErr = 0;
  for (let r = 0; r < path.length; r++) maxErr = Math.max(maxErr, Math.abs(ys[r]! - ana[r]!) / Math.max(1e-9, ana[r]!));
  const peakProx = maxOf(series.V_proximal!) - EL, peakInj = maxOf(series.V_inject!) - EL, peakDist = maxOf(series.V_distal!) - EL;
  const argmax = (a: Float64Array) => { let m = -Infinity, q = 0; for (let i = 0; i < a.length; i++) if (a[i]! > m) { m = a[i]!; q = i; } return q; };
  out.metrics.steadyAttenuationDistal = ys[path.length - 1]!;
  out.metrics.profileMaxRelErrorPct = 100 * maxErr;
  out.metrics.peakAtInjectionMv = peakInj;
  out.metrics.peakAtProximalMv = peakProx;
  out.metrics.peakAtDistalMv = peakDist;
  out.metrics.peakAttenuation = peakInj !== 0 ? Math.min(peakProx, peakDist) / peakInj : NaN;
  out.metrics.timeToPeakInjectionMs = t[argmax(series.V_inject!)]! - onset;
  out.metrics.timeToPeakFarEndMs = t[argmax(inj === 0 ? series.V_distal! : series.V_proximal!)]! - onset;
  out.metrics.electrotonicLength = geo.totalL;
  out.metrics.rallSum = geo.rallSum;
  if (p('branch_mode') >= 0.5) {
    out.notes.push(Math.abs(geo.rallSum - 1) < 0.02
      ? 'Rall 3/2 condition satisfied (Σ d_daughter^{3/2} = d_parent^{3/2}): the tree collapses to one equivalent cylinder and the analytic profile applies.'
      : `Rall 3/2 condition violated (Σ ρ^{3/2} = ${geo.rallSum.toFixed(2)} ≠ 1): impedance mismatch at the branch point; the single-cylinder analytic curve no longer matches.`);
  }
  return out;
}

export const MODEL_010: ModelDefinition = {
  id: 'MODEL-010',
  name: 'Passive Cable & Rall Compartments',
  equations: [
    '\\tau_m \\frac{\\partial V}{\\partial t} = \\lambda^2 \\frac{\\partial^2 V}{\\partial x^2} - (V - E_L) + r_m i_{ext}(x, t)',
    'C_k \\frac{dV_k}{dt} = -g_{L,k}(V_k - E_L) + \\sum_{j \\in \\mathcal{N}(k)} g_{kj}(V_j - V_k) + I_k(t)',
    '\\left.\\frac{\\partial V}{\\partial x}\\right|_{x = 0,\\,L} = 0, \\qquad \\frac{V(X)}{V(0)} = \\frac{\\cosh(L - X)}{\\cosh L} \\;\\text{(steady state, sealed end)}',
    'd_{parent}^{3/2} = \\sum d_{child}^{3/2} \\quad \\text{(Rall equivalent cylinder)}',
  ],
  params: CABLE_PARAMS,
  initial: [{ key: 'V_1', label: 'Initial potential (all compartments)', unit: 'mV', default: -70 }],
  stimulus: {
    label: 'Injected current', unit: 'pA', description: 'Current delivered to the chosen injection compartment.',
    default: { kind: 'step', amplitude: 100, startMs: 5, durationMs: 1e9 }, amplitudeRange: [-300, 600], kinds: ['step', 'pulse-train', 'sine', 'none'],
  },
  solvers: ['SOLVER-CRANK-NICOLSON', 'SOLVER-RK4'],
  defaultSolver: 'SOLVER-CRANK-NICOLSON', defaultDtMs: 0.05, minDtMs: 0.01, maxSafeDtMs: 0.2, defaultDurationMs: 200, maxDurationMs: 5000,
  stochastic: false,
  views: [
    { kind: 'matrix', title: 'Voltage along the dendrite over time', key: 'V_xt', xLabel: 'time →', yLabel: 'position (proximal → distal)', meaning: 'Membrane potential of every compartment on the main path; shows electrotonic spread and attenuation.' },
    { kind: 'traces', title: 'Voltage at three sites', yLabel: 'V (mV)', series: [
      { key: 'V_inject', label: 'Injection site', unit: 'mV', meaning: 'Membrane potential at the current-injection compartment.' },
      { key: 'V_proximal', label: 'Proximal end', unit: 'mV', meaning: 'Membrane potential at the proximal (somatic) end.' },
      { key: 'V_distal', label: 'Distal end', unit: 'mV', meaning: 'Membrane potential at the distal sealed end.' },
    ] },
    { kind: 'curve', title: 'Final spatial profile vs sealed-end analytic solution', xLabel: 'electrotonic distance X = x/λ', yLabel: 'V(X) / V(inj)', meaning: 'Normalized depolarization along the cable at the end of the run.', curves: [{ key: 'profile_analytic', label: 'Analytical cosh profile' }, { key: 'profile_numeric', label: 'Compartmental solution', points: true }] },
  ],
  metrics: [
    { key: 'steadyAttenuationDistal', label: 'Distal / injection voltage', unit: '', description: 'Ratio of final depolarization at the distal end to that at the injection site.', digits: 4 },
    { key: 'profileMaxRelErrorPct', label: 'Max deviation from analytic profile', unit: '%', description: 'Largest relative difference between the compartmental and analytic steady-state profile (VAL-CABLE-001 tolerance 0.5%; valid for steady current in an unbranched or Rall-matched cable).', digits: 4 },
    { key: 'peakAttenuation', label: 'Peak attenuation', unit: '', description: 'Peak depolarization at the far end divided by the peak at the injection site.', digits: 4 },
    { key: 'timeToPeakInjectionMs', label: 'Time to peak at injection site', unit: 'ms', description: 'Latency of the voltage peak where current enters.' },
    { key: 'timeToPeakFarEndMs', label: 'Time to peak at far end', unit: 'ms', description: 'Latency of the voltage peak at the end farthest from the injection site; cable filtering delays and broadens the response.' },
    { key: 'electrotonicLength', label: 'Electrotonic length L', unit: 'λ', description: 'Total length of the main path in units of the length constant.', digits: 3 },
  ],
  presets: [
    { id: 'steady', label: 'Steady current at the proximal end', description: 'Exponential-like attenuation matches the cosh solution (VAL-CABLE-001).', params: { N_comp_cable: 50 }, stimulus: { kind: 'step', amplitude: 100, startMs: 5, durationMs: 1e9 }, durationMs: 250, experimentId: 'EXP-018' },
    { id: 'epsp', label: 'Distal EPSC: temporal filtering', description: 'A brief synaptic current at the distal end arrives attenuated, delayed and broadened.', params: { input_mode: 1, inject_frac: 1, N_comp_cable: 40 }, stimulus: { kind: 'step', amplitude: 200, startMs: 5, durationMs: 1e9 }, durationMs: 80, experimentId: 'EXP-018' },
    { id: 'rallMatched', label: 'Rall 3/2 matched branch', description: 'Two daughters with ρ = 0.63 behave as one equivalent cylinder.', params: { branch_mode: 1, daughter_ratio: 0.63, N_comp_cable: 50 }, stimulus: { kind: 'step', amplitude: 100, startMs: 5, durationMs: 1e9 }, durationMs: 250, experimentId: 'EXP-019' },
    { id: 'rallMismatch', label: 'Mismatched branch (thick daughters)', description: 'ρ = 1.0 violates the 3/2 rule; the profile departs from the single-cylinder curve.', params: { branch_mode: 1, daughter_ratio: 1.0, N_comp_cable: 50 }, stimulus: { kind: 'step', amplitude: 100, startMs: 5, durationMs: 1e9 }, durationMs: 250, experimentId: 'EXP-019' },
  ],
  sweep: { paramKey: 'lambda_cable', from: 100, to: 800, steps: 15, metricKey: 'steadyAttenuationDistal', experimentId: 'EXP-018' },
  kernelLimitations: ['Purely passive membrane: no voltage-gated dendritic channels, NMDA spikes or back-propagating action potentials.', 'Branched mode supports one symmetric bifurcation; arbitrary reconstructed morphologies are not simulated.'],
  run: runCable,
};
