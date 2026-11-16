import { create } from 'zustand';
import { Rng } from '../kernels/core/prng';
import { getModel } from '../kernels/models';
import { configWith } from '../kernels/core/config';
import { syntheticConnectome68 } from '../kernels/models/graphs';
import type { AnalyticsResultMap } from '../workers/protocol';
import { submitAnalyticsJob } from '../workers/pools';

export interface ImportedDatasetMeta {
  id: string;
  title: string;
  kind: 'timeseries' | 'spikes' | 'matrix';
  provenance: 'SYNTHETIC_BENCHMARK' | 'USER_IMPORTED_CSV' | 'USER_IMPORTED_JSON';
  license: string;
  samplingRateHz: number;
  units: string;
  channelNames: string[];
  sampleCount: number;
  notes: string;
}

export interface ImportedDatasetPayload {
  channels?: Float64Array[];
  triggers?: Float64Array;
  spikes?: { times: Float64Array; ids: Uint32Array; nNeurons: number; durationMs: number; lfp?: Float64Array; lfpFs?: number };
  matrix?: { weights: Float64Array; n: number; labels: string[] };
}

// Non-reactive BufferRegistry (FRONTEND_ARCHITECTURE §3): keeps large TypedArrays out of Zustand diffs.
const bufferRegistry = new Map<string, ImportedDatasetPayload>();
export function getDatasetPayload(id: string): ImportedDatasetPayload | undefined {
  return bufferRegistry.get(id);
}

