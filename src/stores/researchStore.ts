import { z } from 'zod';
import { create } from 'zustand';
import type { ModelOutput, RunConfig } from '../kernels/core/types';

export interface ExperimentRunRecord {
  runId: string;
  experimentType: 'SINGLE_RUN' | 'BASELINE_VS_INTERVENTION' | 'SWEEP_1D' | 'ENSEMBLE' | 'DIGITAL_TWIN';
  modelId: string;
  modelName: string;
  modelVersion: string;
  presetId?: string;
  config: RunConfig;
  metrics: Record<string, number>;
  status: 'COMPLETED' | 'DIVERGED';
  elapsedMs: number;
  createdAt: string;
  notes: string[];
}

export interface ResearchNotebook {
  id: string;
  title: string;
  linkedRunIds: string[];
  linkedEntityIds: string[];
  content: string;
  updatedAt: string;
}

const runRecordSchema = z.object({
  runId: z.string(),
  experimentType: z.enum(['SINGLE_RUN', 'BASELINE_VS_INTERVENTION', 'SWEEP_1D', 'ENSEMBLE', 'DIGITAL_TWIN']),
  modelId: z.string(),
  modelName: z.string(),
  modelVersion: z.string(),
  presetId: z.string().optional(),
  config: z.object({
    params: z.record(z.string(), z.number()),
    initial: z.record(z.string(), z.number()),
    stimulus: z.any(),
    solver: z.any(),
    dtMs: z.number(),
    durationMs: z.number(),
    seed: z.number(),
  }),
  metrics: z.record(z.string(), z.number()),
  status: z.enum(['COMPLETED', 'DIVERGED']),
  elapsedMs: z.number(),
  createdAt: z.string(),
  notes: z.array(z.string()),
});

const notebookSchema = z.object({
  id: z.string(),
  title: z.string(),
  linkedRunIds: z.array(z.string()),
  linkedEntityIds: z.array(z.string()),
  content: z.string(),
  updatedAt: z.string(),
});

const exportBundleSchema = z.object({
  format: z.literal('cortexia-research-bundle-v1'),
  exportedAt: z.string(),
  runs: z.array(runRecordSchema),
  notebooks: z.array(notebookSchema),
});

const STORAGE_KEY = 'cortexia.research.v1';

// Non-reactive cache of large ModelOutput typed arrays for in-session overlay comparison.
const runOutputCache = new Map<string, ModelOutput>();
export function getCachedRunOutput(runId: string): ModelOutput | undefined {
  return runOutputCache.get(runId);
}

function loadPersisted(): { runs: ExperimentRunRecord[]; notebooks: ResearchNotebook[] } {
  const defaultNotebook: ResearchNotebook = {
    id: 'NB-DEFAULT',
    title: 'Computational Neuroscience Lab Notes',
    linkedRunIds: [],
    linkedEntityIds: ['MODEL-001', 'ANAT-HIPPOCAMPUS-CA1', 'EXP-040'],
    content: [
      '# CORTEXIA Experiment Notebook',
      '',
      'Document reproducible parameter perturbations, solver stability comparisons, and Digital Twin observations here.',
      '',
      '- **Baseline check:** Verify `MODEL-001` Hodgkin–Huxley resting equilibrium (-65 mV) and 10 uA/cm2 repetitive firing.',
      '- **Cross-scale check:** Compare single-cell AdEx f–I gain against `EXP-040` E/I microcircuit gamma power.',
    ].join('\n'),
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof localStorage === 'undefined') return { runs: [], notebooks: [defaultNotebook] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runs: [], notebooks: [defaultNotebook] };
    const parsed = JSON.parse(raw) as { runs?: unknown; notebooks?: unknown };
    const runs = z.array(runRecordSchema).safeParse(parsed.runs);
    const notebooks = z.array(notebookSchema).safeParse(parsed.notebooks);
    return {
      runs: runs.success ? (runs.data as ExperimentRunRecord[]) : [],
      notebooks: notebooks.success && notebooks.data.length > 0 ? notebooks.data : [defaultNotebook],
    };
  } catch {
    return { runs: [], notebooks: [defaultNotebook] };
  }
}

function persist(runs: ExperimentRunRecord[], notebooks: ResearchNotebook[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ runs: runs.slice(0, 60), notebooks }));
    }
  } catch {
    // Quota exceeded or disabled storage: keep in memory only.
  }
}

