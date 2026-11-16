// Integrated Experiment C (EXP-042): macroscopic connectome coupling & conduction delays → coupled neural
// oscillations → spectral & phase-locking functional connectivity analytics.
// Stage 1 builds the synthetic 68-region Desikan–Killiany structural graph (MODEL-028). Stage 2 integrates
// 68 delay-coupled Kuramoto phase oscillators (MODEL-027) with distance-dependent delays τ_ij = d_ij / v.
// Stage 3 analyses the mean-field spectrum and pairwise Phase-Locking Value (PLV) matrix via Module 11.
// Both conditions share the exact same graph, natural frequencies, initial phases and noise seed.
import { bandPower, peakFrequency, welchPsd } from '../analytics/fft';
import { Rng } from '../core/prng';
import type { ModelOutput, ParamSpec } from '../core/types';
import { upperTriangleCorrelation } from '../models/connectome';
import { syntheticConnectome68 } from '../models/graphs';
import { reader, type TwinDefinition, type TwinResult } from './common';

const PARAMS: ParamSpec[] = [
  { key: 'G_base', label: 'Global coupling (baseline)', symbol: 'G^{base}', unit: 'rad/s', default: 1.5, min: 0, max: 25, step: 0.25, description: 'Global coupling gain in the baseline condition (subcritical regime).', group: 'Baseline' },
  { key: 'v_base', label: 'Conduction velocity (baseline)', symbol: 'v^{base}', unit: 'm/s', default: 15, min: 1, max: 30, step: 0.5, description: 'Axonal conduction velocity converting inter-regional distance into delays in the baseline condition.', group: 'Baseline' },
  { key: 'G_int', label: 'Global coupling (intervention)', symbol: 'G^{int}', unit: 'rad/s', default: 10, min: 0, max: 25, step: 0.25, description: 'Global coupling gain in the intervention condition (above synchronization onset).', group: 'Intervention' },
  { key: 'v_int', label: 'Conduction velocity (intervention)', symbol: 'v^{int}', unit: 'm/s', default: 6, min: 1, max: 30, step: 0.5, description: 'Axonal conduction velocity in the intervention condition; slower conduction increases delay-induced phase shifts.', group: 'Intervention' },
  { key: 'f0', label: 'Mean intrinsic frequency', symbol: 'f_0', unit: 'Hz', default: 10, min: 4, max: 50, step: 0.5, description: 'Mean intrinsic regional frequency (10 Hz = canonical alpha band).', group: 'Oscillators' },
  { key: 'sigma_omega', label: 'Frequency spread', symbol: '\\sigma_\\omega', unit: 'rad/s', default: 1.5, min: 0.1, max: 8, step: 0.1, description: 'Standard deviation of intrinsic regional angular frequencies across the 68 regions.', group: 'Oscillators' },
  { key: 'sigma_noise', label: 'Phase noise amplitude', symbol: '\\sigma', unit: 'rad/√s', default: 0.3, min: 0, max: 3, step: 0.05, description: 'Amplitude of independent white phase noise per region.', group: 'Oscillators' },
  { key: 'duration', label: 'Simulation duration', symbol: 'T', unit: 'ms', default: 4000, min: 1500, max: 10000, step: 500, description: 'Simulated time per condition (first 1000 ms excluded from steady-state PLV/PSD).', group: 'Run' },
];