function buildBuiltinSyntheticDatasets(): ImportedDatasetMeta[] {
  const metas: ImportedDatasetMeta[] = [];

  // DSET-019: Synthetic EEG chirp + 10 Hz alpha + 40 Hz gamma burst benchmark
  {
    const fs = 500;
    const durationS = 8;
    const n = fs * durationS;
    const rng = new Rng(19);
    const ch0 = new Float64Array(n);
    const ch1 = new Float64Array(n);
    const ch2 = new Float64Array(n);
    const triggers = new Float64Array([1.0 * fs, 2.5 * fs, 4.0 * fs, 5.5 * fs, 7.0 * fs]);
    for (let i = 0; i < n; i++) {
      const t = i / fs;
      const gammaEnv = Math.exp(-0.5 * ((t - 2.65) / 0.25) ** 2) + Math.exp(-0.5 * ((t - 5.65) / 0.25) ** 2);
      const chirpF = 3 + 3.5 * t;
      let erp = 0;
      for (const tr of triggers) {
        const dt = t - tr / fs;
        if (dt >= 0 && dt < 0.6) erp += 18 * Math.sin(2 * Math.PI * 5 * dt) * Math.exp(-dt / 0.14);
      }
      ch0[i] = 22 * Math.sin(2 * Math.PI * 10 * t) + 12 * gammaEnv * Math.sin(2 * Math.PI * 40 * t) + erp + 4.5 * rng.normal();
      ch1[i] = 15 * Math.sin(2 * Math.PI * 10 * t + 0.6) + 10 * Math.sin(2 * Math.PI * chirpF * t) + 0.6 * erp + 4.0 * rng.normal();
      ch2[i] = 18 * Math.sin(2 * Math.PI * 6 * t) + 8 * gammaEnv * Math.sin(2 * Math.PI * 42 * t) + 5.0 * rng.normal();
    }
    bufferRegistry.set('DSET-019', { channels: [ch0, ch1, ch2], triggers });
    metas.push({
      id: 'DSET-019',
      title: 'Synthetic EEG Spectral & Evoked Benchmark (Alpha + Gamma Burst + Chirp)',
      kind: 'timeseries',
      provenance: 'SYNTHETIC_BENCHMARK',
      license: 'CC0-1.0',
      samplingRateHz: fs,
      units: 'uV',
      channelNames: ['Occipital-Oz (synthetic)', 'Frontal-Fz (synthetic)', 'Central-Cz (synthetic)'],
      sampleCount: n,
      notes: 'SYNTHETIC_BENCHMARK: generated analytically for filter, Welch PSD, STFT, Morlet wavelet, and ERP validation.',
    });
  }

  // DSET-020: Synthetic balanced E/I network spike train benchmark (MODEL-021)
  {
    const brunel = getModel('MODEL-021');
    const out = brunel.run(configWith(brunel, { durationMs: 1200, seed: 42 }));
    const sp = out.spikes!;
    bufferRegistry.set('DSET-020', {
      spikes: {
        times: sp.times,
        ids: sp.ids,
        nNeurons: sp.n,
        durationMs: 1200,
        ...(out.series.rate_E ? { lfp: out.series.rate_E, lfpFs: 1000 / Math.max(0.1, out.t[1]! - out.t[0]!) } : {}),
      },
    });
    metas.push({
      id: 'DSET-020',
      title: 'Synthetic Balanced E/I Spiking Network Benchmark (MODEL-021)',
      kind: 'spikes',
      provenance: 'SYNTHETIC_BENCHMARK',
      license: 'CC0-1.0',
      samplingRateHz: 1000,
      units: 'ms (spike timestamps)',
      channelNames: ['E/I Population (250 neurons)'],
      sampleCount: sp.times.length,
      notes: 'SYNTHETIC_BENCHMARK: simulated spike trains from Brunel (2000) AI regime for raster, ISI, Fano, PSTH, CCG, and synchrony analysis.',
    });
  }

  // DSET-021: Synthetic 68-region connectome benchmark graph
  {
    const g = syntheticConnectome68(42);
    bufferRegistry.set('DSET-021', {
      matrix: {
        weights: g.weights,
        n: g.n,
        labels: g.labels ?? Array.from({ length: g.n }, (_, i) => `R${i + 1}`),
      },
    });
    metas.push({
      id: 'DSET-021',
      title: 'Synthetic 68-Region Cortical Structural Graph (Desikan–Killiany Labels)',
      kind: 'matrix',
      provenance: 'SYNTHETIC_BENCHMARK',
      license: 'CC0-1.0',
      samplingRateHz: 1,
      units: 'coupling weight (a.u.)',
      channelNames: g.labels ?? [],
      sampleCount: g.n * g.n,
      notes: 'SYNTHETIC_BENCHMARK: synthetic exponential-distance graph on Desikan–Killiany labels; not measured tractography.',
    });
  }

  return metas;
}

export interface ParsedCsvValidation {
  ok: boolean;
  error?: string;
  meta?: ImportedDatasetMeta;
  payload?: ImportedDatasetPayload;
}

