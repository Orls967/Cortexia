// Lazy worker pool singletons so unit tests running in Node can import stores without spawning browser Workers.
import { WorkerPool, type JobHandle } from './client';
import type { AnalyticsJob, AnalyticsResultMap, SimJob, SimResultMap } from './protocol';

let simPool: WorkerPool<SimJob> | null = null;
let analyticsPool: WorkerPool<AnalyticsJob> | null = null;

export function getSimPool(): WorkerPool<SimJob> {
  if (!simPool) {
    const maxW = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? Math.min(4, Math.max(2, navigator.hardwareConcurrency - 1)) : 2;
    simPool = new WorkerPool<SimJob>(
      () => new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }),
      maxW,
      30000,
    );
  }
  return simPool;
}

export function getAnalyticsPool(): WorkerPool<AnalyticsJob> {
  if (!analyticsPool) {
    analyticsPool = new WorkerPool<AnalyticsJob>(
      () => new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' }),
      2,
      30000,
    );
  }
  return analyticsPool;
}

export function submitSimJob<K extends keyof SimResultMap>(
  job: Extract<SimJob, { kind: K }>,
  onProgress?: (fraction: number, label?: string) => void,
): JobHandle<SimResultMap[K]> {
  return getSimPool().submit<SimResultMap[K]>(job, onProgress);
}

export function submitAnalyticsJob<K extends keyof AnalyticsResultMap>(
  job: Extract<AnalyticsJob, { kind: K }>,
  onProgress?: (fraction: number, label?: string) => void,
): JobHandle<AnalyticsResultMap[K]> {
  return getAnalyticsPool().submit<AnalyticsResultMap[K]>(job, onProgress);
}
