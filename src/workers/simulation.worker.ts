// Dedicated Web Worker for all 28 computational models, sweeps, sensitivity, ensembles, validation cases
// and the 3 five-tier Digital Twin pipelines. Zero DOM access; results transferred via ArrayBuffer ownership.
/// <reference lib="webworker" />
import { SimulationError } from '../kernels/core/types';
import { runEnsemble, runSensitivity, runSweep, runSweep2D } from '../kernels/experiments/run';
import { getModel } from '../kernels/models';
import { getTwin } from '../kernels/twin/pipelines';
import { runValidation } from '../kernels/validation/cases';
import { collectTransferables, type SimJob, type SimResultMap, type WorkerRequest, type WorkerResponse } from './protocol';

function post(msg: WorkerResponse<unknown>, transfer: Transferable[] = []): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
}

export function executeSimJob(job: SimJob, onProgress?: (fraction: number, label?: string) => void): SimResultMap[keyof SimResultMap] {
  switch (job.kind) {
    case 'run':
      return getModel(job.modelId).run(job.config, { onProgress: (f) => onProgress?.(f) });
    case 'sweep':
      return runSweep(getModel(job.modelId), job.config, job.paramKey, job.values, (f) => onProgress?.(f, `Sweep ${Math.round(f * 100)}%`));
    case 'sweep2d':
      return runSweep2D(getModel(job.modelId), job.config, job.keyX, job.xs, job.keyY, job.ys, job.metricKey, (f) => onProgress?.(f, `2D sweep ${Math.round(f * 100)}%`));
    case 'sensitivity':
      return runSensitivity(getModel(job.modelId), job.config, job.metricKey, (f) => onProgress?.(f, `Sensitivity ${Math.round(f * 100)}%`));
    case 'ensemble':
      return runEnsemble(getModel(job.modelId), job.config, job.seeds, (f) => onProgress?.(f, `Ensemble ${Math.round(f * 100)}%`));
    case 'validate':
      return runValidation(job.caseId);
    case 'twin':
      return getTwin(job.experimentId).run(job.params, job.seed, onProgress);
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = (ev: MessageEvent<WorkerRequest<SimJob>>) => {
    const { jobId, job } = ev.data;
    const t0 = performance.now();
    let lastProgressAt = 0;
    const onProgress = (fraction: number, label?: string) => {
      const now = performance.now();
      if (fraction < 1 && now - lastProgressAt < 40) return;
      lastProgressAt = now;
      post({ type: 'PROGRESS', jobId, fraction, ...(label !== undefined ? { label } : {}) });
    };
    try {
      const result = executeSimJob(job, onProgress);
      const elapsedMs = performance.now() - t0;
      const transfers = collectTransferables(result);
      post({ type: 'DONE', jobId, result, elapsedMs }, transfers);
    } catch (err) {
      if (err instanceof SimulationError) {
        post({ type: 'ERROR', jobId, code: err.code, message: err.message, ...(err.failedAtMs !== undefined ? { failedAtMs: err.failedAtMs } : {}) });
      } else {
        post({ type: 'ERROR', jobId, code: 'ERR_SIMULATION_FAILED', message: err instanceof Error ? err.message : String(err) });
      }
    }
  };
}
