import { create } from 'zustand';
import { defaultConfig, hasBlockingIssue, presetConfig, validateConfig } from '../kernels/core/config';
import type { ModelOutput, RunConfig, StimulusConfig } from '../kernels/core/types';
import type { EnsembleResult, SensitivityRow, Sweep2DResult, SweepResult } from '../kernels/experiments/run';
import { getModel } from '../kernels/models';
import type { TwinResult } from '../kernels/twin/common';
import type { ValidationResult } from '../kernels/validation/cases';
import type { JobHandle } from '../workers/client';
import { submitSimJob } from '../workers/pools';
import { useJobStatusStore } from './jobStatusStore';
import { useResearchStore } from './researchStore';
import { useSelectionStore } from './selectionStore';

export type JobStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';

interface LabState {
  activeModelId: string;
  configs: Record<string, RunConfig>;
  activePresetByModel: Record<string, string | null>;
  outputs: Record<string, ModelOutput>;
  sweeps: Record<string, SweepResult>;
  sweeps2D: Record<string, Sweep2DResult>;
  sensitivity: Record<string, { metricKey: string; baseline: number; rows: SensitivityRow[] }>;
  ensembles: Record<string, EnsembleResult>;
  validations: Record<string, ValidationResult>;
  twinResults: Record<string, TwinResult>;

  jobStatus: JobStatus;
  progress: number;
  progressLabel: string;
  errorMessage: string | null;
  lastElapsedMs: number | null;

  setActiveModel: (modelId: string) => void;
  updateParam: (modelId: string, key: string, value: number) => void;
  updateInitial: (modelId: string, key: string, value: number) => void;
  updateStimulus: (modelId: string, patch: Partial<StimulusConfig>) => void;
  updateRunOption: (modelId: string, patch: Partial<Pick<RunConfig, 'solver' | 'dtMs' | 'durationMs' | 'seed'>>) => void;
  applyPreset: (modelId: string, presetId: string) => void;
  resetModel: (modelId: string) => void;
  loadRunConfig: (modelId: string, config: RunConfig) => void;

  runActiveModel: (modelId?: string) => Promise<void>;
  runSweepJob: (modelId: string, paramKey: string, values: number[]) => Promise<void>;
  runSweep2DJob: (modelId: string, keyX: string, xs: number[], keyY: string, ys: number[], metricKey: string) => Promise<void>;
  runSensitivityJob: (modelId: string, metricKey: string) => Promise<void>;
  runEnsembleJob: (modelId: string, seeds: number[]) => Promise<void>;
  runValidationCase: (caseId: string) => Promise<void>;
  runTwinExperiment: (experimentId: string, params: Record<string, number>, seed: number) => Promise<void>;
  cancelActiveJob: () => void;
}

let activeHandle: JobHandle<unknown> | null = null;

function ensureConfig(configs: Record<string, RunConfig>, modelId: string): RunConfig {
  return configs[modelId] ?? defaultConfig(getModel(modelId));
}