export function parseCsvDataset(text: string, fileName: string, samplingRateHz: number, units: string): ParsedCsvValidation {
  if (!(samplingRateHz > 0) || !Number.isFinite(samplingRateHz)) {
    return { ok: false, error: 'Sampling frequency must be a finite positive number (Hz).' };
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length < 4) return { ok: false, error: 'CSV must contain a header row and at least 3 numeric data rows.' };
  const sep = lines[0]!.includes('\t') ? '\t' : ',';
  const headers = lines[0]!.split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  if (headers.length < 1) return { ok: false, error: 'No columns found in CSV header.' };

  const startCol = headers.length > 1 && /^(time|t|ms|s|sec)$/i.test(headers[0]!) ? 1 : 0;
  const colNames = headers.slice(startCol);
  if (colNames.length === 0) return { ok: false, error: 'No signal columns found after time column.' };

  const nRows = lines.length - 1;
  if (nRows > 200000) return { ok: false, error: 'CSV exceeds browser limit of 200,000 rows.' };
  const cols = colNames.map(() => new Float64Array(nRows));
  let missingValues = 0;

  for (let r = 0; r < nRows; r++) {
    const parts = lines[r + 1]!.split(sep);
    if (parts.length < headers.length) {
      return { ok: false, error: `Row ${r + 2} has ${parts.length} columns; expected ${headers.length}.` };
    }
    for (let c = 0; c < colNames.length; c++) {
      const val = Number(parts[startCol + c]!.trim());
      if (!Number.isFinite(val)) {
        missingValues++;
        cols[c]![r] = r > 0 ? cols[c]![r - 1]! : 0;
      } else {
        cols[c]![r] = val;
      }
    }
  }
  if (missingValues > nRows * colNames.length * 0.25) {
    return { ok: false, error: `Too many non-numeric or missing values (${missingValues}).` };
  }

  const id = `USER-CSV-${Date.now().toString(36).toUpperCase()}`;
  return {
    ok: true,
    meta: {
      id,
      title: `${fileName} (User Imported CSV)`,
      kind: 'timeseries',
      provenance: 'USER_IMPORTED_CSV',
      license: 'USER_SUPPLIED',
      samplingRateHz,
      units: units.trim() || 'a.u.',
      channelNames: colNames,
      sampleCount: nRows,
      notes: `USER_IMPORTED_CSV: ${nRows} samples × ${colNames.length} channel(s) at ${samplingRateHz} Hz${missingValues > 0 ? ` (${missingValues} missing values forward-filled)` : ''}.`,
    },
    payload: { channels: cols },
  };
}

const initialMetas = buildBuiltinSyntheticDatasets();

interface AnalyticsState {
  datasets: ImportedDatasetMeta[];
  activeDatasetId: string;
  activeChannelIdx: number;
  signalResult: AnalyticsResultMap['signalSuite'] | null;
  erpResult: AnalyticsResultMap['erp'] | null;
  spikeResult: AnalyticsResultMap['spikeSuite'] | null;
  networkResult: AnalyticsResultMap['networkSuite'] | null;
  statsResult: AnalyticsResultMap['statsSuite'] | null;
  jobStatus: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  progress: number;
  errorMessage: string | null;

  selectDataset: (id: string, channelIdx?: number) => void;
  importCsv: (text: string, fileName: string, fs: number, units: string) => ParsedCsvValidation;
  runSignalSuite: (opts: {
    filterMode: 'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';
    lowHz: number;
    highHz: number;
    order: 2 | 4;
    useFir: boolean;
    demean: boolean;
    detrend: boolean;
    window: 'hann' | 'hamming' | 'rect';
    welchSegLen: number;
    stftWinLen: number;
    waveletCycles: number;
  }) => Promise<void>;
  runSpikeSuite: (opts: { binMs: number; unitA: number; unitB: number }) => Promise<void>;
  runNetworkSuite: (opts: { seed: number; computeSmallWorld: boolean; computeLesion: boolean }) => Promise<void>;
  runStatsSuite: (x: Float64Array, y?: Float64Array, polyDegree?: number) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  datasets: initialMetas,
  activeDatasetId: 'DSET-019',
  activeChannelIdx: 0,
  signalResult: null,
  erpResult: null,
  spikeResult: null,
  networkResult: null,
  statsResult: null,
  jobStatus: 'IDLE',
  progress: 0,
  errorMessage: null,

  selectDataset: (id, ch = 0) => set({ activeDatasetId: id, activeChannelIdx: ch, errorMessage: null }),

  importCsv: (text, fileName, fs, units) => {
    const res = parseCsvDataset(text, fileName, fs, units);
    if (!res.ok || !res.meta || !res.payload) {
      set({ errorMessage: res.error ?? 'CSV import failed' });
      return res;
    }
    bufferRegistry.set(res.meta.id, res.payload);
    set((s) => ({
      datasets: [res.meta!, ...s.datasets],
      activeDatasetId: res.meta!.id,
      activeChannelIdx: 0,
      errorMessage: null,
    }));
    return res;
  },

