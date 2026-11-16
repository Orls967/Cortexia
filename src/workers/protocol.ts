// Typed worker messaging (SIMULATION_AND_WORKER_ARCHITECTURE §3). Results travel as structured clones with
// their ArrayBuffers transferred (zero-copy).
import type { GraphSummary } from '../kernels/analytics/graph';
import type { ErpResult, TimeFrequency, WaveletResult } from '../kernels/analytics/spectral';
import type { Psd, Spectrum, WindowKind } from '../kernels/analytics/fft';
import type { crossCorrelogram, fanoFactor, IsiResult, psth, spikeTriggeredAverage } from '../kernels/analytics/spikes';
import type { CorrelationResult, Descriptive, RegressionResult, TTestResult } from '../kernels/analytics/stats';
import type { EnsembleResult, SensitivityRow, Sweep2DResult, SweepResult } from '../kernels/experiments/run';
import type { ModelOutput, RunConfig } from '../kernels/core/types';
import type { TwinResult } from '../kernels/twin/common';
import type { ValidationResult } from '../kernels/validation/cases';

export type SimJob =
  | { kind: 'run'; modelId: string; config: RunConfig }
  | { kind: 'sweep'; modelId: string; config: RunConfig; paramKey: string; values: number[] }
  | { kind: 'sweep2d'; modelId: string; config: RunConfig; keyX: string; xs: number[]; keyY: string; ys: number[]; metricKey: string }
  | { kind: 'sensitivity'; modelId: string; config: RunConfig; metricKey: string }
  | { kind: 'ensemble'; modelId: string; config: RunConfig; seeds: number[] }
  | { kind: 'validate'; caseId: string }
  | { kind: 'twin'; experimentId: string; params: Record<string, number>; seed: number };

export interface SimResultMap {
  run: ModelOutput;
  sweep: SweepResult;
  sweep2d: Sweep2DResult;
  sensitivity: { metricKey: string; baseline: number; rows: SensitivityRow[] };
  ensemble: EnsembleResult;
  validate: ValidationResult;
  twin: TwinResult;
}

export type AnalyticsJob =
  | {
      kind: 'signalSuite';
      signal: Float64Array;
      fs: number;
      filterMode: 'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';
      lowHz: number;
      highHz: number;
      order: 2 | 4;
      useFir: boolean;
      demean: boolean;
      detrend: boolean;
      window: WindowKind;
      welchSegLen: number;
      stftWinLen: number;
      waveletFreqs: number[];
      waveletCycles: number;
    }
  | {
      kind: 'erp';
      signal: Float64Array;
      fs: number;
      triggers: Float64Array;
      preMs: number;
      postMs: number;
    }
  | {
      kind: 'spikeSuite';
      times: Float64Array;
      ids: Uint32Array;
      nNeurons: number;
      durationMs: number;
      binMs: number;
      unitA: number;
      unitB: number;
      lfp?: Float64Array;
      lfpFs?: number;
    }
  | {
      kind: 'networkSuite';
      weights: Float64Array;
      n: number;
      seed: number;
      computeSmallWorld: boolean;
      computeLesion: boolean;
    }
  | {
      kind: 'statsSuite';
      x: Float64Array;
      y?: Float64Array;
      polyDegree?: number;
      bootstrapSeed?: number;
    };

export interface AnalyticsResultMap {
  signalSuite: {
    filtered: Float64Array;
    spectrum: Spectrum;
    psd: Psd;
    stft: TimeFrequency;
    wavelet: WaveletResult;
    bandPowers: { key: string; label: string; power: number }[];
    peakHz: number;
    stats: Descriptive;
  };
  erp: ErpResult;
  spikeSuite: {
    ratesHz: Float64Array;
    popRate: { t: Float64Array; rate: Float64Array };
    isi: IsiResult;
    fano: ReturnType<typeof fanoFactor>;
    psth: ReturnType<typeof psth>;
    ccg: ReturnType<typeof crossCorrelogram>;
    synchronyChi: number;
    sta?: ReturnType<typeof spikeTriggeredAverage>;
  };
  networkSuite: {
    summary: GraphSummary & { betweenness: Float64Array; community: Int32Array; degree: Float64Array };
    clusteringLocal: Float64Array;
    smallWorldSigma: number;
    lesion?: {
      fractions: Float64Array;
      randomEff: Float64Array;
      degreeEff: Float64Array;
      betweennessEff: Float64Array;
      randomLcc: Float64Array;
      betweennessLcc: Float64Array;
    };
  };
  statsSuite: {
    statsX: Descriptive;
    statsY?: Descriptive;
    twoSample?: TTestResult & { mannWhitneyP: number; permutationP: number };
    regression?: RegressionResult;
    correlation?: { pearson: CorrelationResult; spearman: CorrelationResult };
  };
}

export type WorkerRequest<J> = { jobId: string; job: J };

export type WorkerResponse<R> =
  | { type: 'PROGRESS'; jobId: string; fraction: number; label?: string }
  | { type: 'DONE'; jobId: string; result: R; elapsedMs: number }
  | { type: 'ERROR'; jobId: string; code: string; message: string; failedAtMs?: number };

/** Collects every ArrayBuffer reachable from a result so it can be transferred instead of copied. */
export function collectTransferables(value: unknown, out: Set<ArrayBuffer> = new Set(), depth = 0): ArrayBuffer[] {
  if (value && typeof value === 'object' && depth < 8) {
    if (ArrayBuffer.isView(value)) { if (value.buffer instanceof ArrayBuffer) out.add(value.buffer); }
    else if (value instanceof ArrayBuffer) out.add(value);
    else if (Array.isArray(value)) for (const v of value) collectTransferables(v, out, depth + 1);
    else for (const v of Object.values(value as Record<string, unknown>)) collectTransferables(v, out, depth + 1);
  }
  return depth === 0 ? [...out] : [];
}

export class JobError extends Error {
  constructor(public code: string, message: string, public failedAtMs?: number) { super(message); }
}