function runCondition(
  G: number,
  velocityMs: number,
  f0: number,
  sigmaOmega: number,
  sigmaNoise: number,
  durationMs: number,
  seed: number,
  onProgress?: (f: number) => void,
): ModelOutput {
  const g = syntheticConnectome68(seed);
  const n = g.n;
  const W = g.weights;
  const dist = g.distances!;
  const labels = g.labels ?? Array.from({ length: n }, (_, i) => `R${i + 1}`);
  const dt = 0.5;
  const h = dt / 1000;
  const nSteps = Math.round(durationMs / dt);

  // Build row-normalized sparse coupling so G is directly comparable to frequency dispersion.
  const rowSum = new Float64Array(n);
  let nnz = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      const w = W[i * n + j]!;
      if (w > 0) { s += w; nnz++; }
    }
    rowSum[i] = s || 1;
  }
  const rowPtr = new Uint32Array(n + 1);
  const colIdx = new Uint32Array(nnz);
  const vals = new Float64Array(nnz);
  const dSteps = new Int32Array(nnz);
  let maxDelaySteps = 0;
  let delaySum = 0;
  for (let i = 0, q = 0; i < n; i++) {
    rowPtr[i] = q;
    for (let j = 0; j < n; j++) {
      const w = W[i * n + j]!;
      if (w > 0) {
        colIdx[q] = j;
        vals[q] = w / rowSum[i]!;
        const delayMs = dist[i * n + j]! / velocityMs; // mm / (m/s) = ms
        const ds = Math.max(0, Math.round(delayMs / dt));
        dSteps[q] = ds;
        delaySum += delayMs;
        if (ds > maxDelaySteps) maxDelaySteps = ds;
        q++;
      }
    }
  }
  rowPtr[n] = nnz;
  const meanDelayMs = nnz > 0 ? delaySum / nnz : 0;

  const rng = new Rng(seed ^ 0x9e3779b9);
  const omega = new Float64Array(n);
  const theta = new Float64Array(n);
  const w0 = 2 * Math.PI * f0;
  for (let i = 0; i < n; i++) {
    omega[i] = w0 + sigmaOmega * rng.normal();
    theta[i] = 2 * Math.PI * rng.next();
  }

  const K = maxDelaySteps + 1;
  const hist = new Float64Array(K * n);
  for (let s = 0; s < K; s++) hist.set(theta, s * n);

  const sampleStep = Math.max(1, Math.round(4 / dt)); // 250 Hz sampling
  const nRec = Math.floor(nSteps / sampleStep) + 1;
  const tArr = new Float64Array(nRec);
  const rArr = new Float64Array(nRec);
  const mfArr = new Float64Array(nRec);
  const mfImgArr = new Float64Array(nRec);

  const frames = Math.min(240, nRec);
  const frameStep = Math.max(1, Math.floor(nRec / frames));
  const activity = new Float64Array(n * frames);

  // Accumulate pairwise exp(i(θ_i - θ_j)) = (cos θ_i cos θ_j + sin θ_i sin θ_j) + i(sin θ_i cos θ_j - cos θ_i sin θ_j)
  const transientSteps = Math.min(Math.floor(nSteps * 0.4), Math.round(1000 / dt));
  const plvCos = new Float64Array(n * n);
  const plvSin = new Float64Array(n * n);
  const cosBuf = new Float64Array(n);
  const sinBuf = new Float64Array(n);
  let plvSamples = 0;

  const dTheta = new Float64Array(n);
  const noiseScale = sigmaNoise * Math.sqrt(h);
  let recIdx = 0;
  let frameIdx = 0;

  const recordSample = (step: number) => {
    let sr = 0, si = 0;
    for (let i = 0; i < n; i++) {
      const c = Math.cos(theta[i]!);
      const s = Math.sin(theta[i]!);
      cosBuf[i] = c;
      sinBuf[i] = s;
      sr += c;
      si += s;
    }
    const r = Math.hypot(sr, si) / n;
    tArr[recIdx] = step * dt;
    rArr[recIdx] = r;
    mfArr[recIdx] = sr / n;
    mfImgArr[recIdx] = si / n;
    if (recIdx % frameStep === 0 && frameIdx < frames) {
      for (let i = 0; i < n; i++) activity[i * frames + frameIdx] = sinBuf[i]!;
      frameIdx++;
    }
    if (step >= transientSteps) {
      for (let i = 0; i < n; i++) {
        const ci = cosBuf[i]!, sii = sinBuf[i]!;
        const row = i * n;
        for (let j = i; j < n; j++) {
          const cj = cosBuf[j]!, sj = sinBuf[j]!;
          plvCos[row + j] = plvCos[row + j]! + (ci * cj + sii * sj);
          plvSin[row + j] = plvSin[row + j]! + (sii * cj - ci * sj);
        }
      }
      plvSamples++;
    }
    recIdx++;
  };

  recordSample(0);

  for (let step = 0; step < nSteps; step++) {
    const slot = step % K;
    hist.set(theta, slot * n);
    for (let i = 0; i < n; i++) {
      const ti = theta[i]!;
      let sum = 0;
      for (let q = rowPtr[i]!, end = rowPtr[i + 1]!; q < end; q++) {
        const j = colIdx[q]!;
        const delayedSlot = (((step - dSteps[q]!) % K) + K) % K;
        const tj = hist[delayedSlot * n + j]!;
        sum += vals[q]! * Math.sin(tj - ti);
      }
      dTheta[i] = omega[i]! + G * sum;
    }
    for (let i = 0; i < n; i++) {
      theta[i] = theta[i]! + h * dTheta[i]! + (noiseScale > 0 ? noiseScale * rng.normal() : 0);
    }
    const nextStep = step + 1;
    if (nextStep % sampleStep === 0 && recIdx < nRec) recordSample(nextStep);
    if (onProgress && nextStep % 1000 === 0) onProgress(nextStep / nSteps);
  }

  const usedRec = recIdx;
  const t = tArr.slice(0, usedRec);
  const R = rArr.slice(0, usedRec);
  const meanField = mfArr.slice(0, usedRec);
  const cols = frameIdx;

  // Pairwise PLV matrix
  const plv = new Float64Array(n * n);
  let plvSum = 0;
  let plvPairs = 0;
  for (let i = 0; i < n; i++) {
    plv[i * n + i] = 1;
    for (let j = i + 1; j < n; j++) {
      const c = plvCos[i * n + j]! / (plvSamples || 1);
      const s = plvSin[i * n + j]! / (plvSamples || 1);
      const v = plvSamples > 0 ? Math.hypot(c, s) : 0;
      plv[i * n + j] = v;
      plv[j * n + i] = v;
      plvSum += v;
      plvPairs++;
    }
  }

  // Welch PSD of steady-state mean field
  const fs = 1000 / (dt * sampleStep);
  const steadyStart = Math.min(usedRec - 1, Math.round(1000 / (dt * sampleStep)));
  const steadyMf = meanField.subarray(steadyStart);
  const psd = welchPsd(steadyMf.length >= 32 ? steadyMf : meanField, fs, Math.min(steadyMf.length, 256));
  const keepIdx = psd.freq.findIndex((fq) => fq > 60);
  const end = keepIdx < 0 ? psd.freq.length : keepIdx;

  const scPlvX: number[] = [];
  const scPlvY: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (W[i * n + j]! > 0) {
        scPlvX.push(W[i * n + j]!);
        scPlvY.push(plv[i * n + j]!);
      }
    }
  }

  let rSteadySum = 0;
  let rSteadyCount = 0;
  for (let k = steadyStart; k < usedRec; k++) { rSteadySum += R[k]!; rSteadyCount++; }

  const out: ModelOutput = {
    t,
    series: { R, mean_field: meanField },
    curves: {
      psd: { x: psd.freq.slice(0, end), y: psd.power.slice(0, end) },
      sc_plv: { x: Float64Array.from(scPlvX), y: Float64Array.from(scPlvY) },
    },
    matrices: {
      SC: { rows: n, cols: n, data: Float64Array.from(W), rowLabels: labels, colLabels: labels },
      PLV: { rows: n, cols: n, data: plv, rowLabels: labels, colLabels: labels },
      activity: {
        rows: n,
        cols,
        data: cols === frames ? activity : Float64Array.from({ length: n * cols }, (_, q) => activity[Math.floor(q / cols) * frames + (q % cols)]!),
        rowLabels: labels,
      },
    },
    metrics: {
      orderMean: rSteadyCount > 0 ? rSteadySum / rSteadyCount : NaN,
      plvMean: plvPairs > 0 ? plvSum / plvPairs : NaN,
      scPlvCorr: upperTriangleCorrelation(W, plv, n),
      peakFreqHz: peakFrequency(psd, 1, 60),
      alphaPower: bandPower(psd, 8, 12),
      meanDelayMs,
    },
    notes: [
      `Structural graph provenance: ${g.provenance} — 68-node Desikan–Killiany labeled synthetic graph (not a measured connectome).`,
      `Mean inter-regional conduction delay = ${meanDelayMs.toFixed(2)} ms at v = ${velocityMs.toFixed(1)} m/s.`,
    ],
    status: 'COMPLETED',
  };
  return out;
}