  runSignalSuite: async (opts) => {
    const s = get();
    const meta = s.datasets.find((d) => d.id === s.activeDatasetId && d.kind === 'timeseries')
      ?? s.datasets.find((d) => d.kind === 'timeseries');
    if (!meta) return;
    const payload = bufferRegistry.get(meta.id);
    const ch = payload?.channels?.[Math.min(s.activeChannelIdx, (payload?.channels?.length ?? 1) - 1)];
    if (!ch) return;
    set({ jobStatus: 'RUNNING', progress: 0, errorMessage: null });
    const waveletFreqs = Array.from({ length: 24 }, (_, i) => 2 + i * 2.5).filter((f) => f < meta.samplingRateHz / 2);
    try {
      const { result } = await submitAnalyticsJob<'signalSuite'>(
        { kind: 'signalSuite', signal: Float64Array.from(ch), fs: meta.samplingRateHz, waveletFreqs, ...opts },
        (f) => set({ progress: f }),
      ).promise;
      let erpResult: AnalyticsResultMap['erp'] | null = null;
      if (payload?.triggers && payload.triggers.length > 0) {
        const erp = await submitAnalyticsJob<'erp'>({
          kind: 'erp',
          signal: Float64Array.from(result.filtered),
          fs: meta.samplingRateHz,
          triggers: Float64Array.from(payload.triggers),
          preMs: 150,
          postMs: 500,
        }).promise;
        erpResult = erp.result;
      }
      set({ signalResult: result, erpResult, jobStatus: 'COMPLETED', progress: 1 });
    } catch (e) {
      set({ jobStatus: 'ERROR', errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },

  runSpikeSuite: async ({ binMs, unitA, unitB }) => {
    const payload = bufferRegistry.get('DSET-020');
    if (!payload?.spikes) return;
    set({ jobStatus: 'RUNNING', progress: 0, errorMessage: null });
    try {
      const sp = payload.spikes;
      const { result } = await submitAnalyticsJob<'spikeSuite'>(
        {
          kind: 'spikeSuite',
          times: Float64Array.from(sp.times),
          ids: Uint32Array.from(sp.ids),
          nNeurons: sp.nNeurons,
          durationMs: sp.durationMs,
          binMs,
          unitA,
          unitB,
          ...(sp.lfp ? { lfp: Float64Array.from(sp.lfp), lfpFs: sp.lfpFs } : {}),
        },
        (f) => set({ progress: f }),
      ).promise;
      set({ spikeResult: result, jobStatus: 'COMPLETED', progress: 1 });
    } catch (e) {
      set({ jobStatus: 'ERROR', errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },

  runNetworkSuite: async ({ seed, computeSmallWorld, computeLesion }) => {
    const payload = bufferRegistry.get('DSET-021');
    if (!payload?.matrix) return;
    set({ jobStatus: 'RUNNING', progress: 0, errorMessage: null });
    try {
      const { result } = await submitAnalyticsJob<'networkSuite'>(
        {
          kind: 'networkSuite',
          weights: Float64Array.from(payload.matrix.weights),
          n: payload.matrix.n,
          seed,
          computeSmallWorld,
          computeLesion,
        },
        (f) => set({ progress: f }),
      ).promise;
      set({ networkResult: result, jobStatus: 'COMPLETED', progress: 1 });
    } catch (e) {
      set({ jobStatus: 'ERROR', errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },

  runStatsSuite: async (x, y, polyDegree = 1) => {
    set({ jobStatus: 'RUNNING', progress: 0.2, errorMessage: null });
    try {
      const { result } = await submitAnalyticsJob<'statsSuite'>({
        kind: 'statsSuite',
        x: Float64Array.from(x),
        ...(y ? { y: Float64Array.from(y) } : {}),
        polyDegree,
        bootstrapSeed: 42,
      }).promise;
      set({ statsResult: result, jobStatus: 'COMPLETED', progress: 1 });
    } catch (e) {
      set({ jobStatus: 'ERROR', errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },
}));
