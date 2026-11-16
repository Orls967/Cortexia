// Shared contracts for the computational runtime. Kernels are pure, DOM-free and deterministic
// (SYSTEM_ARCHITECTURE §5.2) so the same code runs in Web Workers and in Vitest.

export type SolverId =
  | 'SOLVER-FE'
  | 'SOLVER-RK4'
  | 'SOLVER-RK45'
  | 'SOLVER-RUSH-LARSEN'
  | 'SOLVER-EXACT-LIF'
  | 'SOLVER-HYBRID-SPIKE'
  | 'SOLVER-EULER-MARUYAMA'
  | 'SOLVER-CRANK-NICOLSON';

export const SOLVER_INFO: Record<SolverId, { name: string; order: string; note: string }> = {
  'SOLVER-FE': { name: 'Explicit Forward Euler', order: 'O(h)', note: 'Educational baseline; conditionally stable.' },
  'SOLVER-RK4': { name: 'Classical 4th-order Runge–Kutta', order: 'O(h⁴)', note: 'Default for smooth ODE systems.' },
  'SOLVER-RK45': { name: 'Dormand–Prince adaptive RK4(5)', order: 'O(h⁵) local', note: 'Adaptive step, atol 1e-6 / rtol 1e-5.' },
  'SOLVER-RUSH-LARSEN': { name: 'Rush–Larsen exponential integrator', order: 'O(h)–O(h²)', note: 'Keeps gating variables in [0, 1] for stiff kinetics.' },
  'SOLVER-EXACT-LIF': { name: 'Exact linear subthreshold integration', order: 'Exact (linear)', note: 'Closed-form propagator with exact threshold crossing.' },
  'SOLVER-HYBRID-SPIKE': { name: 'Hybrid sub-stepped integration with spike events', order: 'O(h²)–O(h⁴)', note: 'Threshold interpolation, reset and refractory clamp.' },
  'SOLVER-EULER-MARUYAMA': { name: 'Euler–Maruyama stochastic integrator', order: 'Strong O(h^½)', note: 'Seeded Gaussian increments for SDEs.' },
  'SOLVER-CRANK-NICOLSON': { name: 'Implicit Crank–Nicolson', order: 'O(Δt², Δx²)', note: 'Unconditionally stable for the cable equation.' },
};

export interface ParamSpec {
  key: string;
  /** Plain-text label, e.g. "Maximum sodium conductance". */
  label: string;
  /** LaTeX symbol, e.g. "\\bar{g}_{Na}". */
  symbol: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  /** Stable PARAM-* registry ID when the Phase 0 parameter registry defines this parameter. */
  registryId?: string;
  /** Scientific meaning; shown in tooltip and inspector. */
  description: string;
  group?: string;
  /** Discrete choices (value -> label) for categorical parameters. */
  options?: { value: number; label: string }[];
}

export type StimulusKind = 'none' | 'step' | 'pulse-train' | 'ramp' | 'sine' | 'ou-noise';

export interface StimulusConfig {
  kind: StimulusKind;
  /** Amplitude in the model's current unit. */
  amplitude: number;
  /** Baseline (holding) value added at all times. */
  baseline: number;
  startMs: number;
  durationMs: number;
  /** pulse-train: pulse width and inter-pulse interval (onset to onset). */
  pulseWidthMs: number;
  pulseIntervalMs: number;
  pulseCount: number;
  /** Amplitude scale of the second and later pulses (paired-pulse probes). */
  laterPulseScale: number;
  /** sine: frequency in Hz. */
  frequencyHz: number;
  /** ou-noise: standard deviation and correlation time. */
  sigma: number;
  tauMs: number;
}

export const DEFAULT_STIMULUS: StimulusConfig = {
  kind: 'step', amplitude: 0, baseline: 0, startMs: 10, durationMs: 1e9,
  pulseWidthMs: 1, pulseIntervalMs: 20, pulseCount: 2, laterPulseScale: 1, frequencyHz: 10, sigma: 0, tauMs: 5,
};

export interface StimulusSpec {
  label: string;
  unit: string;
  description: string;
  default: Partial<StimulusConfig>;
  amplitudeRange: [number, number];
  kinds: StimulusKind[];
}

