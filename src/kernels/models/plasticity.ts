// MODEL-023 Hebb / Oja / BCM, MODEL-024 pair & triplet STDP, MODEL-025 homeostatic scaling, MODEL-026 TD-RL.
// Specification: docs/06-computational-models/PLASTICITY_AND_LEARNING_MODELS.md. Every rule enforces explicit
// weight bounds (AC-MOD-008).
import { DIVERGENCE_NOTE, runOde } from '../core/odeRun';
import { diverged, finishRecorder, linspace, makeRecorder, paramReader, stepCount } from '../core/record';
import { Rng } from '../core/prng';
import type { ModelDefinition, ModelOutput, ParamSpec, RunConfig, RunContext } from '../core/types';
import { SimulationError } from '../core/types';
import type { Deriv } from '../solvers/ode';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const RAD = 180 / Math.PI;

// ───────────────────────── MODEL-023 Hebb / Oja / BCM ─────────────────────────

const HEBB_PARAMS: ParamSpec[] = [
  { key: 'rule', label: 'Learning rule', symbol: '', unit: '', default: 1, min: 0, max: 2, step: 1, integer: true, description: 'Which rate-based rule updates the weights. The three rules differ only in how runaway growth is controlled.', group: 'Rule', options: [{ value: 0, label: 'Basic Hebb (hard-clipped)' }, { value: 1, label: 'Oja (multiplicative normalization)' }, { value: 2, label: 'BCM (sliding threshold)' }] },
  { key: 'alpha_Oja', label: 'Oja normalization factor', symbol: '\\alpha', unit: '', default: 1, min: 0.1, max: 5, step: 0.05, registryId: 'PARAM-068', description: 'Strength of the weight-decay term in Oja\'s rule; the weight vector converges to length 1/√α.', group: 'Rule' },
  { key: 'tau_theta_BCM', label: 'BCM threshold time constant', symbol: '\\tau_\\theta', unit: 'ms', default: 1000, min: 20, max: 20000, step: 10, registryId: 'PARAM-069', description: 'How quickly the modification threshold θ_M tracks the recent average of y². It must be faster than the weight dynamics for selectivity to be stable.', group: 'Rule' },
  { key: 'tau_w', label: 'Weight time constant', symbol: '\\tau_w', unit: 'ms', default: 500, min: 20, max: 50000, step: 10, description: 'Sets the learning speed: larger values learn more slowly and average over more input samples.', group: 'Rule' },
  { key: 'w_max', label: 'Weight bound', symbol: 'w_{max}', unit: '', default: 5, min: 0.5, max: 50, step: 0.5, description: 'Hard bound on every weight. Basic Hebb is clipped to [0, w_max]; Oja and BCM to [−w_max, w_max].', group: 'Rule' },
  { key: 'rho_in', label: 'Input correlation', symbol: 'r', unit: '', default: 0.8, min: -0.95, max: 0.95, step: 0.01, description: 'Correlation coefficient between the two input-rate fluctuations (Hebb and Oja).', group: 'Gaussian inputs (Hebb, Oja)' },
  { key: 'sigma_1', label: 'Input 1 standard deviation', symbol: '\\sigma_1', unit: '', default: 1, min: 0.1, max: 3, step: 0.05, description: 'Standard deviation of the first input-rate fluctuation.', group: 'Gaussian inputs (Hebb, Oja)' },
  { key: 'sigma_2', label: 'Input 2 standard deviation', symbol: '\\sigma_2', unit: '', default: 0.7, min: 0.1, max: 3, step: 0.05, description: 'Standard deviation of the second input-rate fluctuation.', group: 'Gaussian inputs (Hebb, Oja)' },
  { key: 'pattern_sep', label: 'Angle between the two patterns', symbol: '\\Delta\\phi', unit: '°', default: 50, min: 5, max: 90, step: 1, description: 'Angular separation of the two input patterns in input space; smaller values make the patterns more similar.', group: 'Pattern inputs (BCM)' },
  { key: 'T_pres', label: 'Pattern presentation time', symbol: 'T_{pres}', unit: 'ms', default: 20, min: 1, max: 500, step: 1, description: 'Duration for which each randomly chosen pattern is shown before the next one.', group: 'Pattern inputs (BCM)' },
  { key: 'pattern_noise', label: 'Pattern noise', symbol: '\\sigma_x', unit: '', default: 0.02, min: 0, max: 0.5, step: 0.01, description: 'Standard deviation of Gaussian noise added to each pattern presentation.', group: 'Pattern inputs (BCM)' },
];

/** Eigen-decomposition of the 2 × 2 input covariance [[σ₁², rσ₁σ₂], [rσ₁σ₂, σ₂²]]. */
export function covarianceEigen(s1: number, s2: number, r: number): { l1: number; l2: number; e1: [number, number] } {
  const a = s1 * s1, d = s2 * s2, b = r * s1 * s2;
  const half = 0.5 * (a + d), disc = Math.sqrt(0.25 * (a - d) ** 2 + b * b);
  const l1 = half + disc, l2 = half - disc;
  let ex = b, ey = l1 - a;
  if (Math.abs(ex) + Math.abs(ey) < 1e-14) { ex = a >= d ? 1 : 0; ey = a >= d ? 0 : 1; }
  const nrm = Math.hypot(ex, ey);
  return { l1, l2, e1: [ex / nrm, ey / nrm] };
}

