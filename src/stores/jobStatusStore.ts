// Light mirror of the laboratory job state for the application shell's status bar. Keeping it separate means the
// shell does not import the laboratory store, and therefore not the model kernels, into the initial bundle.
import { create } from 'zustand';

export type ShellJobStatus = 'IDLE' | 'RUNNING' | 'CANCELLED' | 'COMPLETED' | 'ERROR';

interface JobStatusState {
  jobStatus: ShellJobStatus;
  progress: number;
  progressLabel: string;
  /** Cancels the running job; set by the laboratory store when it loads. */
  cancel: (() => void) | null;
}

export const useJobStatusStore = create<JobStatusState>(() => ({ jobStatus: 'IDLE', progress: 0, progressLabel: '', cancel: null }));
