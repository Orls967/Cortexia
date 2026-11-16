# Performance Benchmarks Specification — CORTEXIA

**Document ID:** `DOC-QA-003`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the repeatable benchmark suite (`BM-001`–`BM-010`), hardware reference profiles, measurement instrumentation, and pass/fail thresholds used to validate CORTEXIA's runtime performance during Phases D–H.

## 2. Reference Hardware Profiles

1. **Profile A (Desktop Reference):** 8-core CPU (Apple M1/M2 or Intel Core i5/Ryzen 5), `16 GB` RAM, integrated WebGL2 GPU, `1920×1080` viewport.
2. **Profile B (Constrained Laptop / Mobile Reference):** 4-core CPU / throttled `4×` CPU in Playwright, `4 GB` tab memory ceiling, mobile/integrated WebGL2 GPU, `390×844` viewport.

---

## 3. Standardized Benchmark Suite (`BM-001` – `BM-010`)

| Benchmark ID | Workload Specification | Target Metric (Profile A) | Target Metric (Profile B) |
|---|---|---|---|
| `BM-001` | **Cold Boot & Observatory Render (`/explore/observatory`)** | `FCP <= 1.2 s`, `TTI <= 1.8 s` | `FCP <= 1.8 s`, `TTI <= 2.8 s` |
| `BM-002` | **Studio A Whole Brain 360° Orbit + Clipping Sweep (`100k` tris)** | Mean `>= 60 fps`, `1% low >= 50 fps` | Mean `>= 30 fps`, `1% low >= 24 fps` |
| `BM-003` | **BVH Raycast Hover Pick across 110 Anatomical Structures** | P95 `< 1.5 ms` per pointer move | P95 `< 3.5 ms` per tap pick |
| `BM-004` | **Hodgkin–Huxley (`MODEL-001`) Single Run (`T=500 ms, dt=0.01 ms, RK4`)** | Worker wall time `<= 35 ms` | Worker wall time `<= 90 ms` |
| `BM-005` | **Hodgkin–Huxley 25-Point `I_ext` Parameter Sweep (`T=200 ms` each)** | Parallel pool time `<= 220 ms` | Parallel pool time `<= 600 ms` |
| `BM-006` | **Brunel SNN (`MODEL-021`, `N=1,000`, `100k` synapses, `T=1,000 ms, dt=0.1 ms`)** | Worker wall time `<= 450 ms` | Worker wall time `<= 1,100 ms` |
| `BM-007` | **Kuramoto 68-Region Connectome (`MODEL-027`, `T=5,000 ms, dt=0.5 ms`)** | Worker wall time `<= 120 ms` | Worker wall time `<= 300 ms` |
| `BM-008` | **Multichannel EEG Filter + Welch PSD (`16 ch × 30 s @ 256 Hz`)** | Worker wall time `<= 80 ms` | Worker wall time `<= 220 ms` |
| `BM-009` | **Morlet Wavelet Time-Frequency (`1 ch × 10 s @ 256 Hz × 40 freqs`)** | Worker wall time `<= 150 ms` | Worker wall time `<= 400 ms` |
| `BM-010` | **20 Sequential Studio Switches (`A → B → C → D × 5`) Memory Soak** | Heap growth `< 15 MB` post-GC; `0` leaked WebGL geometries | Heap growth `< 15 MB`; zero tab crash |

---

## 4. Benchmark Instrumentation Procedure

- **Numerical Kernels (`BM-004`–`BM-009`):** Executed via `vitest bench` (`tinybench`, `20` warmup iterations + `100` timed iterations) recording mean, median, P95, P99, and allocation bytes.
- **Browser & WebGL (`BM-001`–`BM-003`, `BM-010`):** Executed via headless/headed Playwright capturing `window.performance.getEntriesByType('navigation')`, custom `performance.mark()` spans, and Three.js `renderer.info.memory` counters.

## 5. Acceptance Criteria & Related Documents

- **AC-QA-003:** If any TypeScript kernel fails `BM-006` or `BM-009` on Profile A during Phase D/F benchmarking, the optional Rust/WASM kernel specified in [SIMULATION_AND_WORKER_ARCHITECTURE.md](../12-software-architecture/SIMULATION_AND_WORKER_ARCHITECTURE.md) is triggered automatically.
- **Links:** [PERFORMANCE_ARCHITECTURE.md](../12-software-architecture/PERFORMANCE_ARCHITECTURE.md), [TEST_STRATEGY.md](TEST_STRATEGY.md).