function runHebb(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(HEBB_PARAMS, cfg.params);
  const rule = Math.round(p('rule')), alpha = p('alpha_Oja'), tauTh = p('tau_theta_BCM'), tauW = p('tau_w'), wMax = p('w_max');
  const rho = p('rho_in'), s1 = p('sigma_1'), s2 = p('sigma_2'), sep = p('pattern_sep'), tPres = p('T_pres'), xNoise = p('pattern_noise');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const rng = new Rng(cfg.seed);
  const bcm = rule === 2;
  const lo = rule === 0 ? 0 : -wMax;
  // BCM patterns sit symmetrically around the 45° diagonal of the positive quadrant.
  const phiA = ((45 - sep / 2) * Math.PI) / 180, phiB = ((45 + sep / 2) * Math.PI) / 180;
  const pa: [number, number] = [Math.cos(phiA), Math.sin(phiA)], pb: [number, number] = [Math.cos(phiB), Math.sin(phiB)];
  const eig = covarianceEigen(s1, s2, rho);
  const chol = Math.sqrt(Math.max(0, 1 - rho * rho));
  const presSteps = bcm ? Math.max(1, Math.round(tPres / dt)) : 1;
  let w1 = cfg.initial.w_1 ?? 0.5, w2 = cfg.initial.w_2 ?? 0.2, th = cfg.initial.theta_M ?? 1;
  let x1 = 0, x2 = 0;
  const f = (a: number, b: number, t: number): [number, number, number] => {
    const raw = a * x1 + b * x2;
    if (rule === 0) return [(raw * x1) / tauW, (raw * x2) / tauW, 0];
    if (rule === 1) return [(raw * x1 - alpha * raw * raw * a) / tauW, (raw * x2 - alpha * raw * raw * b) / tauW, 0];
    const y = raw > 0 ? raw : 0;
    return [(y * (y - t) * x1) / tauW, (y * (y - t) * x2) / tauW, (y * y - t) / tauTh];
  };
  const keys = bcm ? ['w_1', 'w_2', 'norm', 'y', 'theta_M', 'y_A', 'y_B'] : ['w_1', 'w_2', 'norm', 'y', 'angle_error'];
  const rec = makeRecorder(keys, nSteps);
  const angleTo = (a: number, b: number) => { const n = Math.hypot(a, b); return n > 0 ? Math.acos(Math.min(1, Math.abs(a * eig.e1[0] + b * eig.e1[1]) / n)) * RAD : NaN; };
  const resp = (a: number, b: number, q: [number, number]) => Math.max(0, a * q[0] + b * q[1]);
  let yNow = 0;
  const write = (j: number, t: number) => {
    rec.t[j] = t; rec.s.w_1![j] = w1; rec.s.w_2![j] = w2; rec.s.norm![j] = Math.hypot(w1, w2); rec.s.y![j] = yNow;
    if (bcm) { rec.s.theta_M![j] = th; rec.s.y_A![j] = resp(w1, w2, pa); rec.s.y_B![j] = resp(w1, w2, pb); } else rec.s.angle_error![j] = angleTo(w1, w2);
    rec.written = j + 1;
  };
  write(0, 0);
  let status: ModelOutput['status'] = 'COMPLETED';
  let failedAtMs: number | undefined;
  let sxx = 0, sxy = 0, syy = 0, countA = 0, clipped = 0;
  for (let i = 0; i < nSteps; i++) {
    if (i % presSteps === 0) {
      if (bcm) {
        const q = rng.next() < 0.5 ? pa : pb;
        if (q === pa) countA++;
        x1 = q[0] + xNoise * rng.normal(); x2 = q[1] + xNoise * rng.normal();
      } else {
        const z1 = rng.normal(), z2 = rng.normal();
        x1 = s1 * z1; x2 = s2 * (rho * z1 + chol * z2);
        sxx += x1 * x1; sxy += x1 * x2; syy += x2 * x2;
      }
    }
    if (cfg.solver === 'SOLVER-FE') {
      const k = f(w1, w2, th);
      w1 += dt * k[0]; w2 += dt * k[1]; th += dt * k[2];
    } else if (cfg.solver === 'SOLVER-RK4') {
      const k1 = f(w1, w2, th), k2 = f(w1 + 0.5 * dt * k1[0], w2 + 0.5 * dt * k1[1], th + 0.5 * dt * k1[2]);
      const k3 = f(w1 + 0.5 * dt * k2[0], w2 + 0.5 * dt * k2[1], th + 0.5 * dt * k2[2]), k4 = f(w1 + dt * k3[0], w2 + dt * k3[1], th + dt * k3[2]);
      w1 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); w2 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); th += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    } else throw new SimulationError('ERR_INVALID_PARAMS', `Solver ${cfg.solver} is not supported by MODEL-023.`);
    if (diverged(w1) || diverged(w2) || diverged(th)) { status = 'DIVERGED'; failedAtMs = (i + 1) * dt; break; }
    const c1 = clamp(w1, lo, wMax), c2 = clamp(w2, lo, wMax);
    if (c1 !== w1 || c2 !== w2) clipped++;
    w1 = c1; w2 = c2;
    if (th < 0) th = 0;
    const raw = w1 * x1 + w2 * x2;
    yNow = bcm ? Math.max(0, raw) : raw;
    const k = i + 1;
    if (k % rec.stride === 0) { const j = k / rec.stride; if (j < rec.n) write(j, k * dt); }
    if (ctx?.onProgress && k % 5000 === 0) ctx.onProgress(k / nSteps);
  }
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status };
  if (failedAtMs !== undefined) { out.failedAtMs = failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const norm = Math.hypot(w1, w2);
  out.metrics.weightNorm = norm;
  out.metrics.w1Final = w1;
  out.metrics.w2Final = w2;
  out.metrics.clippedSteps = clipped;
  out.metrics.saturated = Math.abs(w1) >= wMax - 1e-9 || Math.abs(w2) >= wMax - 1e-9 ? 1 : 0;
  if (!bcm) {
    const L = Math.max(1.2, 1.2 * norm);
    out.curves.principal_axis = { x: Float64Array.of(-L * eig.e1[0], L * eig.e1[0]), y: Float64Array.of(-L * eig.e1[1], L * eig.e1[1]) };
    if (rule === 1) {
      const ang = linspace(0, 2 * Math.PI, 121), rad = 1 / Math.sqrt(alpha);
      out.curves.norm_circle = { x: Float64Array.from(ang, (a) => rad * Math.cos(a)), y: Float64Array.from(ang, (a) => rad * Math.sin(a)) };
    }
    out.metrics.angleErrorDeg = angleTo(w1, w2);
    out.metrics.lambda1 = eig.l1;
    out.metrics.lambda2 = eig.l2;
    out.metrics.expectedNorm = rule === 1 ? 1 / Math.sqrt(alpha) : NaN;
    // Same angle measured against the principal axis of the covariance actually sampled in this run.
    const m = nSteps;
    const a = sxx / m, d = syy / m, b = sxy / m;
    const l1s = 0.5 * (a + d) + Math.sqrt(0.25 * (a - d) ** 2 + b * b);
    const en = Math.hypot(b, l1s - a);
    out.metrics.sampleAngleErrorDeg = en > 0 && norm > 0 ? Math.acos(Math.min(1, Math.abs(w1 * b + w2 * (l1s - a)) / (en * norm))) * RAD : NaN;
    out.notes.push(rule === 1
      ? `Oja's rule: |w| = ${norm.toFixed(4)} (theory 1/√α = ${(1 / Math.sqrt(alpha)).toFixed(4)}); the weight vector lies ${out.metrics.angleErrorDeg.toFixed(2)}° from the principal eigenvector of the input covariance (λ₁ = ${eig.l1.toFixed(3)}, λ₂ = ${eig.l2.toFixed(3)}).`
      : `Basic Hebbian growth is unstable: |w| reached ${norm.toFixed(3)}${out.metrics.saturated ? ' and is pinned at the hard bound' : ''}. The direction still follows the principal eigenvector (${out.metrics.angleErrorDeg.toFixed(2)}° away) until clipping distorts it.`);
  } else {
    const yA = resp(w1, w2, pa), yB = resp(w1, w2, pb);
    const L = Math.max(1.5, 1.2 * norm);
    out.curves.pattern_A = { x: Float64Array.of(0, L * pa[0]), y: Float64Array.of(0, L * pa[1]) };
    out.curves.pattern_B = { x: Float64Array.of(0, L * pb[0]), y: Float64Array.of(0, L * pb[1]) };
    const ys = linspace(0, Math.max(2.5, 1.5 * Math.max(yA, yB, th)), 101);
    out.curves.bcm_phi = { x: ys, y: Float64Array.from(ys, (y) => y * (y - th)) };
    // Late-run statistics (last quarter): the instantaneous θ_M jitters with the random pattern sequence.
    const th2 = series.theta_M!, sA = series.y_A!, sB = series.y_B!, from = Math.floor(0.75 * th2.length), cnt = Math.max(1, th2.length - from);
    let mn = Infinity, mx = -Infinity, thSum = 0, aSum = 0, bSum = 0;
    for (let i = from; i < th2.length; i++) { const v = th2[i]!; if (v < mn) mn = v; if (v > mx) mx = v; thSum += v; aSum += sA[i]!; bSum += sB[i]!; }
    const yAl = aSum / cnt, yBl = bSum / cnt, pref = Math.max(yAl, yBl);
    const silent = pref < 0.05;
    out.metrics.thetaM = th;
    out.metrics.thetaLateMean = thSum / cnt;
    out.metrics.thetaLateRange = mx - mn;
    out.metrics.responseA = yAl;
    out.metrics.responseB = yBl;
    out.metrics.preferredResponse = pref;
    out.metrics.selectivity = silent ? 0 : Math.abs(yAl - yBl) / (yAl + yBl);
    const presentations = Math.ceil(nSteps / presSteps);
    out.metrics.fractionPatternA = presentations ? countA / presentations : NaN;
    const unstable = tauTh >= tauW;
    out.notes.push(`BCM (averages over the last quarter of the run): responses y_A = ${yAl.toFixed(3)}, y_B = ${yBl.toFixed(3)}, threshold θ_M = ${(thSum / cnt).toFixed(3)}, selectivity ${out.metrics.selectivity.toFixed(3)}. ${silent ? 'The neuron fell silent: after a large threshold excursion both responses were depressed to zero, and a rectified neuron that never fires cannot recover.' : unstable ? `The threshold is slower than the weights (τ_θ ≥ τ_w): the selective state is unstable and θ_M swings over a range of ${(mx - mn).toFixed(2)}.` : out.metrics.selectivity > 0.9 ? 'The neuron became selective for one pattern; for two equiprobable patterns theory predicts y = θ_M = 2 for the preferred one.' : 'Selectivity is still developing; run longer.'}`);
  }
  return out;
}

