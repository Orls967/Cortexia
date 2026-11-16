# Work Breakdown Structure (WBS) — CORTEXIA

**Document ID:** `DOC-PM-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document breaks down CORTEXIA's implementation roadmap (`Phases A–H`) into actionable engineering and scientific work packages (`WBS-*`) mapped to modules, schemas, and acceptance criteria.

---

## 2. Work Breakdown Structure by Phase

### Phase A — Platform Shell, Data Runtime & Universal Explanation System
- `WBS-A01`: Initialize Vite + React 19 + TypeScript strict project, ESLint, Vitest, Playwright, and `404.html` SPA router shim.
- `WBS-A02`: Implement Design System tokens (`DOC-UX-001`), 5-Environment Shell (`ENV-01`–`05`), Scale Stepper (`L1`–`L9`), and Global Command Search (`Cmd/Ctrl + K`).
- `WBS-A03`: Implement Zod registry loader hydrating `registries/*.json` and in-memory Knowledge Graph traversal index (`BFS` & ego-graph).
- `WBS-A04`: Build **Universal Contextual Explanation System (UCES)**: `<UCESTooltipPortal>` (180ms hover + touch suppression), `<UCESInspectorDrawer>` (12 mandatory sections), and `/knowledge/:entityId` Dedicated Page view (`MOD-12`).
- `WBS-A05`: Implement `MOD-01` CORTEXIA Observatory overview, featured experiment launchers, and recent exploration history.

### Phase B — Anatomy, Cells, Molecules & 3D Studios A–C
- `WBS-B01`: Build Three.js / R3F core engine (`DOC-VIS-001`) with BVH raycasting, LOD controller, stencil clipping planes, and deterministic disposal.
- `WBS-B02`: Implement **Studio A (`MOD-02` Neuroanatomy Atlas)**: TNA hierarchy tree, 8 camera presets, sagittal/coronal/axial slicing, region isolation, and atlas provenance badges.
- `WBS-B03`: Implement **Studio B (`MOD-03` Cellular Neuroscience)**: `SWC` tubular morphology generator, neuronal/glial class switcher, and subcellular compartment inspection.
- `WBS-B04`: Implement **Studio C (`MOD-04` & `MOD-05`)**: nanoscale presynaptic/cleft/postsynaptic 3D scene, `InstancedMesh` vesicles/receptors, and gap-junction view.

### Phase C — Neurophysiology & Synaptic Mechanisms
- `WBS-C01`: Implement interactive Nernst & Goldman–Hodgkin–Katz calculator and 8-neurotransmitter lifecycle explorer (`MOD-04`).
- `WBS-C02`: Implement `MOD-07` action potential phase explorer, refractory probe, dendritic cable attenuation view, and oscillation rhythm comparator.
- `WBS-C03`: Implement `MOD-05` short-term (`STF/STD`) and long-term (`LTP/LTD/STDP/Homeostatic`) plasticity interactive mechanism timelines.

### Phase D — Computational Neuroscience Laboratory Core (`MOD-08`)
- `WBS-D01`: Build `SimulationWorker` infrastructure, zero-copy `Transferable` ring buffers, cooperative job cancellation, and divergence trap (`ERR_NUMERICAL_DIVERGENCE`).
- `WBS-D02`: Implement all 8 numerical solvers (`FE`, `Rush–Larsen`, `RK4`, `RK45`, `Exact-LIF`, `HybridSpike`, `Euler–Maruyama`, `Crank–Nicolson`) + Vitest convergence suite.
- `WBS-D03`: Implement Single-Neuron & Dendritic models (`MODEL-001`–`MODEL-010`) and Synaptic/STP models (`MODEL-011`–`MODEL-016`).
- `WBS-D04`: Implement Population (`MODEL-017`–`019`), SNN (`MODEL-020`–`022`), and Plasticity/Learning models (`MODEL-023`–`026`).
- `WBS-D05`: Build the 5-Panel Standard Simulation Workspace UI with `uPlot`/Canvas2D high-speed oscilloscope and phase-plane SVG views.

### Phase E — Connectomics, Systems & Cognitive Neuroscience (`MOD-06`, `09`, `10`)
- `WBS-E01`: Implement **Studio D Neural Network Studio** (`MOD-06`), reorderable adjacency matrix heatmap, and mandatory `SC / FC / Synthetic` provenance badges.
- `WBS-E02`: Implement `MODEL-027` (`Kuramoto`) and `MODEL-028` (`Connectome Diffusion`) + graph topology kernels (`Degree`, `Betweenness`, `Clustering`, `Path Length`, `Modularity`, `Small-World`, `Lesion Robustness`).
- `WBS-E03`: Implement `MOD-09` 12 Functional Brain Systems interactive pathway schematics linked to Studio A & `MOD-08`.
- `WBS-E04`: Implement `MOD-10` Cognitive Neuroscience distributed network explorers & consciousness theory comparison cards with epistemic/anti-localization guardrails.

### Phase F — Signal Analytics & Research Environment (`MOD-11`, `ENV-05`)
- `WBS-F01`: Implement `AnalyticsWorker` DSP kernels (`Butterworth IIR filtfilt`, `FIR`, `FFT`, `Welch PSD`, `STFT`, `Morlet Wavelet`, `ERP`) and Spike Train kernels (`Raster`, `ISI/CV`, `Fano`, `PSTH`, `STA`, `CCG`, `Synchrony/PLV/Coherence`).
- `WBS-F02`: Implement Statistical Workbench (`Descriptive`, `Pearson/Spearman`, `OLS Regression`, `Bootstrap`, `Permutation/FDR`, `Sensitivity`, `AIC/BIC`) with `Correlation ≠ Causation` banners.
- `WBS-F03`: Implement local client-side CSV/SWC/JSON dataset importer and `MOD-12` Dataset Catalog browser.
- `WBS-F04`: Implement `ENV-05` Parameter Sweep orchestrator, Multi-Run Comparison overlay, and Research Notebook with `.cortexia.json` reproducibility manifest export/import.

### Phase G — Integrated Brain Systems Digital Twin (`Tier 5`)
- `WBS-G01`: Implement the 5-Tier Digital Twin multi-stage pipeline and all 3 flagship coupled experiments (`EXP-TWIN-EXCITABILITY-TO-CIRCUIT`, `EXP-TWIN-PLASTICITY-TO-DYNAMICS`, `EXP-TWIN-CONNECTOME-OSCILLATIONS`).
- `WBS-G02`: Wire live worker telemetry into Studio B–D shader attributes and complete the interactive Knowledge Graph path-finder (`MOD-12`).

### Phase H — Final Audit, Performance Tuning & GitHub Pages Deployment
- `WBS-H01`: Execute `BM-001`–`BM-010` benchmark suite; compile optional Rust/WASM kernels if any TS kernel misses target budget.
- `WBS-H02`: Execute full Playwright desktop/mobile E2E and `axe-core` WCAG 2.1 AA accessibility verification.
- `WBS-H03`: Deploy via GitHub Actions to GitHub Pages and verify all `AC-IMP-DEPLOY` live production checks.

## 3. Related Documents

- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md)
- [TRACEABILITY_MATRIX.md](../14-quality-and-validation/TRACEABILITY_MATRIX.md)