export const TWIN_OSCILLATIONS: TwinDefinition = {
  id: 'EXP-042',
  title: 'Connectome coupling & delays → oscillatory phase locking → signal analytics',
  anchorEntityIds: ['ANAT-TELENCEPHALON', 'ANAT-DLPFC', 'MECH-044', 'MECH-046'],
  anchorNote: 'The 68 regions use Desikan–Killiany cortical labels and schematic MNI-like placements; the coupling weights follow a synthetic exponential distance rule rather than measured tractography, and simulated PLV is not an individual EEG/MEG scan.',
  params: PARAMS,
  views: [
    { kind: 'traces', title: 'Stage 2 · Kuramoto order parameter R(t)', yLabel: 'R(t)', series: [
      { key: 'R', label: 'Order parameter R', unit: '', meaning: 'Global phase coherence across the 68 coupled cortical oscillators.' },
      { key: 'mean_field', label: 'Mean field R cos Ψ', unit: '', meaning: 'Population-level oscillatory signal proxy.', dashed: true },
    ] },
    { kind: 'matrix', title: 'Stage 1 · Synthetic structural graph W (68 DK regions)', key: 'SC', xLabel: 'source region', yLabel: 'target region', meaning: 'Synthetic structural weights generated from exponential distance decay + homotopic symmetry.' },
    { kind: 'matrix', title: 'Stage 3 · Pairwise Phase-Locking Value (PLV)', key: 'PLV', xLabel: 'region', yLabel: 'region', meaning: 'Steady-state phase-locking value |⟨exp(i(θᵢ − θⱼ))⟩| across all 68 × 68 region pairs.' },
    { kind: 'curve', title: 'Stage 3 · Mean-field Welch power spectrum', xLabel: 'frequency (Hz)', yLabel: 'PSD (a.u.)', meaning: 'Welch power spectral density of the global population mean field after the 1 s transient.', curves: [{ key: 'psd', label: 'Mean-field PSD' }] },
    { kind: 'curve', title: 'Stage 3 · Structural weight vs pairwise PLV', xLabel: 'structural weight W_ij', yLabel: 'PLV_ij', meaning: 'Relationship between structural edge strength and emergent steady-state phase locking for connected region pairs.', curves: [{ key: 'sc_plv', label: 'Connected pairs', points: true }] },
    { kind: 'matrix', title: 'Stage 2 · Regional phase waves sin θᵢ(t)', key: 'activity', xLabel: 'time →', yLabel: 'region', diverging: true, meaning: 'Spatiotemporal oscillatory waves across the 68 regions.' },
  ],
  stages: [
    { index: 1, title: '68-region connectome scaffold', tier: 'Tier 1', coupling: 'MECHANISTIC', modelIds: ['MODEL-028'], entityIds: ['ANAT-TELENCEPHALON', 'ANAT-DLPFC'], input: '68-region Desikan–Killiany coordinates and synthetic distance-rule weights', output: 'Normalized structural matrix W̃ and inter-regional distances d_ij', timescale: 'static' },
    { index: 2, title: 'Delay-coupled phase oscillators', tier: 'Tier 4', coupling: 'MECHANISTIC', modelIds: ['MODEL-027'], entityIds: ['MODEL-027', 'MECH-046'], input: 'Coupling gain G, conduction velocity v → τ_ij = d_ij / v', output: '68 regional phase trajectories θ_i(t), order parameter R(t), mean field', timescale: 'ms – s' },
    { index: 3, title: 'Spectral & PLV analytics', tier: 'Tier 5', coupling: 'MECHANISTIC', modelIds: [], entityIds: ['ANALYTIC-004', 'ANALYTIC-015', 'ANALYTIC-021'], input: 'Steady-state phases θ_i(t) and population mean field', output: 'Pairwise PLV matrix, Welch PSD, SC–PLV correlation r', timescale: 'analysis' },
    { index: 4, title: 'Systems oscillation context', tier: 'Tier 1', coupling: 'CONCEPTUAL', modelIds: [], entityIds: ['MECH-044', 'ANAT-THALAMUS'], input: 'Baseline versus coupled/delayed synchrony', output: 'Scoped interpretation of structure-constrained functional phase locking', timescale: 'interpretive' },
  ],
  validationBoundary: 'Verifies that increasing coupling G above the dispersion scale elevates global R(t) and pairwise PLV while distance-dependent conduction delays modulate phase locking and collective frequency (Breakspear 2017; Sanz-Leon et al. 2013).',
  limitations: [
    'Phase-only Kuramoto dynamics: regional oscillation amplitude is fixed and laminar/subcortical loops are omitted.',
    'The 68-region structural connectivity matrix is generated synthetically from Desikan–Killiany centroid distances, not empirical diffusion tractography.',
    'Phase-locking values measure statistical phase consistency between synthetic oscillators and support no clinical EEG/MEG inference.',
  ],
  references: ['REF-SANZ-LEON-2013', 'REF-BREAKSPEAR-2017', 'REF-LACHAUX-1999', 'REF-DESIKAN-2006'],
  provenance: 'SYNTHETIC_SIMULATION',
  run(values, seed, onProgress): TwinResult {
    const p = reader(PARAMS, values);
    const f0 = p('f0'), sigmaW = p('sigma_omega'), sigmaN = p('sigma_noise'), dur = p('duration');
    onProgress?.(0.02, 'Stage 2: baseline connectome oscillations');
    const base = runCondition(p('G_base'), p('v_base'), f0, sigmaW, sigmaN, dur, seed, (f) => onProgress?.(0.02 + 0.46 * f, 'Stage 2: baseline connectome oscillations'));
    onProgress?.(0.5, 'Stage 2: intervention connectome oscillations');
    const interv = runCondition(p('G_int'), p('v_int'), f0, sigmaW, sigmaN, dur, seed, (f) => onProgress?.(0.5 + 0.48 * f, 'Stage 2: intervention connectome oscillations'));

    const b = base.metrics, a = interv.metrics;
    const cmp = (key: string, label: string, unit: string, description: string, analyticId?: string, digits = 3) => ({
      key, label, unit, baseline: b[key]!, intervention: a[key]!, description, digits, ...(analyticId ? { analyticId } : {}),
    });
    const comparisons = [
      cmp('orderMean', 'Mean order parameter ⟨R⟩', '', 'Steady-state Kuramoto phase coherence across all 68 regions.', 'ANALYTIC-015', 3),
      cmp('plvMean', 'Mean pairwise PLV', '', 'Average Phase-Locking Value over all 2,278 off-diagonal region pairs.', 'ANALYTIC-015', 3),
      cmp('scPlvCorr', 'SC–PLV Pearson correlation', '', 'Correlation between synthetic structural coupling weights and steady-state PLV.', 'ANALYTIC-021', 3),
      cmp('peakFreqHz', 'Mean-field spectral peak', 'Hz', 'Dominant oscillatory frequency of the global mean-field signal.', 'ANALYTIC-004', 2),
      cmp('alphaPower', 'Alpha-band power (8–12 Hz)', 'a.u.', 'Integrated Welch PSD in the 8–12 Hz band.', 'ANALYTIC-004', 4),
      cmp('meanDelayMs', 'Mean conduction delay', 'ms', 'Average axonal transmission delay d_ij / v across connected edges.', undefined, 2),
    ];

    const summaries = [
      '68-region synthetic structural graph built from schematic Desikan–Killiany coordinates (25% edge density).',
      `Baseline (G=${p('G_base')}, v=${p('v_base')} m/s) mean delay ${b.meanDelayMs!.toFixed(2)} ms → Intervention (G=${p('G_int')}, v=${p('v_int')} m/s) mean delay ${a.meanDelayMs!.toFixed(2)} ms.`,
      `Order parameter ⟨R⟩ ${b.orderMean!.toFixed(3)} → ${a.orderMean!.toFixed(3)}; mean PLV ${b.plvMean!.toFixed(3)} → ${a.plvMean!.toFixed(3)}; r(SC, PLV) ${b.scPlvCorr!.toFixed(3)} → ${a.scPlvCorr!.toFixed(3)}.`,
      'Structure-dependent phase locking arises here purely from synthetic distance-weighted Kuramoto dynamics; it does not represent empirical human EEG/MEG connectivity.',
    ];

    onProgress?.(1, 'Done');
    return {
      experimentId: 'EXP-042',
      conditions: { baseline: base, intervention: interv },
      comparisons,
      stages: TWIN_OSCILLATIONS.stages.map((s, k) => ({ ...s, summary: summaries[k]! })),
      notes: [
        'Both conditions share the identical 68-node structural graph, intrinsic frequencies, initial phases and noise realization.',
      ],
    };
  },
};