export const MODEL_023: ModelDefinition = {
  id: 'MODEL-023',
  name: 'Hebb, Oja & BCM Rate Plasticity',
  equations: [
    'y = \\mathbf{w}^\\top \\mathbf{x}',
    '\\text{Hebb:}\\quad \\tau_w \\frac{d\\mathbf{w}}{dt} = y\\,\\mathbf{x}, \\qquad w_i \\in [0, w_{max}]',
    '\\text{Oja:}\\quad \\tau_w \\frac{d\\mathbf{w}}{dt} = y\\,\\mathbf{x} - \\alpha y^2 \\mathbf{w} \\;\\Rightarrow\\; \\lVert\\mathbf{w}\\rVert_2 \\to \\frac{1}{\\sqrt{\\alpha}}, \\; \\mathbf{w} \\parallel \\mathbf{e}_{max}(\\mathbf{C}_{xx})',
    '\\text{BCM:}\\quad \\tau_w \\frac{d\\mathbf{w}}{dt} = y\\,(y - \\theta_M)\\,\\mathbf{x}, \\qquad \\tau_\\theta \\frac{d\\theta_M}{dt} = y^2 - \\theta_M, \\qquad y = [\\mathbf{w}^\\top \\mathbf{x}]_+',
  ],
  params: HEBB_PARAMS,
  initial: [
    { key: 'w_1', label: 'Weight w₁(0)', unit: '', default: 0.5 },
    { key: 'w_2', label: 'Weight w₂(0)', unit: '', default: 0.2 },
    { key: 'theta_M', label: 'BCM threshold θ_M(0)', unit: '', default: 1 },
  ],
  stimulus: null,
  solvers: ['SOLVER-RK4', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 1, minDtMs: 0.1, maxSafeDtMs: 5, defaultDurationMs: 5000, maxDurationMs: 50000,
  stochastic: true,
  views: [
    { kind: 'phase', title: 'Weight space (w₁, w₂)', xKey: 'w_1', yKey: 'w_2', xLabel: 'w₁', yLabel: 'w₂', curves: [{ key: 'principal_axis', label: 'Principal eigenvector of C_xx' }, { key: 'norm_circle', label: '|w| = 1/√α' }, { key: 'pattern_A', label: 'Pattern A' }, { key: 'pattern_B', label: 'Pattern B' }] },
    { kind: 'traces', title: 'Synaptic weights', yLabel: 'weight', series: [
      { key: 'w_1', label: 'w₁', unit: '', meaning: 'Synaptic weight from input 1.' },
      { key: 'w_2', label: 'w₂', unit: '', meaning: 'Synaptic weight from input 2.' },
      { key: 'norm', label: '|w|', unit: '', meaning: 'Euclidean length of the weight vector.', dashed: true },
    ] },
    { kind: 'traces', title: 'Angle to the principal eigenvector', yLabel: 'angle (°)', series: [{ key: 'angle_error', label: '∠(w, e₁)', unit: '°', meaning: 'Angle between the weight vector and the dominant eigenvector of the input covariance.' }] },
    { kind: 'traces', title: 'BCM threshold and pattern responses', yLabel: 'rate (a.u.)', series: [
      { key: 'theta_M', label: 'θ_M', unit: '', meaning: 'Sliding modification threshold: responses above it potentiate, below it depress.', dashed: true },
      { key: 'y_A', label: 'response to A', unit: '', meaning: 'Postsynaptic response the current weights give to pattern A.' },
      { key: 'y_B', label: 'response to B', unit: '', meaning: 'Postsynaptic response the current weights give to pattern B.' },
    ] },
    { kind: 'curve', title: 'BCM plasticity function φ(y) = y (y − θ_M)', xLabel: 'postsynaptic rate y', yLabel: 'φ(y)', meaning: 'Sign and size of the weight change as a function of postsynaptic rate at the final threshold: negative (LTD) below θ_M, positive (LTP) above.', curves: [{ key: 'bcm_phi', label: 'φ(y)' }] },
  ],
  metrics: [
    { key: 'weightNorm', label: 'Weight norm |w|', unit: '', description: 'Euclidean length of the final weight vector (VAL-OJA-001 expects 1.0 ± 0.02 under Oja with α = 1).', digits: 4 },
    { key: 'angleErrorDeg', label: 'Angle to principal eigenvector', unit: '°', description: 'Angle between the final weight vector and e₁ of the input covariance (VAL-OJA-001 expects < 3°).', digits: 3 },
    { key: 'expectedNorm', label: 'Theoretical norm 1/√α', unit: '', description: 'Fixed-point length of the weight vector under Oja\'s rule.', digits: 4 },
    { key: 'lambda1', label: 'Largest covariance eigenvalue', unit: '', description: 'Variance of the inputs along the principal axis.', digits: 4 },
    { key: 'selectivity', label: 'Selectivity index', unit: '', description: 'BCM response contrast |y_A − y_B| / (y_A + y_B) over the last quarter of the run: 0 = unselective or silent, 1 = responds to one pattern only.', digits: 3 },
    { key: 'preferredResponse', label: 'Preferred-pattern response', unit: '', description: 'Late-run mean response to the preferred pattern (theory: 2 for two equiprobable patterns).', digits: 3 },
    { key: 'thetaLateMean', label: 'Late mean threshold θ_M', unit: '', description: 'BCM modification threshold averaged over the last quarter of the run (theory: 2).', digits: 3 },
    { key: 'thetaLateRange', label: 'Late threshold range', unit: '', description: 'Peak-to-peak excursion of θ_M over the last quarter; large values indicate an unstable, oscillating threshold.', digits: 3 },
    { key: 'saturated', label: 'Weights at bound', unit: '', description: '1 if a weight ended on its hard bound.', digits: 0 },
  ],
  presets: [
    { id: 'oja', label: 'Oja: principal component extraction', description: 'The weight vector rotates onto the principal eigenvector and its length settles at 1/√α.', params: { rule: 1, tau_w: 500 }, experimentId: 'EXP-032' },
    { id: 'hebb', label: 'Basic Hebb: runaway growth', description: 'Same inputs without normalization: weights grow until they hit the hard bound.', params: { rule: 0, tau_w: 500 }, experimentId: 'EXP-032' },
    { id: 'bcm', label: 'BCM: emergent input selectivity', description: 'Two inputs are active on alternate presentations; the sliding threshold makes the neuron respond to only one of them.', params: { rule: 2, tau_w: 3000, tau_theta_BCM: 1000, pattern_sep: 90, T_pres: 10 }, durationMs: 50000, experimentId: 'EXP-033' },
    { id: 'bcm_slow', label: 'BCM with a slow threshold (unstable)', description: 'When θ_M adapts more slowly than the weights the selective state loses stability and the threshold swings widely.', params: { rule: 2, tau_w: 1000, tau_theta_BCM: 1300, pattern_sep: 90, T_pres: 10 }, durationMs: 40000, experimentId: 'EXP-033' },
  ],
  sweep: { paramKey: 'alpha_Oja', from: 0.25, to: 4, steps: 9, metricKey: 'weightNorm', experimentId: 'EXP-032' },
  kernelLimitations: [
    'Two inputs and one linear (BCM: rectified) rate neuron; spike timing is not represented.',
    'Hebb and Oja inputs are zero-mean rate fluctuations (mean-subtracted rates), so the rule extracts the principal component of the input covariance.',
    'Rates and weights are dimensionless; BCM weights may become negative, standing for a net inhibitory influence.',
    'A new input sample is drawn every time step (Hebb, Oja) or every presentation interval (BCM) and held constant in between.',
    'BCM selectivity needs the threshold to adapt faster than the weights (τ_θ < τ_w); with the default τ_w = 500 ms and τ_θ = 1000 ms the rule is in its unstable regime, so use the BCM presets.',
  ],
  run: runHebb,
};

// ───────────────────────── MODEL-024 pair & triplet STDP ─────────────────────────

const STDP_PARAMS: ParamSpec[] = [
  { key: 'tau_plus_STDP', label: 'Potentiation time constant', symbol: '\\tau_+', unit: 'ms', default: 16.8, min: 1, max: 100, step: 0.1, registryId: 'PARAM-070', description: 'Width of the pre-before-post (LTP) side of the timing window.', group: 'Timing window' },
  { key: 'tau_minus_STDP', label: 'Depression time constant', symbol: '\\tau_-', unit: 'ms', default: 33.7, min: 1, max: 200, step: 0.1, registryId: 'PARAM-071', description: 'Width of the post-before-pre (LTD) side of the timing window.', group: 'Timing window' },
  { key: 'A_plus_STDP', label: 'LTP amplitude', symbol: 'A_+', unit: '', default: 0.01, min: 0, max: 0.1, step: 0.0005, registryId: 'PARAM-072', description: 'Weight increase for a pre→post pair at Δt → 0⁺ (η₊ under soft bounds; the pair term A₂⁺ of the triplet rule).', group: 'Timing window' },
  { key: 'A_minus_STDP', label: 'LTD amplitude', symbol: 'A_-', unit: '', default: 0.0105, min: 0, max: 0.1, step: 0.0005, registryId: 'PARAM-073', description: 'Weight decrease for a post→pre pair at Δt → 0⁻ (η₋ under soft bounds).', group: 'Timing window' },
  { key: 'bounds', label: 'Weight dependence', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Additive updates with a hard clamp, or multiplicative soft bounds that shrink updates near the limits.', group: 'Weight bounds', options: [{ value: 0, label: 'Additive (hard bounds)' }, { value: 1, label: 'Multiplicative (soft bounds)' }] },
  { key: 'w_min', label: 'Minimum weight', symbol: 'w_{min}', unit: '', default: 0, min: 0, max: 1, step: 0.05, description: 'Lower weight bound.', group: 'Weight bounds' },
  { key: 'w_max', label: 'Maximum weight', symbol: 'w_{max}', unit: '', default: 1, min: 0.1, max: 5, step: 0.05, description: 'Upper weight bound.', group: 'Weight bounds' },
  { key: 'rule', label: 'Spike interaction rule', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Pair rule, or the triplet rule in which a slow postsynaptic trace boosts LTP at high firing rates.', group: 'Triplet extension', options: [{ value: 0, label: 'Pair-based' }, { value: 1, label: 'Triplet (Pfister–Gerstner)' }] },
  { key: 'A3_plus', label: 'Triplet LTP amplitude', symbol: 'A_3^+', unit: '', default: 0.0065, min: 0, max: 0.1, step: 0.0005, description: 'Extra potentiation per unit of the slow postsynaptic trace (triplet rule only).', group: 'Triplet extension' },
  { key: 'tau_y', label: 'Slow postsynaptic trace time constant', symbol: '\\tau_y', unit: 'ms', default: 114, min: 10, max: 500, step: 1, description: 'Decay time of the slow postsynaptic trace (triplet rule only).', group: 'Triplet extension' },
  { key: 'protocol', label: 'Stimulation protocol', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Repeated spike pairing at a fixed delay, or independent Poisson spike trains.', group: 'Protocol', options: [{ value: 0, label: 'Spike pairing at fixed Δt' }, { value: 1, label: 'Independent Poisson trains' }] },
  { key: 'delta_t', label: 'Spike-time difference', symbol: '\\Delta t', unit: 'ms', default: 10, min: -100, max: 100, step: 0.5, description: 'Postsynaptic minus presynaptic spike time in each pair (positive: pre leads post).', group: 'Protocol' },
  { key: 'n_pairs', label: 'Number of pairs', symbol: 'n', unit: '', default: 60, min: 1, max: 200, step: 1, integer: true, description: 'Number of pre/post pairings (Bi & Poo used 60).', group: 'Protocol' },
  { key: 'pair_freq', label: 'Pairing frequency', symbol: 'f', unit: 'Hz', default: 5, min: 0.1, max: 50, step: 0.1, description: 'Repetition rate of the pairings.', group: 'Protocol' },
  { key: 'rate_pre', label: 'Presynaptic Poisson rate', symbol: 'r_{pre}', unit: 'Hz', default: 10, min: 0.1, max: 100, step: 0.5, description: 'Mean presynaptic rate (Poisson protocol).', group: 'Protocol' },
  { key: 'rate_post', label: 'Postsynaptic Poisson rate', symbol: 'r_{post}', unit: 'Hz', default: 10, min: 0.1, max: 100, step: 0.5, description: 'Mean postsynaptic rate (Poisson protocol).', group: 'Protocol' },
];

export interface StdpRule {
  tauPlus: number; tauMinus: number; aPlus: number; aMinus: number;
  wMin: number; wMax: number; multiplicative: boolean;
  triplet: boolean; a3Plus: number; tauY: number;
}

export interface StdpTraceSink { t: Float64Array; w: Float64Array; x: Float64Array; y: Float64Array; ys: Float64Array; n: number }

/**
 * Event-driven online STDP (EQ-070): the traces decay exactly between events, a presynaptic spike depresses by
 * A₋(w)·y_post and a postsynaptic spike potentiates by A₊(w)·x_pre (triplet: × (A₂⁺ + A₃⁺ y_slow)), each using the trace
 * values just before the spike. Returns the final weight; optionally samples the state at the times in `sink`.
 */
export function stdpEvolve(pre: ArrayLike<number>, post: ArrayLike<number>, w0: number, R: StdpRule, sink?: StdpTraceSink): number {
  let w = w0, x = 0, y = 0, ys = 0, last = 0, ip = 0, iq = 0, j = 0;
  for (;;) {
    const tp = ip < pre.length ? pre[ip]! : Infinity, tq = iq < post.length ? post[iq]! : Infinity, ts = sink && j < sink.n ? sink.t[j]! : Infinity;
    const t = Math.min(tp, tq, ts);
    if (t === Infinity) break;
    const d = t - last;
    if (d > 0) { x *= Math.exp(-d / R.tauPlus); y *= Math.exp(-d / R.tauMinus); ys *= Math.exp(-d / R.tauY); last = t; }
    const isPre = tp === t, isPost = tq === t;
    if (isPre || isPost) {
      let dw = 0;
      if (isPre) dw -= (R.multiplicative ? R.aMinus * (w - R.wMin) : R.aMinus) * y;
      if (isPost) dw += (R.multiplicative ? R.wMax - w : 1) * (R.triplet ? R.aPlus + R.a3Plus * ys : R.aPlus) * x;
      w = clamp(w + dw, R.wMin, R.wMax);
      if (isPre) { x += 1; ip++; }
      if (isPost) { y += 1; ys += 1; iq++; }
    } else if (sink) {
      sink.w[j] = w; sink.x[j] = x; sink.y[j] = y; sink.ys[j] = ys; j++;
    }
  }
  return w;
}

/** Closed-form weight change of one isolated spike pair (EQ-069, EQ-071). */
export function stdpWindow(deltaT: number, R: StdpRule, w0: number): number {
  if (deltaT > 0) return (R.multiplicative ? R.aPlus * (R.wMax - w0) : R.aPlus) * Math.exp(-deltaT / R.tauPlus);
  if (deltaT < 0) return -(R.multiplicative ? R.aMinus * (w0 - R.wMin) : R.aMinus) * Math.exp(deltaT / R.tauMinus);
  return 0;
}

function pairingTrains(deltaT: number, nPairs: number, freqHz: number, limitMs: number): { pre: number[]; post: number[] } {
  const pre: number[] = [], post: number[] = [];
  const period = 1000 / freqHz, t0 = 150;
  for (let k = 0; k < nPairs; k++) {
    const tp = t0 + k * period, tq = tp + deltaT;
    if (Math.max(tp, tq) > limitMs) break;
    pre.push(tp); post.push(tq);
  }
  return { pre, post };
}

function poissonTrain(rateHz: number, durationMs: number, rng: Rng): number[] {
  const out: number[] = [];
  let t = 0;
  for (;;) {
    let u = rng.next();
    while (u <= 1e-300) u = rng.next();
    t += (-Math.log(u) * 1000) / rateHz;
    if (t >= durationMs) return out;
    out.push(t);
  }
}

function runStdp(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(STDP_PARAMS, cfg.params);
  const R: StdpRule = {
    tauPlus: p('tau_plus_STDP'), tauMinus: p('tau_minus_STDP'), aPlus: p('A_plus_STDP'), aMinus: p('A_minus_STDP'),
    wMin: p('w_min'), wMax: p('w_max'), multiplicative: Math.round(p('bounds')) === 1,
    triplet: Math.round(p('rule')) === 1, a3Plus: p('A3_plus'), tauY: p('tau_y'),
  };
  if (!(R.wMax > R.wMin)) throw new SimulationError('ERR_INVALID_PARAMS', 'w_max must be greater than w_min.');
  const protocol = Math.round(p('protocol')), deltaT = p('delta_t'), nPairs = Math.round(p('n_pairs')), freq = p('pair_freq');
  const nSteps = stepCount(cfg);
  const dt = cfg.dtMs;
  const w0 = clamp(cfg.initial.w ?? 0.5, R.wMin, R.wMax);
  const rng = new Rng(cfg.seed);
  let pre: number[], post: number[];
  if (protocol === 0) ({ pre, post } = pairingTrains(deltaT, nPairs, freq, cfg.durationMs));
  else { pre = poissonTrain(p('rate_pre'), cfg.durationMs, rng); post = poissonTrain(p('rate_post'), cfg.durationMs, rng); }
  const rec = makeRecorder(['w', 'x_pre', 'y_post', 'y_slow'], nSteps);
  for (let j = 0; j < rec.n; j++) rec.t[j] = j * rec.stride * dt;
  const wFinal = stdpEvolve(pre, post, w0, R, { t: rec.t, w: rec.s.w!, x: rec.s.x_pre!, y: rec.s.y_post!, ys: rec.s.y_slow!, n: rec.n });
  rec.written = rec.n;
  ctx?.onProgress?.(0.5);
  const { t, series } = finishRecorder(rec);
  const out: ModelOutput = { t, series, curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED' };
  const times = new Float64Array(pre.length + post.length), ids = new Uint32Array(times.length);
  { let a = 0, b = 0, k = 0; while (a < pre.length || b < post.length) { if (b >= post.length || (a < pre.length && pre[a]! <= post[b]!)) { times[k] = pre[a++]!; ids[k++] = 0; } else { times[k] = post[b++]!; ids[k++] = 1; } } }
  out.spikes = { times, ids, n: 2, groups: [{ name: 'Presynaptic', from: 0, to: 1, kind: 'E' }, { name: 'Postsynaptic', from: 1, to: 2, kind: 'E' }] };

  // Timing window from single isolated pairs: simulated with the online trace rule and in closed form.
  const grid: number[] = [];
  for (let d = -100; d <= 100; d += 1) if (d !== 0) grid.push(d);
  const sim = new Float64Array(grid.length), ana = new Float64Array(grid.length), prot = new Float64Array(grid.length);
  let maxErr = 0;
  const refFreq = protocol === 0 ? freq : 1;
  for (let k = 0; k < grid.length; k++) {
    const d = grid[k]!;
    sim[k] = stdpEvolve([200], [200 + d], w0, R) - w0;
    ana[k] = stdpWindow(d, R, w0);
    maxErr = Math.max(maxErr, Math.abs(sim[k]! - ana[k]!));
    const tr = pairingTrains(d, nPairs, refFreq, Infinity);
    prot[k] = (100 * (stdpEvolve(tr.pre, tr.post, w0, R) - w0)) / (w0 || 1);
  }
  const gx = Float64Array.from(grid);
  out.curves.window_sim = { x: gx, y: sim };
  out.curves.window_analytic = { x: Float64Array.from(gx), y: ana };
  out.curves.window_protocol = { x: Float64Array.from(gx), y: prot };
  ctx?.onProgress?.(0.8);
  // Dependence on pairing frequency at Δt = ±10 ms (Sjöström et al. 2001 protocol).
  const freqs = [0.1, 0.5, 1, 2, 5, 10, 20, 30, 40, 50];
  const fPos = new Float64Array(freqs.length), fNeg = new Float64Array(freqs.length);
  freqs.forEach((fq, k) => {
    const a = pairingTrains(10, nPairs, fq, Infinity), b = pairingTrains(-10, nPairs, fq, Infinity);
    fPos[k] = (100 * (stdpEvolve(a.pre, a.post, w0, R) - w0)) / (w0 || 1);
    fNeg[k] = (100 * (stdpEvolve(b.pre, b.post, w0, R) - w0)) / (w0 || 1);
  });
  out.curves.freq_pre_post = { x: Float64Array.from(freqs), y: fPos };
  out.curves.freq_post_pre = { x: Float64Array.from(freqs), y: fNeg };

  const aP = R.multiplicative ? R.aPlus * (R.wMax - w0) : R.aPlus, aM = R.multiplicative ? R.aMinus * (w0 - R.wMin) : R.aMinus;
  out.metrics.finalWeight = wFinal;
  out.metrics.weightChange = wFinal - w0;
  out.metrics.weightChangePct = (100 * (wFinal - w0)) / (w0 || 1);
  out.metrics.pairsDelivered = protocol === 0 ? pre.length : NaN;
  out.metrics.preSpikes = pre.length;
  out.metrics.postSpikes = post.length;
  out.metrics.windowMaxAbsError = maxErr;
  out.metrics.windowIntegral = aP * R.tauPlus - aM * R.tauMinus;
  out.metrics.softBoundFixedPoint = R.multiplicative ? (R.aPlus * R.tauPlus * R.wMax + R.aMinus * R.tauMinus * R.wMin) / (R.aPlus * R.tauPlus + R.aMinus * R.tauMinus) : NaN;
  if (protocol === 1) {
    const T = cfg.durationMs / 1000;
    out.metrics.simulatedDriftPerS = (wFinal - w0) / T;
    out.metrics.expectedDriftPerS = R.triplet ? NaN : p('rate_pre') * p('rate_post') * (aP * R.tauPlus - aM * R.tauMinus) / 1000;
    out.notes.push(`Independent Poisson trains (${pre.length} pre, ${post.length} post spikes): weight drift ${out.metrics.simulatedDriftPerS.toExponential(2)} per second${R.triplet ? '' : `; pair-rule expectation at the initial weight r_pre·r_post·(A₊τ₊ − A₋τ₋) = ${out.metrics.expectedDriftPerS.toExponential(2)} per second`}.`);
  } else {
    if (pre.length < nPairs) out.notes.push(`Only ${pre.length} of ${nPairs} pairings fit into the ${cfg.durationMs} ms run; extend the duration or raise the pairing frequency.`);
    out.notes.push(`${pre.length} pairings at Δt = ${deltaT} ms and ${freq} Hz changed the weight by ${out.metrics.weightChangePct.toFixed(2)}% (${deltaT > 0 ? 'pre before post: potentiation' : deltaT < 0 ? 'post before pre: depression' : 'coincident spikes: no change'}).`);
  }
  out.notes.push(`Online trace rule vs closed-form window for isolated pairs: max |error| = ${maxErr.toExponential(2)}. Window integral A₊τ₊ − A₋τ₋ = ${out.metrics.windowIntegral.toFixed(4)} ms (${out.metrics.windowIntegral < 0 ? 'depression-dominated for uncorrelated firing' : 'potentiation-dominated for uncorrelated firing'}).`);
  if (wFinal <= R.wMin + 1e-12 || wFinal >= R.wMax - 1e-12) out.notes.push('The weight ended on a bound.');
  ctx?.onProgress?.(1);
  return out;
}

export const MODEL_024: ModelDefinition = {
  id: 'MODEL-024',
  name: 'Pair & Triplet STDP',
  equations: [
    '\\Delta w(\\Delta t) = \\begin{cases} +A_+(w)\\,e^{-\\Delta t/\\tau_+}, & \\Delta t = t_{post} - t_{pre} > 0 \\\\ -A_-(w)\\,e^{+\\Delta t/\\tau_-}, & \\Delta t < 0 \\end{cases}',
    '\\frac{dx_{pre}}{dt} = -\\frac{x_{pre}}{\\tau_+} + \\sum_f \\delta(t - t_{pre}^{(f)}), \\qquad \\frac{dy_{post}}{dt} = -\\frac{y_{post}}{\\tau_-} + \\sum_f \\delta(t - t_{post}^{(f)})',
    '\\text{pre spike:}\\; w \\leftarrow w - A_-(w)\\,y_{post}(t^-), \\qquad \\text{post spike:}\\; w \\leftarrow w + A_+(w)\\,x_{pre}(t^-)',
    '\\text{additive: } A_\\pm(w) = \\eta_\\pm, \\; w \\in [w_{min}, w_{max}] \\qquad \\text{multiplicative: } A_+(w) = \\eta_+(w_{max} - w), \\; A_-(w) = \\eta_-(w - w_{min})',
    '\\text{triplet:}\\; \\Delta w_+ = x_{pre}(t)\\left(A_2^+ + A_3^+\\,y_{slow}(t^-)\\right), \\qquad \\frac{dy_{slow}}{dt} = -\\frac{y_{slow}}{\\tau_y} + \\sum_f \\delta(t - t_{post}^{(f)})',
  ],
  params: STDP_PARAMS,
  initial: [{ key: 'w', label: 'Initial weight w(0)', unit: '', default: 0.5 }],
  stimulus: null,
  solvers: ['SOLVER-HYBRID-SPIKE'],
  defaultSolver: 'SOLVER-HYBRID-SPIKE', defaultDtMs: 0.1, minDtMs: 0.01, maxSafeDtMs: 0.5, defaultDurationMs: 12500, maxDurationMs: 20000,
  stochastic: true,
  views: [
    { kind: 'curve', title: 'STDP timing window (one isolated pair)', xLabel: 'Δt = t_post − t_pre (ms)', yLabel: 'Δw', meaning: 'Weight change produced by a single spike pair as a function of spike-time difference: simulated with the online trace rule (points) and from the closed-form exponential window (line).', curves: [{ key: 'window_analytic', label: 'Closed form' }, { key: 'window_sim', label: 'Online trace rule', points: true }] },
    { kind: 'traces', title: 'Synaptic weight', yLabel: 'w', series: [{ key: 'w', label: 'w', unit: '', meaning: 'Synaptic weight during the stimulation protocol.' }] },
    { kind: 'traces', title: 'Eligibility traces', yLabel: 'trace', series: [
      { key: 'x_pre', label: 'x_pre', unit: '', meaning: 'Presynaptic trace: jumps at each presynaptic spike and decays with τ₊.' },
      { key: 'y_post', label: 'y_post', unit: '', meaning: 'Postsynaptic trace: jumps at each postsynaptic spike and decays with τ₋.' },
      { key: 'y_slow', label: 'y_slow', unit: '', meaning: 'Slow postsynaptic trace used by the triplet rule (decays with τ_y).', dashed: true },
    ] },
    { kind: 'raster', title: 'Presynaptic and postsynaptic spikes', meaning: 'Spike times delivered by the protocol: presynaptic neuron below, postsynaptic neuron above.' },
    { kind: 'curve', title: 'Weight change after the full pairing protocol', xLabel: 'Δt (ms)', yLabel: 'Δw (%)', meaning: 'Percentage weight change after all pairings at the selected frequency, as a function of spike-time difference (Bi & Poo protocol).', curves: [{ key: 'window_protocol', label: 'After all pairs' }] },
    { kind: 'curve', title: 'Dependence on pairing frequency', xLabel: 'pairing frequency (Hz)', yLabel: 'Δw (%)', meaning: 'Weight change after the pairing protocol at Δt = +10 ms and −10 ms versus repetition frequency. Only the triplet rule turns high-frequency post→pre pairing into potentiation.', curves: [{ key: 'freq_pre_post', label: 'Δt = +10 ms', points: true }, { key: 'freq_post_pre', label: 'Δt = −10 ms', points: true, dashed: true }] },
  ],
  metrics: [
    { key: 'weightChangePct', label: 'Weight change', unit: '%', description: 'Relative weight change over the run.', digits: 3 },
    { key: 'finalWeight', label: 'Final weight', unit: '', description: 'Synaptic weight at the end of the run.', digits: 4 },
    { key: 'windowMaxAbsError', label: 'Window error vs closed form', unit: '', description: 'Largest absolute difference between the simulated and closed-form single-pair window (VAL-STDP-001 expects < 10⁻⁶).', digits: 12 },
    { key: 'windowIntegral', label: 'Window integral A₊τ₊ − A₋τ₋', unit: 'ms', description: 'Net area of the timing window at the initial weight; negative means uncorrelated firing depresses the synapse.', digits: 4 },
    { key: 'softBoundFixedPoint', label: 'Soft-bound fixed point', unit: '', description: 'Weight at which potentiation and depression balance for uncorrelated firing under multiplicative bounds.', digits: 4 },
    { key: 'pairsDelivered', label: 'Pairings delivered', unit: '', description: 'Number of spike pairs that fit into the run.', digits: 0 },
  ],
  presets: [
    { id: 'ltp', label: 'Pre before post (Δt = +10 ms)', description: '60 pairings potentiate the synapse.', params: { delta_t: 10 }, experimentId: 'EXP-034' },
    { id: 'ltd', label: 'Post before pre (Δt = −10 ms)', description: '60 pairings depress the synapse.', params: { delta_t: -10 }, experimentId: 'EXP-034' },
    { id: 'soft', label: 'Multiplicative soft bounds', description: 'Updates shrink as the weight approaches a bound.', params: { bounds: 1, delta_t: 10 }, experimentId: 'EXP-034' },
    { id: 'triplet', label: 'Triplet rule (visual-cortex minimal model)', description: 'A₂⁺ = 0, A₃⁺ = 6.5×10⁻³, A₂⁻ = 7.1×10⁻³, τ_y = 114 ms: potentiation grows with pairing frequency.', params: { rule: 1, A_plus_STDP: 0, A_minus_STDP: 0.0071, A3_plus: 0.0065, tau_y: 114, pair_freq: 20, delta_t: 10 }, durationMs: 4000 },
    { id: 'poisson', label: 'Uncorrelated Poisson firing', description: 'Independent 10 Hz trains: the weight drifts at the rate set by the window integral.', params: { protocol: 1 }, durationMs: 20000 },
  ],
  sweep: { paramKey: 'delta_t', from: -100, to: 100, steps: 41, metricKey: 'weightChangePct', experimentId: 'EXP-034' },
  kernelLimitations: [
    'A single synapse with prescribed spike times: the postsynaptic neuron is not simulated, so weight changes do not feed back onto firing.',
    'All-to-all spike interactions; nearest-neighbour pairing schemes are not implemented.',
    'The triplet rule uses the minimal Pfister–Gerstner form (no presynaptic triplet term A₃⁻).',
    'Exactly coincident pre and post spikes (Δt = 0) produce no change.',
  ],
  run: runStdp,
};

// ───────────────────────── MODEL-025 homeostatic synaptic scaling ─────────────────────────

const HOMEO_PARAMS: ParamSpec[] = [
  { key: 'r_target_Homeo', label: 'Target firing rate', symbol: 'r_{target}', unit: 'Hz', default: 5, min: 0.5, max: 50, step: 0.5, registryId: 'PARAM-074', description: 'Set point that the slow sensor tries to restore.', group: 'Homeostasis' },
  { key: 'tau_H_Homeo', label: 'Scaling time constant', symbol: '\\tau_H', unit: 'ms', default: 5000, min: 200, max: 50000, step: 100, registryId: 'PARAM-075', description: 'Time scale of weight scaling. Accelerated for teaching: biological scaling takes hours to days.', group: 'Homeostasis' },
  { key: 'tau_r', label: 'Rate-sensor time constant', symbol: '\\tau_r', unit: 'ms', default: 1000, min: 50, max: 10000, step: 50, description: 'Averaging time of the activity sensor (a proxy for somatic calcium).', group: 'Homeostasis' },
  { key: 'gamma_H', label: 'Scaling gain', symbol: '\\gamma_H', unit: '1/Hz', default: 0.25, min: 0.01, max: 5, step: 0.01, description: 'Fractional weight change per unit of rate error. Large values make the feedback loop ring.', group: 'Homeostasis' },
  { key: 'scaling_mode', label: 'Scaling mode', symbol: '', unit: '', default: 0, min: 0, max: 1, step: 1, integer: true, description: 'Multiplicative scaling preserves weight ratios; additive adjustment (shown for contrast) does not.', group: 'Homeostasis', options: [{ value: 0, label: 'Multiplicative (synaptic scaling)' }, { value: 1, label: 'Additive (contrast case)' }] },
  { key: 'n_syn', label: 'Number of synapses', symbol: 'n', unit: '', default: 8, min: 2, max: 200, step: 1, integer: true, description: 'Excitatory synapses onto the neuron.', group: 'Synapses' },
  { key: 'w_spread', label: 'Relative weight spread', symbol: 's', unit: '', default: 0.6, min: 0, max: 0.95, step: 0.05, description: 'Initial weights are spaced evenly between (1 − s) and (1 + s) times the mean, standing for differences left by earlier Hebbian learning.', group: 'Synapses' },
  { key: 'w_max', label: 'Maximum weight', symbol: 'w_{max}', unit: '', default: 10, min: 1, max: 100, step: 0.5, description: 'Hard upper bound on each weight.', group: 'Synapses' },
  { key: 'x_in', label: 'Afferent rate per synapse', symbol: 'x', unit: 'Hz', default: 1.25, min: 0.05, max: 20, step: 0.05, description: 'Presynaptic firing rate at every synapse before the perturbation.', group: 'Input' },
  { key: 'input_scale', label: 'Input perturbation factor', symbol: 'k', unit: '', default: 0.5, min: 0, max: 4, step: 0.05, description: 'Factor applied to all afferent rates at the perturbation time (0.5 = deprivation, 2 = hyperdrive).', group: 'Input' },
  { key: 't_perturb', label: 'Perturbation time', symbol: 't_p', unit: 'ms', default: 5000, min: 0, max: 50000, step: 100, description: 'Time at which the afferent rates change.', group: 'Input' },
];

function runHomeo(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(HOMEO_PARAMS, cfg.params);
  const rT = p('r_target_Homeo'), tauH = p('tau_H_Homeo'), tauR = p('tau_r'), gamma = p('gamma_H'), additive = Math.round(p('scaling_mode')) === 1;
  const n = Math.round(p('n_syn')), spread = p('w_spread'), wMax = p('w_max'), xIn = p('x_in'), scale = p('input_scale'), tP = p('t_perturb');
  const wMean = cfg.initial.w_mean ?? 0.5;
  const w0 = Float64Array.from({ length: n }, (_, j) => Math.min(wMax, wMean * (1 + spread * (n === 1 ? 0 : (2 * j) / (n - 1) - 1))));
  const mean0 = w0.reduce((a, b) => a + b, 0) / n;
  const y0 = new Float64Array(n + 1);
  y0[0] = cfg.initial.r_bar ?? 5;
  y0.set(w0, 1);
  const rate = (t: number, y: Float64Array) => { let s = 0; for (let j = 1; j <= n; j++) s += y[j]!; return s * xIn * (t >= tP ? scale : 1); };
  const deriv: Deriv = (t, y, d) => {
    const err = (gamma * (rT - y[0]!)) / tauH;
    d[0] = (-y[0]! + rate(t, y)) / tauR;
    for (let j = 1; j <= n; j++) {
      const w = y[j]!;
      let dw = additive ? err * mean0 : err * w;
      if ((w >= wMax && dw > 0) || (w <= 0 && dw < 0)) dw = 0;
      d[j] = dw;
    }
  };
  const res = runOde({
    cfg, ctx, y0, deriv, recordKeys: ['S', 'r_bar', 'target', 'scale', 'w_lo', 'w_hi', 'ratio'],
    project: (y) => { for (let j = 1; j <= n; j++) { const w = y[j]!; if (w > wMax) y[j] = wMax; else if (w < 0) y[j] = 0; } },
    record: (j, t, y, s) => {
      let sum = 0;
      for (let q = 1; q <= n; q++) sum += y[q]!;
      s.S![j] = rate(t, y); s.r_bar![j] = y[0]!; s.target![j] = rT; s.scale![j] = sum / n / mean0;
      s.w_lo![j] = y[1]!; s.w_hi![j] = y[n]!; s.ratio![j] = y[1]! > 0 ? y[n]! / y[1]! : NaN;
    },
  });
  const out: ModelOutput = { t: res.t, series: res.series, curves: {}, matrices: {}, metrics: {}, notes: [], status: res.status };
  if (res.failedAtMs !== undefined) { out.failedAtMs = res.failedAtMs; out.notes.push(DIVERGENCE_NOTE); }
  const wF = res.yFinal.subarray(1);
  const idx = Float64Array.from({ length: n }, (_, j) => j + 1);
  const drive0 = n * mean0 * xIn;
  const needed = drive0 * scale > 0 ? rT / (drive0 * scale) : NaN;
  out.curves.weights_initial = { x: idx, y: Float64Array.from(w0) };
  out.curves.weights_final = { x: Float64Array.from(idx), y: Float64Array.from(wF) };
  out.curves.weights_predicted = { x: Float64Array.from(idx), y: Float64Array.from(w0, (v) => Math.min(wMax, v * needed)) };
  const last = res.t.length - 1;
  let ratioDrift = 0;
  for (let j = 1; j < n; j++) { const r0 = w0[j]! / w0[0]!, r1 = wF[j]! / wF[0]!; ratioDrift = Math.max(ratioDrift, Math.abs(r1 - r0) / r0); }
  // Recovery time: last moment after the perturbation at which the rate was outside ±5% of the target.
  let lastOutside = NaN;
  for (let i = 0; i <= last; i++) if (res.t[i]! >= tP && Math.abs(res.series.S![i]! - rT) > 0.05 * rT) lastOutside = res.t[i]!;
  const recovered = Math.abs(res.series.S![last]! - rT) <= 0.05 * rT;
  out.metrics.finalRateHz = res.series.S![last]!;
  out.metrics.rateErrorHz = res.series.S![last]! - rT;
  out.metrics.scaleFactor = res.series.scale![last]!;
  out.metrics.requiredScaleFactor = needed;
  out.metrics.ratioDrift = ratioDrift;
  out.metrics.recoveryTimeMs = recovered ? (Number.isNaN(lastOutside) ? 0 : lastOutside - tP) : NaN;
  out.metrics.dampingRatio = 0.5 * Math.sqrt(tauH / (gamma * rT * tauR));
  out.metrics.rateAfterPerturbationHz = drive0 * scale;
  out.notes.push(`Afferent rates were multiplied by ${scale} at ${tP} ms, which would leave the neuron at ${(drive0 * scale).toFixed(2)} Hz. ${recovered ? `Scaling restored ${out.metrics.finalRateHz.toFixed(2)} Hz (target ${rT} Hz) by multiplying the mean weight by ${out.metrics.scaleFactor.toFixed(3)} (required ${Number.isFinite(needed) ? needed.toFixed(3) : 'n/a'}).` : `The rate is ${out.metrics.finalRateHz.toFixed(2)} Hz at the end of the run and has not yet returned to the ${rT} Hz target.`}`);
  out.notes.push(additive
    ? `Additive adjustment changed the ratio between the strongest and weakest weight by up to ${(100 * ratioDrift).toFixed(1)}%: relative synaptic strengths are not preserved.`
    : `Multiplicative scaling preserved the weight ratios (largest relative change ${ratioDrift.toExponential(1)}).`);
  if (out.metrics.dampingRatio < 1) out.notes.push(`Feedback loop is underdamped (ζ = ${out.metrics.dampingRatio.toFixed(2)}): the rate overshoots the target before settling.`);
  return out;
}

export const MODEL_025: ModelDefinition = {
  id: 'MODEL-025',
  name: 'Homeostatic Synaptic Scaling',
  equations: [
    'S(t) = \\sum_{j=1}^{n} w_j\\,x_j(t)',
    '\\tau_r \\frac{d\\bar{r}}{dt} = -\\bar{r} + S(t)',
    '\\tau_H \\frac{dw_j}{dt} = \\gamma_H\\left(r_{target} - \\bar{r}\\right) w_j, \\qquad w_j \\in [0, w_{max}]',
    '\\zeta = \\tfrac{1}{2}\\sqrt{\\frac{\\tau_H}{\\gamma_H\\,r_{target}\\,\\tau_r}} \\quad \\text{(damping ratio of the linearized loop)}',
  ],
  params: HOMEO_PARAMS,
  initial: [
    { key: 'r_bar', label: 'Rate sensor r̄(0)', unit: 'Hz', default: 5 },
    { key: 'w_mean', label: 'Mean initial weight', unit: '', default: 0.5 },
  ],
  stimulus: null,
  solvers: ['SOLVER-RK4', 'SOLVER-FE'],
  defaultSolver: 'SOLVER-RK4', defaultDtMs: 1, minDtMs: 0.1, maxSafeDtMs: 5, defaultDurationMs: 20000, maxDurationMs: 50000,
  stochastic: false,
  views: [
    { kind: 'traces', title: 'Firing rate and slow sensor', yLabel: 'rate (Hz)', series: [
      { key: 'S', label: 'S(t)', unit: 'Hz', meaning: 'Instantaneous postsynaptic firing rate.' },
      { key: 'r_bar', label: 'r̄', unit: 'Hz', meaning: 'Slow activity sensor that drives scaling.' },
      { key: 'target', label: 'target', unit: 'Hz', meaning: 'Homeostatic set point.', dashed: true },
    ] },
    { kind: 'traces', title: 'Mean weight relative to its initial value', yLabel: 'scale factor', series: [{ key: 'scale', label: '⟨w⟩ / ⟨w₀⟩', unit: '', meaning: 'Common factor by which the synaptic weights have been scaled.' }] },
    { kind: 'curve', title: 'Synaptic weights before and after scaling', xLabel: 'synapse', yLabel: 'weight', meaning: 'Each synapse before the run, at the end of the run, and the prediction from multiplying every initial weight by the same factor.', curves: [{ key: 'weights_initial', label: 'Initial', points: true }, { key: 'weights_final', label: 'Final', points: true }, { key: 'weights_predicted', label: 'Initial × required factor', dashed: true }] },
    { kind: 'traces', title: 'Ratio of strongest to weakest weight', yLabel: 'w_n / w_1', series: [{ key: 'ratio', label: 'w_n / w_1', unit: '', meaning: 'Stays constant under multiplicative scaling, so the information stored in relative weights survives.' }] },
  ],
  metrics: [
    { key: 'finalRateHz', label: 'Final firing rate', unit: 'Hz', description: 'Postsynaptic rate at the end of the run.' },
    { key: 'scaleFactor', label: 'Weight scale factor', unit: '', description: 'Final mean weight divided by initial mean weight.', digits: 4 },
    { key: 'requiredScaleFactor', label: 'Required scale factor', unit: '', description: 'Factor that exactly restores the target rate after the perturbation.', digits: 4 },
    { key: 'ratioDrift', label: 'Weight-ratio drift', unit: '', description: 'Largest relative change of any weight ratio w_j / w_1; 0 means relative strengths are preserved.', digits: 6 },
    { key: 'recoveryTimeMs', label: 'Recovery time', unit: 'ms', description: 'Time after the perturbation until the rate stays within 5% of the target.' },
    { key: 'dampingRatio', label: 'Loop damping ratio ζ', unit: '', description: 'Below 1 the homeostatic loop overshoots; above 1 it approaches the target monotonically.', digits: 3 },
  ],
  presets: [
    { id: 'deprive', label: 'Input deprivation (×0.5)', description: 'Halving the afferent rate triggers upscaling of all weights.', params: { input_scale: 0.5 }, experimentId: 'EXP-035' },
    { id: 'hyper', label: 'Hyperdrive (×2)', description: 'Doubling the afferent rate triggers downscaling.', params: { input_scale: 2 }, experimentId: 'EXP-035' },
    { id: 'additive', label: 'Additive adjustment (contrast)', description: 'Restores the rate but distorts relative weights.', params: { scaling_mode: 1, input_scale: 0.5 }, experimentId: 'EXP-035' },
    { id: 'ringing', label: 'High gain: ringing', description: 'A strong, fast controller overshoots and oscillates around the target.', params: { gamma_H: 2, input_scale: 0.5 } },
  ],
  sweep: { paramKey: 'input_scale', from: 0.25, to: 2, steps: 8, metricKey: 'scaleFactor', experimentId: 'EXP-035' },
  kernelLimitations: [
    'Linear rate neuron: the output rate is the weighted sum of afferent rates, with no threshold or saturation.',
    'Time scales are accelerated (seconds) so the effect is visible in a browser run; biological synaptic scaling develops over hours to days.',
    'All synapses share one postsynaptic sensor; input-specific or local dendritic homeostasis is not modelled.',
  ],
  run: runHomeo,
};

// ───────────────────────── MODEL-026 dopamine reward-prediction error (TD learning) ─────────────────────────

const TD_PARAMS: ParamSpec[] = [
  { key: 'alpha_TDRL', label: 'Learning rate', symbol: '\\alpha', unit: '', default: 0.15, min: 0.01, max: 1, step: 0.01, registryId: 'PARAM-076', description: 'Fraction of the prediction error used to update the value weights (η_DA of the three-factor rule).', group: 'Learning' },
  { key: 'gamma_TDRL', label: 'Discount factor', symbol: '\\gamma', unit: '', default: 0.95, min: 0.5, max: 1, step: 0.005, registryId: 'PARAM-077', description: 'Discount applied per time bin to future reward.', group: 'Learning' },
  { key: 'tau_e_TDRL', label: 'Eligibility-trace time constant', symbol: '\\tau_e', unit: 'ms', default: 1000, min: 1, max: 5000, step: 10, registryId: 'PARAM-078', description: 'How long a synapse stays eligible for dopamine-gated change after it was active. Very short values give one-step TD(0) learning.', group: 'Learning' },
  { key: 'bin_ms', label: 'Time-bin width', symbol: '\\Delta', unit: 'ms', default: 100, min: 20, max: 500, step: 10, description: 'Width of one state of the within-trial time representation.', group: 'Trial structure' },
  { key: 't_cs', label: 'Cue (CS) onset', symbol: 't_{CS}', unit: 'ms', default: 500, min: 100, max: 5000, step: 50, description: 'Time of the conditioned stimulus within the trial.', group: 'Trial structure' },
  { key: 't_us', label: 'Reward (US) time', symbol: 't_{US}', unit: 'ms', default: 1500, min: 200, max: 10000, step: 50, description: 'Time of reward delivery within the trial.', group: 'Trial structure' },
  { key: 'trial_ms', label: 'Trial length', symbol: 'T', unit: 'ms', default: 2500, min: 500, max: 15000, step: 100, description: 'Duration of one trial; trials are separated by a long unpredictable interval.', group: 'Trial structure' },
  { key: 'reward', label: 'Reward magnitude', symbol: 'r', unit: '', default: 1, min: 0, max: 5, step: 0.1, description: 'Size of the reward delivered at the US time.', group: 'Reward' },
  { key: 'p_reward', label: 'Reward probability', symbol: 'p', unit: '', default: 1, min: 0, max: 1, step: 0.05, description: 'Probability that a trial is rewarded (values below 1 give partial reinforcement).', group: 'Reward' },
  { key: 'omission', label: 'Omission probe', symbol: '', unit: '', default: 1, min: 0, max: 1, step: 1, integer: true, description: 'Withhold the reward on the final trial to probe the negative prediction error.', group: 'Reward', options: [{ value: 0, label: 'No probe' }, { value: 1, label: 'Omit reward on the final trial' }] },
];

function runTd(cfg: RunConfig, ctx?: RunContext): ModelOutput {
  const p = paramReader(TD_PARAMS, cfg.params);
  const alpha = p('alpha_TDRL'), gamma = p('gamma_TDRL'), tauE = p('tau_e_TDRL'), bin = p('bin_ms');
  const R = p('reward'), pR = p('p_reward'), omit = Math.round(p('omission')) === 1;
  const J = Math.round(p('trial_ms') / bin), jCS = Math.round(p('t_cs') / bin), jUS = Math.round(p('t_us') / bin);
  const trials = Math.round(cfg.durationMs);
  if (!(jCS >= 1 && jUS > jCS && jUS < J)) throw new SimulationError('ERR_INVALID_PARAMS', 'Trial timing must satisfy 0 < t_CS < t_US < trial length, each separated by at least one time bin.');
  if (trials < 2) throw new SimulationError('ERR_INVALID_PARAMS', 'At least two trials are required.');
  if (J > 500) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'More than 500 within-trial states; increase the bin width or shorten the trial.');
  if (trials > 5000) throw new SimulationError('ERR_ENVELOPE_EXCEEDED', 'More than 5,000 trials requested.');
  const rng = new Rng(cfg.seed);
  const K = J - jCS;
  const w = new Float64Array(K), e = new Float64Array(K);
  const decay = Math.exp(-bin / tauE);
  const V = (j: number) => (j >= jCS && j < J ? w[j - jCS]! : 0);
  const dMap = new Float64Array(J * trials), vMap = new Float64Array(J * trials);
  const dCS = new Float64Array(trials), dUS = new Float64Array(trials), vCS = new Float64Array(trials), vPre = new Float64Array(trials), rew = new Float64Array(trials);
  let lastRewarded = -1;
  for (let n = 0; n < trials; n++) {
    const probe = omit && n === trials - 1;
    const rewarded = !probe && (pR >= 1 || rng.next() < pR);
    if (rewarded) lastRewarded = n;
    rew[n] = rewarded ? R : 0;
    for (let j = 0; j < J; j++) vMap[j * trials + n] = V(j);
    vCS[n] = V(jCS); vPre[n] = V(jUS - 1);
    e.fill(0);
    for (let j = 1; j < J; j++) {
      // Transition (j − 1) → j: the state just left becomes eligible, then the prediction error updates all eligible weights.
      for (let k = 0; k < K; k++) e[k] = e[k]! * decay;
      if (j - 1 >= jCS) e[j - 1 - jCS] = e[j - 1 - jCS]! + 1;
      const delta = (j === jUS && rewarded ? R : 0) + gamma * V(j) - V(j - 1);
      dMap[j * trials + n] = delta;
      if (j === jCS) dCS[n] = delta;
      if (j === jUS) dUS[n] = delta;
      if (delta !== 0) for (let k = 0; k < K; k++) w[k] = w[k]! + alpha * delta * e[k]!;
    }
    if (ctx?.onProgress && n % 50 === 0) ctx.onProgress(n / trials);
  }
  const tAxis = Float64Array.from({ length: trials }, (_, n) => n + 1);
  const within = Float64Array.from({ length: J }, (_, j) => j * bin);
  const col = (m: Float64Array, n: number) => Float64Array.from({ length: J }, (_, j) => m[j * trials + n]!);
  const out: ModelOutput = {
    t: tAxis, series: { delta_CS: dCS, delta_US: dUS, V_CS: vCS, V_preUS: vPre, reward: rew },
    curves: {}, matrices: {}, metrics: {}, notes: [], status: 'COMPLETED',
  };
  const labels = Array.from({ length: J }, (_, j) => `${j * bin} ms`);
  out.matrices.delta_map = { rows: J, cols: trials, data: dMap, rowLabels: labels };
  out.matrices.value_map = { rows: J, cols: trials, data: vMap, rowLabels: labels };
  out.curves.delta_first = { x: within, y: col(dMap, 0) };
  if (lastRewarded >= 0) out.curves.delta_trained = { x: Float64Array.from(within), y: col(dMap, lastRewarded) };
  if (omit) out.curves.delta_omission = { x: Float64Array.from(within), y: col(dMap, trials - 1) };
  out.curves.value_final = { x: Float64Array.from(within), y: Float64Array.from({ length: J }, (_, j) => V(j)) };
  out.curves.value_theory = { x: Float64Array.from(within), y: Float64Array.from({ length: J }, (_, j) => (j >= jCS && j < jUS ? pR * R * Math.pow(gamma, jUS - 1 - j) : 0)) };
  const csTheory = pR * R * Math.pow(gamma, jUS - jCS);
  let firstRewarded = -1;
  for (let n = 0; n < trials; n++) if (rew[n]! > 0) { firstRewarded = n; break; }
  // Means over the last third of the rewarded trials (equal to the trained values when every trial is rewarded).
  const rewardedIdx: number[] = [];
  for (let n = 0; n < trials; n++) if (rew[n]! > 0) rewardedIdx.push(n);
  const late = rewardedIdx.slice(Math.floor((2 * rewardedIdx.length) / 3));
  const meanAt = (a: Float64Array) => (late.length ? late.reduce((s, n) => s + a[n]!, 0) / late.length : NaN);
  out.metrics.deltaUsFirst = firstRewarded >= 0 ? dUS[firstRewarded]! : NaN;
  out.metrics.deltaCsFirst = dCS[0]!;
  out.metrics.deltaCsLateMean = meanAt(dCS);
  out.metrics.deltaUsLateMean = meanAt(dUS);
  out.metrics.deltaUsTheory = (1 - pR) * R;
  out.metrics.deltaCsTrained = lastRewarded >= 0 ? dCS[lastRewarded]! : NaN;
  out.metrics.deltaUsTrained = lastRewarded >= 0 ? dUS[lastRewarded]! : NaN;
  out.metrics.deltaOmission = omit ? dUS[trials - 1]! : NaN;
  out.metrics.deltaCsTheory = csTheory;
  out.metrics.effectiveLambda = Math.min(1, decay / gamma);
  let transfer = NaN;
  for (let n = 0; n < trials; n++) if (rew[n]! > 0 && dCS[n]! > dUS[n]!) { transfer = n + 1; break; }
  out.metrics.transferTrial = transfer;
  out.metrics.rewardedTrials = rew.reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
  if (firstRewarded >= 0) out.notes.push(`First rewarded trial (${firstRewarded + 1}): the ${firstRewarded === 0 ? 'unpredicted' : 'still poorly predicted'} reward produces a prediction error of ${dUS[firstRewarded]!.toFixed(3)} at the reward time and ${dCS[firstRewarded]!.toFixed(3)} at the cue.`);
  if (lastRewarded >= 0 && pR >= 1) out.notes.push(`Last rewarded trial (${lastRewarded + 1}): the error has moved to the cue (δ_CS = ${dCS[lastRewarded]!.toFixed(3)}, theory r·γ^n = ${csTheory.toFixed(3)}) and the fully predicted reward evokes δ_US = ${dUS[lastRewarded]!.toFixed(3)}.`);
  if (lastRewarded >= 0 && pR < 1) out.notes.push(`Partial reinforcement (p = ${pR}): over the last third of rewarded trials the mean error is ${out.metrics.deltaCsLateMean.toFixed(3)} at the cue (theory p·r·γ^n = ${csTheory.toFixed(3)}) and ${out.metrics.deltaUsLateMean.toFixed(3)} at the reward (theory (1 − p)·r = ${((1 - pR) * R).toFixed(3)}); a reward that is only sometimes delivered is never fully predicted.`);
  if (omit) out.notes.push(`Omission probe (trial ${trials}): withholding the expected reward gives a negative error δ = ${dUS[trials - 1]!.toFixed(3)} at the usual reward time (a dopamine pause).`);
  if (Number.isFinite(transfer)) out.notes.push(`The cue response first exceeded the reward response on trial ${transfer}.`);
  ctx?.onProgress?.(1);
  return out;
}

export const MODEL_026: ModelDefinition = {
  id: 'MODEL-026',
  name: 'Dopamine Reward-Prediction Error (TD Learning)',
  equations: [
    '\\delta_t = r_t + \\gamma\\,V(s_{t+1}) - V(s_t)',
    'V(s_t) = \\mathbf{w}^\\top \\mathbf{x}(s_t), \\qquad x_k(s_t) = 1 \\text{ if } t - t_{CS} = k\\Delta \\; (\\text{complete serial compound})',
    '\\mathbf{e} \\leftarrow e^{-\\Delta/\\tau_e}\\,\\mathbf{e} + \\mathbf{x}(s_t), \\qquad \\mathbf{w} \\leftarrow \\mathbf{w} + \\alpha\\,\\delta_t\\,\\mathbf{e}',
    '\\frac{de_{ij}}{dt} = -\\frac{e_{ij}}{\\tau_e} + \\mathrm{Hebb}(r_j, r_i), \\qquad \\frac{dw_{ij}}{dt} = \\eta_{DA}\\,\\delta_{DA}(t)\\,e_{ij}(t)',
  ],
  params: TD_PARAMS,
  initial: [],
  stimulus: null,
  solvers: ['SOLVER-FE'],
  defaultSolver: 'SOLVER-FE', defaultDtMs: 1, minDtMs: 1, maxSafeDtMs: 1, defaultDurationMs: 60, maxDurationMs: 2000,
  timeUnit: 'trials',
  stochastic: true,
  views: [
    { kind: 'matrix', title: 'Prediction error δ across learning', key: 'delta_map', xLabel: 'trial →', yLabel: 'time within trial', diverging: true, meaning: 'Reward-prediction error at every time bin (rows) of every trial (columns). The positive band starts at the reward time and migrates to the cue; the final column shows the negative dip of the omission probe.' },
    { kind: 'traces', title: 'Prediction error at the cue and at the reward', yLabel: 'δ', series: [
      { key: 'delta_CS', label: 'δ at CS', unit: '', meaning: 'Prediction error when the cue appears: grows as the cue comes to predict reward.' },
      { key: 'delta_US', label: 'δ at US', unit: '', meaning: 'Prediction error at the reward time: shrinks as the reward becomes predicted, negative when an expected reward is omitted.' },
    ] },
    { kind: 'curve', title: 'Within-trial prediction error', xLabel: 'time within trial (ms)', yLabel: 'δ', meaning: 'Time course of the prediction error on the first trial, the last rewarded trial and the omission probe.', curves: [{ key: 'delta_first', label: 'First trial', points: true }, { key: 'delta_trained', label: 'After learning', points: true }, { key: 'delta_omission', label: 'Reward omitted', points: true, dashed: true }] },
    { kind: 'curve', title: 'Learned value function', xLabel: 'time within trial (ms)', yLabel: 'V', meaning: 'Predicted discounted future reward at each time in the trial, with the theoretical value p·r·γ^(steps to reward).', curves: [{ key: 'value_final', label: 'Learned V', points: true }, { key: 'value_theory', label: 'Theory', dashed: true }] },
    { kind: 'matrix', title: 'Value function across learning', key: 'value_map', xLabel: 'trial →', yLabel: 'time within trial', meaning: 'Value at each time bin at the start of each trial; value spreads backward from the reward to the cue.' },
  ],
  metrics: [
    { key: 'deltaUsFirst', label: 'δ at reward, first rewarded trial', unit: '', description: 'Response to the first reward (equals the reward magnitude when it comes on trial 1).', digits: 3 },
    { key: 'deltaCsTrained', label: 'δ at cue, after learning', unit: '', description: 'Cue response on the last rewarded trial.', digits: 3 },
    { key: 'deltaUsTrained', label: 'δ at reward, after learning', unit: '', description: 'Response to the fully predicted reward on the last rewarded trial (approaches 0).', digits: 3 },
    { key: 'deltaOmission', label: 'δ at omitted reward', unit: '', description: 'Prediction error at the reward time on the omission probe (negative).', digits: 3 },
    { key: 'deltaCsTheory', label: 'Theoretical cue response', unit: '', description: 'Asymptotic δ at the cue, p·r·γ^n for n bins between cue and reward.', digits: 3 },
    { key: 'deltaUsLateMean', label: 'Mean δ at reward, late trials', unit: '', description: 'Mean error at the reward over the last third of rewarded trials; (1 − p)·r under partial reinforcement.', digits: 3 },
    { key: 'transferTrial', label: 'Transfer trial', unit: '', description: 'First trial on which the cue response exceeds the reward response.', digits: 0 },
    { key: 'effectiveLambda', label: 'Effective λ', unit: '', description: 'TD(λ) trace parameter implied by τ_e, the bin width and γ.', digits: 3 },
  ],
  presets: [
    { id: 'conditioning', label: 'Pavlovian conditioning with omission probe', description: 'The error transfers from reward to cue; omitting the reward gives a negative dip.', experimentId: 'EXP-036' },
    { id: 'td0', label: 'TD(0): error creeps backward', description: 'Without an eligibility trace the error moves back one time bin per trial.', params: { tau_e_TDRL: 5 }, durationMs: 200, experimentId: 'EXP-036' },
    { id: 'partial', label: 'Partial reinforcement (p = 0.5)', description: 'The reward is never fully predicted, so a positive error at reward persists.', params: { p_reward: 0.5, omission: 0 }, durationMs: 300, experimentId: 'EXP-036' },
  ],
  sweep: { paramKey: 'alpha_TDRL', from: 0.05, to: 0.5, steps: 10, metricKey: 'transferTrial', experimentId: 'EXP-036' },
  kernelLimitations: [
    'The time axis counts trials; within a trial time is discretized into bins and the run duration sets the number of trials.',
    'Complete-serial-compound (tapped delay line) stimulus representation: each time after the cue has its own weight.',
    'δ is the model\'s prediction error, proposed to be signalled by phasic dopamine; it is not a calibrated firing rate.',
    'Pavlovian prediction only: there is no action selection, and the interval between trials is assumed long and unpredictable so the cue itself is never predicted.',
  ],
  run: runTd,
};
