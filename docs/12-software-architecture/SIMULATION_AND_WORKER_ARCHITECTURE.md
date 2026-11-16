# Simulation & Web Worker Architecture — CORTEXIA

**Document ID:** `DOC-ARCH-003`  
**Module:** `MOD-08`, `MOD-11`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies CORTEXIA's off-main-thread Web Worker architecture, typed message protocol, zero-copy `Transferable` buffer management, job cancellation, progress telemetry, and benchmark-gated Rust/WebAssembly acceleration contract.

## 2. Worker Pool & Thread Topology

1. **`SimulationWorker` (Dedicated Worker):** Executes ODE solvers (`RK4`, `Rush–Larsen`, `Euler–Maruyama`, `HybridSpike`), SNN ring-buffer propagation, STDP trace updates, and 5-tier Digital Twin multi-stage pipelines.
2. **`AnalyticsWorker` (Dedicated Worker):** Executes FIR/IIR `filtfilt`, FFT, Welch PSD, STFT, Morlet wavelet convolution, spike CCG/STA, Brandes betweenness centrality, Maslov–Sneppen null-graph rewiring, and bootstrap resampling.
3. **`SweepWorkerPool` (`navigator.hardwareConcurrency` capped at `2–4` workers):** Parallelizes independent parameter-sweep grid points (`EXP_PARAM_SWEEP`) and multi-seed stochastic ensembles (`EXP_STOCHASTIC_REPEAT`).

---

## 3. Typed Worker Messaging Protocol

```ts
export type SimulationWorkerRequest =
  | {
      type: 'RUN_SIMULATION';
      jobId: string;
      modelId: string;
      solverId: string;
      dtMs: number;
      durationMs: number;
      randomSeed: number;
      parameters: Record<string, number>;
      initialConditions: Record<string, number>;
      stimulus: StimulusConfig;
      streamDecimationHz: number; // e.g., 60 Hz for live 3D/plot updates
    }
  | { type: 'CANCEL_JOB'; jobId: string }
  | { type: 'RUN_PARAMETER_SWEEP'; jobId: string; sweepConfig: SweepConfig };

export type SimulationWorkerResponse =
  | { type: 'JOB_PROGRESS'; jobId: string; progressPct: number; elapsedMs: number }
  | {
      type: 'TELEMETRY_CHUNK';
      jobId: string;
      timeRangeMs: [number, number];
      packedBuffer: ArrayBuffer; // Transferred zero-copy via postMessage(..., [packedBuffer])
    }
  | {
      type: 'JOB_COMPLETE';
      jobId: string;
      manifest: ExperimentResultManifest;
      outputBuffer: ArrayBuffer; // Transferred zero-copy
    }
  | {
      type: 'JOB_ERROR';
      jobId: string;
      errorCode: 'ERR_NUMERICAL_DIVERGENCE' | 'ERR_ENVELOPE_EXCEEDED' | 'ERR_INVALID_PARAMS';
      message: string;
      failedAtTimeMs?: number;
    };
```

---

## 4. Zero-Copy Buffer Reuse & Cancellation

- **Pre-Allocated Ring & Output Buffers:** Inside the worker, state vectors $\mathbf{y}_n, \mathbf{k}_1\dots\mathbf{k}_4$ are allocated once per run in contiguous `Float64Array` arena slabs (`zero GC allocations` inside the inner time-step loop).
- **Decimated Output Storage:** If a long simulation (`e.g., 10,000 ms` at `dt = 0.01 ms` = `1,000,000` steps) would exceed `32 MB` of raw trace storage, the worker retains full-resolution integration internally while downsampling recorded trace points to a configurable output stride (`<= 100,000` points per trace) while preserving exact spike peak times and timestamps.
- **Cooperative Cancellation (`CANCEL_JOB`):** The worker checks an atomic/boolean cancellation flag every `500` solver steps (`~0.5–2 ms`), allowing instant user cancellation (`< 10 ms` latency) without terminating and re-spawning the worker thread unless a hard `5,000 ms` watchdog timeout expires.

---

## 5. Optional Rust / WebAssembly Kernel Gate

To prevent premature build complexity while supporting flagship compute performance:
- All 28 models and 26 analytics methods MUST first have clean, readable, double-precision TypeScript reference implementations in `src/kernels/`.
- A Rust/WASM kernel (`wasm-bindgen` / `Float64Array` slice views) is compiled and loaded only when benchmarked TS execution exceeds `250 ms` for a standard single-run interactive experiment (specifically targeted at `MODEL-021`/`022` SNNs with `N >= 2,000` neurons and `ANALYTIC-006` multichannel Morlet wavelet spectrograms).
- Both TS and WASM kernels MUST pass the exact same `VAL-*` numerical test oracle in Vitest.

## 6. Acceptance Criteria & Related Documents

- **AC-ARCH-003:** Zero `ArrayBuffer` copies occur on `JOB_COMPLETE` payload transfers (`Transferable` ownership verified); cancellation halts worker integration in `< 15 ms`.
- **Links:** [NUMERICAL_METHODS.md](../06-computational-models/NUMERICAL_METHODS.md), [PERFORMANCE_ARCHITECTURE.md](PERFORMANCE_ARCHITECTURE.md), [ERROR_HANDLING.md](ERROR_HANDLING.md).
