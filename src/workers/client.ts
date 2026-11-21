// Worker pool with progress, cancellation and a heartbeat watchdog. Cancellation terminates the worker and
// spawns a fresh one on demand: GitHub Pages cannot send the COOP/COEP headers that SharedArrayBuffer-based
// cooperative cancellation would need, and termination stops a synchronous kernel loop immediately.
import { JobError, type WorkerRequest, type WorkerResponse } from './protocol';

export interface JobHandle<R> { promise: Promise<{ result: R; elapsedMs: number }>; cancel: () => void; jobId: string }

interface Slot { worker: Worker; busy: boolean }

interface PendingJob<J, R> {
  jobId: string;
  job: J;
  onProgress?: (fraction: number, label?: string) => void;
  resolve: (value: { result: R; elapsedMs: number }) => void;
  reject: (err: Error) => void;
  cancelActive?: () => void;
  cancelled: boolean;
}

export class WorkerPool<J> {
  private slots: Slot[] = [];
  private queue: PendingJob<J, unknown>[] = [];
  private counter = 0;
  constructor(private factory: () => Worker, private maxWorkers = 2, private heartbeatMs = 30000) {}

  private acquire(): Slot | null {
    const free = this.slots.find((s) => !s.busy);
    if (free) return free;
    if (this.slots.length < this.maxWorkers) {
      const slot: Slot = { worker: this.factory(), busy: false };
      this.slots.push(slot);
      return slot;
    }
    return null;
  }

  private discard(slot: Slot): void {
    slot.worker.terminate();
    this.slots = this.slots.filter((s) => s !== slot);
  }

  private dispatchNext(): void {
    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      if (next.cancelled) {
        this.queue.shift();
        continue;
      }
      const slot = this.acquire();
      if (!slot) return;
      this.queue.shift();
      this.runOnSlot(slot, next);
    }
  }

  private runOnSlot<R>(slot: Slot, item: PendingJob<J, R>): void {
    slot.busy = true;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (keep: boolean) => {
      settled = true;
      if (timer) clearTimeout(timer);
      slot.worker.onmessage = null;
      slot.worker.onerror = null;
      slot.busy = false;
      if (!keep || this.slots.length > this.maxWorkers) this.discard(slot);
      this.dispatchNext();
    };
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!settled) {
          finish(false);
          item.reject(new JobError('ERR_WORKER_TIMEOUT', `The worker stopped responding for ${this.heartbeatMs / 1000} s and was restarted.`));
        }
      }, this.heartbeatMs);
    };
    slot.worker.onmessage = (ev: MessageEvent<WorkerResponse<R>>) => {
      const msg = ev.data;
      if (msg.jobId !== item.jobId || settled) return;
      if (msg.type === 'PROGRESS') { arm(); item.onProgress?.(msg.fraction, msg.label); }
      else if (msg.type === 'DONE') { finish(true); item.resolve({ result: msg.result, elapsedMs: msg.elapsedMs }); }
      else { finish(true); item.reject(new JobError(msg.code, msg.message, msg.failedAtMs)); }
    };
    slot.worker.onerror = (ev) => {
      if (!settled) {
        finish(false);
        item.reject(new JobError('ERR_WORKER_CRASHED', ev.message || 'The worker crashed.'));
      }
    };
    // Allow cancellation while active on this slot
    item.cancelActive = () => {
      if (!settled) {
        finish(false);
        item.reject(new JobError('CANCELLED', 'The job was cancelled.'));
      }
    };
    arm();
    slot.worker.postMessage({ jobId: item.jobId, job: item.job } satisfies WorkerRequest<J>);
  }

  submit<R>(job: J, onProgress?: (fraction: number, label?: string) => void): JobHandle<R> {
    const jobId = `JOB-${Date.now().toString(36)}-${(++this.counter).toString(36)}`;
    let itemRef: PendingJob<J, R> | null = null;
    const promise = new Promise<{ result: R; elapsedMs: number }>((resolve, reject) => {
      const item: PendingJob<J, R> = {
        jobId,
        job,
        ...(onProgress ? { onProgress } : {}),
        resolve,
        reject,
        cancelled: false,
      };
      itemRef = item;
      const slot = this.acquire();
      if (slot) {
        this.runOnSlot(slot, item);
      } else {
        this.queue.push(item as PendingJob<J, unknown>);
      }
    });
    return {
      jobId,
      promise,
      cancel: () => {
        if (!itemRef || itemRef.cancelled) return;
        itemRef.cancelled = true;
        if (itemRef.cancelActive) itemRef.cancelActive();
        else itemRef.reject(new JobError('CANCELLED', 'The job was cancelled.'));
      },
    };
  }

  dispose(): void {
    for (const item of this.queue) {
      if (!item.cancelled) {
        item.cancelled = true;
        item.reject(new JobError('CANCELLED', 'The worker pool was disposed.'));
      }
    }
    this.queue = [];
    for (const s of this.slots) s.worker.terminate();
    this.slots = [];
  }
}