interface ResearchState {
  runs: ExperimentRunRecord[];
  compareRunIds: string[];
  notebooks: ResearchNotebook[];
  activeNotebookId: string;

  addRun: (record: Omit<ExperimentRunRecord, 'runId' | 'createdAt'>, output?: ModelOutput) => ExperimentRunRecord;
  toggleCompareRun: (runId: string) => void;
  deleteRun: (runId: string) => void;
  setActiveNotebook: (id: string) => void;
  updateNotebook: (id: string, patch: Partial<Pick<ResearchNotebook, 'title' | 'content' | 'linkedRunIds' | 'linkedEntityIds'>>) => void;
  createNotebook: (title: string) => void;
  exportBundleJson: () => string;
  importBundleJson: (jsonText: string) => { importedRuns: number; importedNotebooks: number };
}

const initial = loadPersisted();

export const useResearchStore = create<ResearchState>((set, get) => ({
  runs: initial.runs,
  compareRunIds: [],
  notebooks: initial.notebooks,
  activeNotebookId: initial.notebooks[0]?.id ?? 'NB-DEFAULT',

  addRun: (record, output) => {
    const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const full: ExperimentRunRecord = { ...record, runId, createdAt: new Date().toISOString() };
    if (output) runOutputCache.set(runId, output);
    set((s) => {
      const runs = [full, ...s.runs].slice(0, 60);
      persist(runs, s.notebooks);
      return { runs };
    });
    return full;
  },

  toggleCompareRun: (runId) =>
    set((s) => {
      const exists = s.compareRunIds.includes(runId);
      const compareRunIds = exists
        ? s.compareRunIds.filter((id) => id !== runId)
        : [...s.compareRunIds.slice(-3), runId];
      return { compareRunIds };
    }),

  deleteRun: (runId) =>
    set((s) => {
      runOutputCache.delete(runId);
      const runs = s.runs.filter((r) => r.runId !== runId);
      const compareRunIds = s.compareRunIds.filter((id) => id !== runId);
      persist(runs, s.notebooks);
      return { runs, compareRunIds };
    }),

  setActiveNotebook: (id) => set({ activeNotebookId: id }),

  updateNotebook: (id, patch) =>
    set((s) => {
      const notebooks = s.notebooks.map((nb) =>
        nb.id === id ? { ...nb, ...patch, updatedAt: new Date().toISOString() } : nb,
      );
      persist(s.runs, notebooks);
      return { notebooks };
    }),

  createNotebook: (title) =>
    set((s) => {
      const nb: ResearchNotebook = {
        id: `NB-${Date.now().toString(36).toUpperCase()}`,
        title: title.trim() || 'Untitled Research Note',
        linkedRunIds: [],
        linkedEntityIds: [],
        content: `# ${title.trim() || 'Untitled Research Note'}\n\n`,
        updatedAt: new Date().toISOString(),
      };
      const notebooks = [nb, ...s.notebooks];
      persist(s.runs, notebooks);
      return { notebooks, activeNotebookId: nb.id };
    }),

  exportBundleJson: () => {
    const s = get();
    return JSON.stringify(
      {
        format: 'cortexia-research-bundle-v1',
        exportedAt: new Date().toISOString(),
        runs: s.runs,
        notebooks: s.notebooks,
      },
      null,
      2,
    );
  },

  importBundleJson: (jsonText) => {
    const parsed = exportBundleSchema.parse(JSON.parse(jsonText));
    set((s) => {
      const existingRunIds = new Set(s.runs.map((r) => r.runId));
      const mergedRuns = [
        ...(parsed.runs as ExperimentRunRecord[]).filter((r) => !existingRunIds.has(r.runId)),
        ...s.runs,
      ].slice(0, 60);
      const existingNbIds = new Set(s.notebooks.map((n) => n.id));
      const mergedNbs = [
        ...parsed.notebooks.filter((n) => !existingNbIds.has(n.id)),
        ...s.notebooks,
      ];
      persist(mergedRuns, mergedNbs);
      return { runs: mergedRuns, notebooks: mergedNbs };
    });
    return { importedRuns: parsed.runs.length, importedNotebooks: parsed.notebooks.length };
  },
}));
