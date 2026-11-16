// Worker pool with progress, cancellation and a heartbeat watchdog. Cancellation terminates the worker and
// spawns a fresh one on demand: GitHub Pages cannot send the COOP/COEP headers that SharedArrayBuffer-based
// cooperative cancellation would need, and termination stops a synchronous kernel loop immediately.
import { JobError, type WorkerRequest, type WorkerResponse } from './protocol';

export interface JobHandle<R> { promise: Promise<{ result: R; elapsedMs: number }>; cancel: () => void; jobId: string }

interface Slot { worker: Worker; busy: boolean }

export class WorkerPool<J> {
  private slots: Slot[] = [];
  private counter = 0;
  constructor(private factory: () => Worker, private maxWorkers = 2, private heartbeatMs = 30000) {}

  private acquire(): Slot {
    const free = this.slots.find((s) => !s.busy);
    if (free) return free;
    const slot: Slot = { worker: this.factory(), busy: false };
    this.slots.push(slot);
    return slot;
  }

  private discard(slot: Slot): void {
    slot.worker.terminate();
    this.slots = this.slots.filter((s) => s !== slot);
  }

  submit<R>(job: J, onProgress?: (fraction: number, label?: string) => void): JobHandle<R> {
    const jobId = `JOB-${Date.now().toString(36)}-${(++this.counter).toString(36)}`;
    // Above the pool size extra jobs get a temporary worker rather than queueing behind a long run.
    const slot = this.acquire();
    slot.busy = true;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectFn: (e: Error) => void = () => {};
    const finish = (keep: boolean) => {
      settled = true;
      if (timer) clearTimeout(timer);
      slot.worker.onmessage = null;
      slot.worker.onerror = null;
      slot.busy = false;
      if (!keep || this.slots.length > this.maxWorkers) this.discard(slot);
    };
    const promise = new Promise<{ result: R; elapsedMs: number }>((resolve, reject) => {
      rejectFn = reject;
      const arm = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { if (!settled) { finish(false); reject(new JobError('ERR_WORKER_TIMEOUT', `The worker stopped responding for ${this.heartbeatMs / 1000} s and was restarted.`)); } }, this.heartbeatMs);
      };
      slot.worker.onmessage = (ev: MessageEvent<WorkerResponse<R>>) => {
        const msg = ev.data;
        if (msg.jobId !== jobId || settled) return;
        if (msg.type === 'PROGRESS') { arm(); onProgress?.(msg.fraction, msg.label); }
        else if (msg.type === 'DONE') { finish(true); resolve({ result: msg.result, elapsedMs: msg.elapsedMs }); }
        else { finish(true); reject(new JobError(msg.code, msg.message, msg.failedAtMs)); }
      };
      slot.worker.onerror = (ev) => { if (!settled) { finish(false); reject(new JobError('ERR_WORKER_CRASHED', ev.message || 'The worker crashed.')); } };
      arm();
      slot.worker.postMessage({ jobId, job } satisfies WorkerRequest<J>);
    });
    return { jobId, promise, cancel: () => { if (!settled) { finish(false); rejectFn(new JobError('CANCELLED', 'The job was cancelled.')); } } };
  }

  dispose(): void { for (const s of this.slots) s.worker.terminate(); this.slots = []; }
}
