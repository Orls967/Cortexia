import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveEntityRoute, searchEntities } from '../../src/data/routeResolver';
import type { IndexEntity } from '../../src/data/types';
import { MODELS } from '../../src/kernels/models';
import { ANALYTIC_METHODS } from '../../src/kernels/analytics';
import { parseCsvDataset } from '../../src/stores/analyticsStore';
import { useResearchStore } from '../../src/stores/researchStore';
import { useSelectionStore } from '../../src/stores/selectionStore';

const DATA_DIR = join(process.cwd(), 'public', 'data');

function loadLocalIndex() {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf8')) as {
    entities: [string, string, string, IndexEntity['scale'], string, IndexEntity['epistemic'], string[]][];
  };
  const list: IndexEntity[] = raw.entities.map(([id, name, type, scale, shortDefinition, epistemic, aliases]) => ({
    id, name, type, scale, shortDefinition, epistemic, aliases,
  }));
  return { list, byId: new Map(list.map((e) => [e.id, e])) };
}

describe('Platform Data, UCES Coverage, Search, CSV & Research Store', () => {
  it('verifies all 28 models and 26 analytics methods have UCES explanations & valid routes', () => {
    const idx = loadLocalIndex();
    expect(idx.list.length).toBeGreaterThanOrEqual(750);

    for (const m of MODELS) {
      expect(idx.byId.has(m.id)).toBe(true);
      const chunk = JSON.parse(readFileSync(join(DATA_DIR, 'expl', 'MODEL.json'), 'utf8')) as Record<string, { explanationCompleteness: string }>;
      expect(chunk[m.id]?.explanationCompleteness).toBe('COMPLETE');
      const r = resolveEntityRoute(m.id);
      expect(r.knowledgePath).toBe(`/knowledge/${m.id}`);
      expect(r.labPath).toBe(`/lab/${m.id}`);
    }

    const aChunk = JSON.parse(readFileSync(join(DATA_DIR, 'expl', 'ANALYTIC.json'), 'utf8')) as Record<string, { explanationCompleteness: string }>;
    for (const id of Object.keys(ANALYTIC_METHODS)) {
      expect(idx.byId.has(id)).toBe(true);
      expect(aChunk[id]?.explanationCompleteness).toBe('COMPLETE');
    }
  });

  it('searches entity index with prefix filters and aliases under 30 ms (AC-PROD-005)', () => {
    const idx = loadLocalIndex();
    const t0 = performance.now();
    const anatHits = searchEntities(idx as unknown as Parameters<typeof searchEntities>[0], 'anat:hippocampus');
    const modelHits = searchEntities(idx as unknown as Parameters<typeof searchEntities>[0], 'model:Hodgkin');
    const aliasHits = searchEntities(idx as unknown as Parameters<typeof searchEntities>[0], 'Ammon');
    const dt = performance.now() - t0;

    expect(anatHits.some((e) => e.id === 'ANAT-HIPPOCAMPUS')).toBe(true);
    expect(modelHits.some((e) => e.id === 'MODEL-001')).toBe(true);
    expect(aliasHits.length).toBeGreaterThan(0);
    expect(dt).toBeLessThan(30);
  });

  it('validates and parses CSV datasets while rejecting malformed inputs', () => {
    const csv = 'time_s,EEG_Cz,EEG_Oz\n0.00,1.2,2.4\n0.01,1.5,2.1\n0.02,0.8,1.9\n0.03,1.1,2.0\n';
    const good = parseCsvDataset(csv, 'test.csv', 100, 'uV');
    expect(good.ok).toBe(true);
    expect(good.meta?.channelNames).toEqual(['EEG_Cz', 'EEG_Oz']);
    expect(good.meta?.sampleCount).toBe(4);
    expect(good.payload?.channels?.[0]?.[1]).toBeCloseTo(1.5, 6);

    const badFs = parseCsvDataset(csv, 'test.csv', -10, 'uV');
    expect(badFs.ok).toBe(false);

    const badRows = parseCsvDataset('a,b\n1,2\n', 'tiny.csv', 100, 'uV');
    expect(badRows.ok).toBe(false);
  });

  it('exports and re-imports research bundles with Zod validation', () => {
    const st = useResearchStore.getState();
    const added = st.addRun({
      experimentType: 'SINGLE_RUN',
      modelId: 'MODEL-001',
      modelName: 'Hodgkin–Huxley',
      modelVersion: '1.0.0',
      config: {
        params: { g_Na_max: 120 },
        initial: { V: -65 },
        stimulus: { kind: 'step', amplitude: 10, baseline: 0, startMs: 5, durationMs: 50, pulseWidthMs: 1, pulseIntervalMs: 20, pulseCount: 2, laterPulseScale: 1, frequencyHz: 10, sigma: 0, tauMs: 5 },
        solver: 'SOLVER-RK4',
        dtMs: 0.01,
        durationMs: 60,
        seed: 42,
      },
      metrics: { spikeCount: 4 },
      status: 'COMPLETED',
      elapsedMs: 12,
      notes: ['test run'],
    });
    const json = useResearchStore.getState().exportBundleJson();
    useResearchStore.getState().deleteRun(added.runId);
    expect(useResearchStore.getState().runs.some((r) => r.runId === added.runId)).toBe(false);
    const res = useResearchStore.getState().importBundleJson(json);
    expect(res.importedRuns).toBeGreaterThanOrEqual(1);
    expect(useResearchStore.getState().runs.some((r) => r.runId === added.runId)).toBe(true);
  });

  it('updates universal selection state and recent entity history', () => {
    useSelectionStore.getState().selectEntity('ANAT-HIPPOCAMPUS-CA1', { scale: 'L7' });
    const s = useSelectionStore.getState();
    expect(s.selectedEntityId).toBe('ANAT-HIPPOCAMPUS-CA1');
    expect(s.inspectorOpen).toBe(true);
    expect(s.recentEntityIds[0]).toBe('ANAT-HIPPOCAMPUS-CA1');
  });
});
