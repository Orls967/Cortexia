# Performance Architecture & Compute Budgets — CORTEXIA

**Document ID:** `DOC-ARCH-004`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document establishes measurable performance budgets, memory ceilings, simulation scaling envelopes, 3D rendering budgets, and profiling procedures for CORTEXIA.

> [!NOTE]
> Per Section 15 of the Master Prompt, Phase 0 defines **measurable engineering targets, hard safety caps, and benchmark protocols** rather than claiming fabricated pre-implementation measurements.

---

## 2. Application & Rendering Performance Budgets

| Metric | Target Budget (Desktop Baseline) | Target Budget (Mobile / Integrated GPU) | Measurement Method |
|---|---|---|---|
| **Initial JS Entry Bundle (Gzip)** | `<= 220 KB` | `<= 220 KB` | Vite build manifest audit |
| **Per-Studio Lazy 3D Asset Chunk** | `<= 2.5 MB` (`.glb` Draco) | `<= 1.5 MB` (`LOD1` default) | Network payload check |
| **First Contentful Paint (`FCP`)** | `<= 1.2 s` (cached / fast 4G) | `<= 1.8 s` | Playwright / Lighthouse trace |
| **3D Viewport Frame Rate** | `60 fps` (`<= 16.6 ms/frame`) | `>= 30 fps` (`<= 33.3 ms/frame`) | `requestAnimationFrame` delta telemetry |
| **3D Draw Calls per Frame** | `<= 120` draw calls | `<= 60` draw calls | `renderer.info.render.calls` |
| **Active Scene Triangle Count** | `<= 180,000` triangles (`LOD0`) | `<= 65,000` triangles (`LOD1/2`) | `renderer.info.render.triangles` |
| **UCES Hover Raycast Latency** | `<= 2.0 ms` (`95th` percentile) | `<= 4.0 ms` (`Tap` pick) | `performance.now()` around BVH raycast |
| **Global Search Query Latency** | `<= 25 ms` across all registries | `<= 40 ms` | Vitest benchmark |
| **Browser Tab Total Heap + GPU Memory** | `<= 550 MB` (`<= 256 MB` Worker) | `<= 300 MB` | Chrome DevTools Memory / `performance.memory` |

---

## 3. Simulation & Analytics Execution Time Targets

| Benchmark Scenario | Target Worker Wall-Clock Time | Max Memory Allocation |
|---|---|---|
| **Hodgkin–Huxley (`MODEL-001`, 1 cell, `T=100 ms`, `dt=0.01 ms`, `RK4`)** | `<= 15 ms` | `<= 2 MB` |
| **Morris–Lecar / AdEx 20-Point `f–I` Sweep (`T=500 ms` each)** | `<= 180 ms` | `<= 12 MB` |
| **Brunel Balanced SNN (`MODEL-021`, `N=1,000`, `100,000` synapses, `T=1,000 ms`, `dt=0.1 ms`)** | `<= 450 ms` | `<= 32 MB` |
| **Kuramoto 68-Region Connectome (`MODEL-027`, `T=5,000 ms`, `dt=0.5 ms`)** | `<= 120 ms` | `<= 8 MB` |
| **Welch PSD + Band Power (16 channels × `30 s` @ `256 Hz`)** | `<= 80 ms` | `<= 16 MB` |
| **Morlet Wavelet Spectrogram (1 channel × `10 s` @ `256 Hz`, `40` frequencies)** | `<= 150 ms` | `<= 24 MB` |
| **Graph Topology Suite (`68×68` weighted matrix + `20` null graphs)** | `<= 120 ms` | `<= 8 MB` |

---

## 4. Mandatory Optimization Techniques

1. **Lazy Module & Registry Splitting:** Load domain registries and 3D `.glb` studios only when their route or inspector is activated.
2. **TypedArray Ring Reuse:** Pre-allocate `Float64Array` scratch buffers per worker; never allocate per-step arrays or objects inside ODE loops.
3. **Canvas2D Decimation (Largest-Triangle-Three-Buckets `LTTB` / Min-Max Envelope):** When plotting `>10,000` time-series points on a `1,000 px`-wide chart, render min-max pixel envelopes so every action potential peak remains visible without drawing `100,000` SVG nodes.
4. **Explicit Resource Disposal:** Dispose WebGL geometries/materials/textures on Studio exit and release old simulation `ArrayBuffer` snapshots when history exceeds `10` pinned runs (`LRU` eviction with user prompt).

## 5. Acceptance Criteria & Related Documents

- **AC-ARCH-004:** Phase H automated performance benchmark suite (`Playwright` + `Vitest bench`) measures and reports every target in Sections 2–3 before production deployment.
- **Links:** [3D_ENGINE_SPECIFICATION.md](../09-visualization/3D_ENGINE_SPECIFICATION.md), [SIMULATION_AND_WORKER_ARCHITECTURE.md](SIMULATION_AND_WORKER_ARCHITECTURE.md), [PERFORMANCE_BENCHMARKS.md](../14-quality-and-validation/PERFORMANCE_BENCHMARKS.md).