export const useLabStore = create<LabState>((set, get) => ({
  activeModelId: 'MODEL-001',
  configs: {},
  activePresetByModel: {},
  outputs: {},
  sweeps: {},
  sweeps2D: {},
  sensitivity: {},
  ensembles: {},
  validations: {},
  twinResults: {},

  jobStatus: 'IDLE',
  progress: 0,
  progressLabel: '',
  errorMessage: null,
  lastElapsedMs: null,

  setActiveModel: (modelId) =>
    set((s) => ({
      activeModelId: modelId,
      configs: s.configs[modelId] ? s.configs : { ...s.configs, [modelId]: defaultConfig(getModel(modelId)) },
      errorMessage: null,
    })),

  updateParam: (modelId, key, value) =>
    set((s) => {
      const prev = ensureConfig(s.configs, modelId);
      return {
        configs: { ...s.configs, [modelId]: { ...prev, params: { ...prev.params, [key]: value } } },
        activePresetByModel: { ...s.activePresetByModel, [modelId]: null },
      };
    }),

  updateInitial: (modelId, key, value) =>
    set((s) => {
      const prev = ensureConfig(s.configs, modelId);
      return {
        configs: { ...s.configs, [modelId]: { ...prev, initial: { ...prev.initial, [key]: value } } },
      };
    }),

  updateStimulus: (modelId, patch) =>
    set((s) => {
      const prev = ensureConfig(s.configs, modelId);
      return {
        configs: { ...s.configs, [modelId]: { ...prev, stimulus: { ...prev.stimulus, ...patch } } },
        activePresetByModel: { ...s.activePresetByModel, [modelId]: null },
      };
    }),

  updateRunOption: (modelId, patch) =>
    set((s) => {
      const prev = ensureConfig(s.configs, modelId);
      return {
        configs: { ...s.configs, [modelId]: { ...prev, ...patch } },
      };
    }),

  applyPreset: (modelId, presetId) =>
    set((s) => {
      const model = getModel(modelId);
      const preset = model.presets.find((p) => p.id === presetId);
      if (!preset) return s;
      const prev = ensureConfig(s.configs, modelId);
      return {
        configs: { ...s.configs, [modelId]: presetConfig(model, preset, prev.seed) },
        activePresetByModel: { ...s.activePresetByModel, [modelId]: presetId },
        errorMessage: null,
      };
    }),

  resetModel: (modelId) =>
    set((s) => ({
      configs: { ...s.configs, [modelId]: defaultConfig(getModel(modelId)) },
      activePresetByModel: { ...s.activePresetByModel, [modelId]: null },
      errorMessage: null,
    })),

  loadRunConfig: (modelId, config) =>
    set((s) => ({
      activeModelId: modelId,
      configs: { ...s.configs, [modelId]: structuredClone(config) },
      activePresetByModel: { ...s.activePresetByModel, [modelId]: null },
      errorMessage: null,
    })),

  cancelActiveJob: () => {
    if (activeHandle) {
      activeHandle.cancel();
      activeHandle = null;
    }
    set({ jobStatus: 'CANCELLED', progress: 0, progressLabel: 'Cancelled' });
  },

  runActiveModel: async (optId) => {
    const modelId = optId ?? get().activeModelId;
    const model = getModel(modelId);
    const config = ensureConfig(get().configs, modelId);
    const issues = validateConfig(model, config);
    if (hasBlockingIssue(issues)) {
      const msg = issues.find((i) => i.severity === 'error')?.message ?? 'Invalid configuration';
      set({ jobStatus: 'ERROR', errorMessage: msg });
      return;
    }
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: `Running ${model.name}`, errorMessage: null });
    const handle = submitSimJob<'run'>({ kind: 'run', modelId, config }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        outputs: { ...s.outputs, [modelId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: result.status === 'DIVERGED' ? 'Numerical divergence detected' : 'Completed',
        lastElapsedMs: elapsedMs,
      }));
      useResearchStore.getState().addRun(
        {
          experimentType: 'SINGLE_RUN',
          modelId,
          modelName: model.name,
          modelVersion: '1.0.0',
          ...(get().activePresetByModel[modelId] ? { presetId: get().activePresetByModel[modelId]! } : {}),
          config: structuredClone(config),
          metrics: { ...result.metrics },
          status: result.status,
          elapsedMs,
          notes: [...result.notes],
        },
        result,
      );
      if (result.status === 'DIVERGED') {
        useSelectionStore.getState().pushNotification({
          kind: 'warning',
          title: `${model.id} numerical divergence`,
          detail: result.notes[0] ?? 'Reduce time step or adjust coupling/conductance.',
        });
      }
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('cancel')) return;
      set({ jobStatus: 'ERROR', errorMessage: msg, progress: 0 });
    }
  },

  runSweepJob: async (modelId, paramKey, values) => {
    const config = ensureConfig(get().configs, modelId);
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: `Running 1D sweep (${paramKey})`, errorMessage: null });
    const handle = submitSimJob<'sweep'>({ kind: 'sweep', modelId, config, paramKey, values }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        sweeps: { ...s.sweeps, [modelId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: 'Sweep completed',
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },

  runSweep2DJob: async (modelId, keyX, xs, keyY, ys, metricKey) => {
    const config = ensureConfig(get().configs, modelId);
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: 'Running 2D sweep', errorMessage: null });
    const handle = submitSimJob<'sweep2d'>({ kind: 'sweep2d', modelId, config, keyX, xs, keyY, ys, metricKey }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        sweeps2D: { ...s.sweeps2D, [modelId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: '2D sweep completed',
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },

  runSensitivityJob: async (modelId, metricKey) => {
    const config = ensureConfig(get().configs, modelId);
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: 'Running OAT sensitivity', errorMessage: null });
    const handle = submitSimJob<'sensitivity'>({ kind: 'sensitivity', modelId, config, metricKey }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        sensitivity: { ...s.sensitivity, [modelId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: 'Sensitivity analysis completed',
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },

  runEnsembleJob: async (modelId, seeds) => {
    const config = ensureConfig(get().configs, modelId);
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: `Running ${seeds.length}-seed ensemble`, errorMessage: null });
    const handle = submitSimJob<'ensemble'>({ kind: 'ensemble', modelId, config, seeds }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        ensembles: { ...s.ensembles, [modelId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: 'Ensemble completed',
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },

  runValidationCase: async (caseId) => {
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0.2, progressLabel: `Validating ${caseId}`, errorMessage: null });
    const handle = submitSimJob<'validate'>({ kind: 'validate', caseId });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        validations: { ...s.validations, [caseId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: result.passed ? `${caseId} passed` : `${caseId} failed`,
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },

  runTwinExperiment: async (experimentId, params, seed) => {
    if (activeHandle) activeHandle.cancel();
    set({ jobStatus: 'RUNNING', progress: 0, progressLabel: `Running Digital Twin ${experimentId}`, errorMessage: null });
    const handle = submitSimJob<'twin'>({ kind: 'twin', experimentId, params, seed }, (f, label) => {
      set({ progress: f, ...(label ? { progressLabel: label } : {}) });
    });
    activeHandle = handle;
    try {
      const { result, elapsedMs } = await handle.promise;
      activeHandle = null;
      set((s) => ({
        twinResults: { ...s.twinResults, [experimentId]: result },
        jobStatus: 'COMPLETED',
        progress: 1,
        progressLabel: `${experimentId} completed`,
        lastElapsedMs: elapsedMs,
      }));
    } catch (e) {
      activeHandle = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) set({ jobStatus: 'ERROR', errorMessage: msg });
    }
  },
}));

// Mirror job state into the shell's status-bar store (see jobStatusStore.ts).
const mirrorJobStatus = (s: LabState) => useJobStatusStore.setState({ jobStatus: s.jobStatus, progress: s.progress, progressLabel: s.progressLabel });
useJobStatusStore.setState({ cancel: () => useLabStore.getState().cancelActiveJob() });
mirrorJobStatus(useLabStore.getState());
useLabStore.subscribe(mirrorJobStatus);
