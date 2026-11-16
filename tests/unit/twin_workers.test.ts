import { describe, expect, it } from 'vitest';
import { configWith } from '../../src/kernels/core/config';
import { runEnsemble, runSensitivity, runSweep, runSweep2D } from '../../src/kernels/experiments/run';
import { getModel } from '../../src/kernels/models';
import { TWINS, getTwin } from '../../src/kernels/twin/pipelines';
import { WorkerPool } from '../../src/workers/client';
import { collectTransferables, JobError, type WorkerRequest, type WorkerResponse } from '../../src/workers/protocol';
import { executeSimJob } from '../../src/workers/simulation.worker';
import { executeAnalyticsJob } from '../../src/workers/analytics.worker';
import { erdosRenyi } from '../../src/kernels/models/graphs';
import { Rng } from '../../src/kernels/core/prng';

describe('Digital Twin pipelines (EXP-040, EXP-041, EXP-042)', () => {
  it('registers all 3 flagship experiments with valid metadata', () => {
    expect(TWINS.map((t) => t.id)).toEqual(['EXP-040', 'EXP-041', 'EXP-042']);
    for (const t of TWINS) {
      expect(t.provenance).toBe('SYNTHETIC_SIMULATION');
      expect(t.stages.some((s) => s.coupling === 'MECHANISTIC')).toBe(true);
      expect(t.stages.some((s) => s.coupling === 'CONCEPTUAL')).toBe(true);
      expect(t.limitations.length).toBeGreaterThanOrEqual(3);
      expect(t.references.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('EXP-040: lowering gL reduces rheobase and shifts microcircuit firing rate', () => {
    const t = getTwin('EXP-040');
    const r = t.run({ duration: 800, gL_base: 30, gL_int: 22 }, 42);
    expect(r.experimentId).toBe('EXP-040');
    const rheo = r.comparisons.find((c) => c.key === 'rheobase')!;
    const rateE = r.comparisons.find((c) => c.key === 'rateE')!;
    expect(rheo.intervention).toBeLessThan(rheo.baseline);
    expect(rateE.intervention).toBeGreaterThan(rateE.baseline);
    expect(r.conditions.baseline.curves.lfp_psd?.y.length).toBeGreaterThan(5);
    expect(r.stages).toHaveLength(5);
  });

  it('EXP-041: pair-based STDP strengthens forward weights within [0, w_max] and raises cue recall', () => {
    const t = getTwin('EXP-041');
    const r = t.run({}, 42);
    expect(r.experimentId).toBe('EXP-041');
    const recall = r.comparisons.find((c) => c.key === 'recallMean')!;
    const fwd = r.comparisons.find((c) => c.key === 'forwardWeight')!;
    const bwd = r.comparisons.find((c) => c.key === 'backwardWeight')!;
    const wmax = r.comparisons.find((c) => c.key === 'weightMax')!;
    const dir = r.comparisons.find((c) => c.key === 'directionality')!;
    expect(fwd.intervention).toBeGreaterThan(bwd.intervention);
    expect(wmax.intervention).toBeLessThanOrEqual(6 + 1e-9);
    expect(dir.intervention).toBeGreaterThan(0.1);
    expect(recall.intervention).toBeGreaterThan(recall.baseline);
  });

  it('EXP-042: supercritical connectome coupling raises order parameter and pairwise PLV', () => {
    const t = getTwin('EXP-042');
    const r1 = t.run({ duration: 2500, G_base: 1.5, G_int: 12 }, 42);
    const r2 = t.run({ duration: 2500, G_base: 1.5, G_int: 12 }, 42);
    expect(r1.experimentId).toBe('EXP-042');
    const ord = r1.comparisons.find((c) => c.key === 'orderMean')!;
    const plv = r1.comparisons.find((c) => c.key === 'plvMean')!;
    const peak = r1.comparisons.find((c) => c.key === 'peakFreqHz')!;
    expect(ord.intervention).toBeGreaterThan(ord.baseline);
    expect(plv.intervention).toBeGreaterThan(plv.baseline);
    expect(plv.intervention).toBeLessThanOrEqual(1);
    expect(peak.intervention).toBeGreaterThan(4);
    expect(peak.intervention).toBeLessThan(20);
    // Bit-identical determinism for same seed
    expect(Array.from(r1.conditions.intervention.series.R!)).toEqual(Array.from(r2.conditions.intervention.series.R!));
    const plvMat = r1.conditions.intervention.matrices.PLV!;
    expect(plvMat.rows).toBe(68);
    expect(plvMat.data[0]).toBeCloseTo(1, 9);
  });
});

describe('Experiment drivers (sweeps, sensitivity, ensemble)', () => {
  it('runs 1D sweep, 2D sweep, OAT sensitivity, and multi-seed ensemble', () => {
    const hh = getModel('MODEL-001');
    const base = configWith(hh, { durationMs: 60, stimulus: { kind: 'step', amplitude: 10, startMs: 5, durationMs: 1e9 } });
    const s1 = runSweep(hh, base, 'g_Na_max', [80, 120, 160]);
    expect(s1.values.length).toBe(3);
    expect(s1.metrics.peakVoltageMv![2]).toBeGreaterThan(s1.metrics.peakVoltageMv![0]!);

    const lif = getModel('MODEL-005');
    const lbase = configWith(lif, { durationMs: 300, stimulus: { kind: 'step', amplitude: 400, startMs: 0, durationMs: 1e9 } });
    const s2 = runSweep2D(lif, lbase, 'stimulus.amplitude', [300, 500], 'R_m_LIF', [100, 150], 'firingRateHz');
    expect(s2.grid.length).toBe(4);
    expect(s2.grid[3]).toBeGreaterThan(s2.grid[0]!);

    const sens = runSensitivity(lif, lbase, 'firingRateHz');
    expect(sens.rows.length).toBeGreaterThan(0);
    expect(Number.isFinite(sens.rows[0]!.index)).toBe(true);

    const ens = runEnsemble(getModel('MODEL-018'), configWith(getModel('MODEL-018'), { durationMs: 2500 }), [1, 2, 3]);
    expect(ens.seeds).toEqual([1, 2, 3]);
    expect(Number.isFinite(ens.mean.eegAmplitudeMv)).toBe(true);
  });
});

describe('Worker protocol & WorkerPool lifecycle', () => {
  it('collects ArrayBuffers recursively without duplicates', () => {
    const a = new Float64Array(4);
    const b = new Uint32Array(3);
    const transfers = collectTransferables({ a, nested: [b, a.buffer] });
    expect(transfers).toHaveLength(2);
    expect(transfers).toContain(a.buffer);
    expect(transfers).toContain(b.buffer);
  });

  it('supports progress, completion, error and terminate-on-cancel', async () => {
    let terminated = 0;
    class MockWorker {
      onmessage: ((ev: MessageEvent<WorkerResponse<number>>) => void) | null = null;
      onerror: ((ev: ErrorEvent) => void) | null = null;
      postMessage(req: WorkerRequest<{ delayMs: number; fail?: boolean }>) {
        if (req.job.fail) {
          setTimeout(() => this.onmessage?.({ data: { type: 'ERROR', jobId: req.jobId, code: 'ERR_TEST', message: 'boom' } } as MessageEvent), 5);
          return;
        }
        setTimeout(() => this.onmessage?.({ data: { type: 'PROGRESS', jobId: req.jobId, fraction: 0.5, label: 'half' } } as MessageEvent), 5);
        setTimeout(() => this.onmessage?.({ data: { type: 'DONE', jobId: req.jobId, result: 42, elapsedMs: 10 } } as MessageEvent), req.job.delayMs);
      }
      terminate() { terminated++; }
    }
    const pool = new WorkerPool<{ delayMs: number; fail?: boolean }>(() => new MockWorker() as unknown as Worker, 2, 2000);
    const progress: number[] = [];
    const h1 = pool.submit<number>({ delayMs: 15 }, (f) => progress.push(f));
    const r1 = await h1.promise;
    expect(r1.result).toBe(42);
    expect(progress).toEqual([0.5]);

    const h2 = pool.submit<number>({ delayMs: 200 });
    h2.cancel();
    await expect(h2.promise).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(terminated).toBe(1);

    const h3 = pool.submit<number>({ delayMs: 5, fail: true });
    await expect(h3.promise).rejects.toBeInstanceOf(JobError);

    pool.dispose();
  });

  it('executes simulation and analytics worker jobs directly', () => {
    const simRes = executeSimJob({ kind: 'validate', caseId: 'VAL-FHN-001' });
    expect((simRes as { passed: boolean }).passed).toBe(true);

    const fs = 250;
    const sig = Float64Array.from({ length: 500 }, (_, i) => Math.sin(2 * Math.PI * 10 * (i / fs)));
    const sigOut = executeAnalyticsJob({
      kind: 'signalSuite', signal: sig, fs, filterMode: 'none', lowHz: 1, highHz: 40, order: 4,
      useFir: false, demean: true, detrend: false, window: 'hann', welchSegLen: 128, stftWinLen: 64,
      waveletFreqs: [5, 10, 20], waveletCycles: 6,
    }) as { peakHz: number };
    expect(sigOut.peakHz).toBeGreaterThan(7);
    expect(sigOut.peakHz).toBeLessThan(13);

    const g = erdosRenyi(16, 0.3, new Rng(7));
    const netOut = executeAnalyticsJob({ kind: 'networkSuite', weights: g, n: 16, seed: 7, computeSmallWorld: true, computeLesion: true }) as { summary: { nodes: number }; lesion?: { fractions: Float64Array } };
    expect(netOut.summary.nodes).toBe(16);
    expect(netOut.lesion?.fractions.length).toBe(15);
  });
});