export interface RunConfig {
  params: Record<string, number>;
  initial: Record<string, number>;
  stimulus: StimulusConfig;
  solver: SolverId;
  dtMs: number;
  durationMs: number;
  seed: number;
}

export interface RunContext {
  onProgress?: (fraction: number) => void;
}

export interface Curve {
  x: Float64Array;
  y: Float64Array;
}

export interface Matrix {
  rows: number;
  cols: number;
  data: Float64Array;
  rowLabels?: string[];
  colLabels?: string[];
}

export interface SpikeData {
  times: Float64Array;
  /** Neuron index of every spike (same length as times). */
  ids: Uint32Array;
  /** Number of neurons represented on the raster. */
  n: number;
  groups?: { name: string; from: number; to: number; kind: 'E' | 'I' }[];
}

export interface ModelOutput {
  /** Recorded time base in ms. */
  t: Float64Array;
  /** Time series sharing the `t` axis. */
  series: Record<string, Float64Array>;
  /** Non-time curves: nullclines, f–I, I–V, STDP windows, spectra, per-spike amplitudes. */
  curves: Record<string, Curve>;
  spikes?: SpikeData;
  matrices: Record<string, Matrix>;
  metrics: Record<string, number>;
  /** Plain-language notes produced by the kernel (regime classification, guard-rail hits). */
  notes: string[];
  status: 'COMPLETED' | 'DIVERGED';
  failedAtMs?: number;
}

export interface SeriesRef {
  key: string;
  label: string;
  unit: string;
  /** State-variable symbol this trace represents, used for UCES explanation. */
  meaning: string;
  dashed?: boolean;
}

export type ViewSpec =
  | { kind: 'traces'; title: string; yLabel: string; series: SeriesRef[]; spikeMarkers?: boolean }
  | { kind: 'phase'; title: string; xKey: string; yKey: string; xLabel: string; yLabel: string; curves: { key: string; label: string }[] }
  | { kind: 'curve'; title: string; xLabel: string; yLabel: string; curves: { key: string; label: string; points?: boolean; dashed?: boolean }[]; meaning: string }
  | { kind: 'raster'; title: string; meaning: string }
  | { kind: 'matrix'; title: string; key: string; xLabel: string; yLabel: string; diverging?: boolean; meaning: string };

export interface MetricSpec {
  key: string;
  label: string;
  unit: string;
  description: string;
  /** ANALYTIC-* method that defines this metric, when one exists in the registry. */
  analyticId?: string;
  digits?: number;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  params?: Record<string, number>;
  stimulus?: Partial<StimulusConfig>;
  durationMs?: number;
  /** EXP-* registry experiment this preset implements. */
  experimentId?: string;
}

export interface SweepSuggestion {
  paramKey: string;
  from: number;
  to: number;
  steps: number;
  metricKey: string;
  experimentId?: string;
}

export interface ModelDefinition {
  id: string;
  /** Short display name. */
  name: string;
  /** LaTeX lines of the equations exactly as implemented by this kernel. */
  equations: string[];
  params: ParamSpec[];
  /** Editable initial conditions (state symbol -> default). */
  initial: { key: string; label: string; unit: string; default: number }[];
  stimulus: StimulusSpec | null;
  solvers: SolverId[];
  defaultSolver: SolverId;
  defaultDtMs: number;
  minDtMs: number;
  maxSafeDtMs: number;
  defaultDurationMs: number;
  maxDurationMs: number;
  /** Time-axis label override (FitzHugh–Nagumo uses dimensionless time; TD learning uses trials). */
  timeUnit?: string;
  stochastic: boolean;
  views: ViewSpec[];
  metrics: MetricSpec[];
  presets: Preset[];
  sweep?: SweepSuggestion;
  /** Phenomena the kernel deliberately does not capture, beyond the registry limitations. */
  kernelLimitations: string[];
  run: (cfg: RunConfig, ctx?: RunContext) => ModelOutput;
}

export class SimulationError extends Error {
  constructor(public code: 'ERR_NUMERICAL_DIVERGENCE' | 'ERR_ENVELOPE_EXCEEDED' | 'ERR_INVALID_PARAMS', message: string, public failedAtMs?: number) {
    super(message);
  }
}
