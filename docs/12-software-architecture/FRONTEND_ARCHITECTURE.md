# Frontend Architecture Specification — CORTEXIA

**Document ID:** `DOC-ARCH-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies the frontend source directory layout, routing architecture, modular Zustand state stores, lazy-loaded code-splitting boundaries, and scientific data hydration lifecycle for CORTEXIA's future Phase A–H implementation.

## 2. Planned Source Code Directory Structure (`Phases A–H`)

```text
src/
├── app/
│   ├── App.tsx                        # Root shell, ErrorBoundary, RouterProvider
│   ├── routes.tsx                     # Lazy route definitions for ENV-01..05 & MOD-01..12
│   └── providers/                     # Theme, KeyboardShortcut, WorkerPool providers
├── components/
│   ├── shell/                         # TopNav, ScaleStepper, SubNavRail, CommandSearchModal
│   ├── uces/                          # HoverTooltipPortal, SelectionInspectorDock, EntityBadges
│   ├── charts/                        # TraceCanvasPlot, PhasePlaneSVG, RasterPlot, MatrixHeatmap
│   └── ui/                            # ScientificSlider, UnitNumberInput, ProvenanceBanner
├── studios/
│   ├── studio-a-brain/                # WholeBrainStudio, ClippingPlanes, RegionTree
│   ├── studio-b-cellular/             # CellularStudio, SwcTubeLoader, CompartmentShader
│   ├── studio-c-synaptic/             # SynapticMolecularStudio, CleftParticleInstancer
│   └── studio-d-network/              # NetworkStudio, ConnectomeInstancedGraph
├── modules/
│   ├── m01-observatory/               # Observatory dashboard & systems wheel
│   ├── m02-neuroanatomy/              # Atlas views & TNA hierarchy inspector
│   ├── m03-cellular/                  # Neuron & glia explorers
│   ├── m04-molecular/                 # Ion channel & neurotransmitter lifecycle views
│   ├── m05-synaptic/                  # Synapse & plasticity views
│   ├── m06-connectomics/              # Circuit motifs & SC/FC matrix workbench
│   ├── m07-neurophysiology/           # Membrane dynamics & rhythm explorers
│   ├── m08-comp-lab/                  # 5-Panel Simulation Workspace & Digital Twin UI
│   ├── m09-systems/                   # 12 Systems pathway interactive schematics
│   ├── m10-cognitive/                 # Distributed cognitive network & theory explorers
│   ├── m11-analytics/                 # EEG/Signal, Spike, Network & Statistics workbenches
│   └── m12-knowledge-library/         # Dedicated Entity Pages, KG Explorer, Equations, Refs
├── kernels/
│   ├── solvers/                       # rk4.ts, rushLarsen.ts, eulerMaruyama.ts, hybridSpike.ts
│   ├── models/                        # model001HH.ts .. model028Connectome.ts
│   └── analytics/                     # fft.ts, welchPsd.ts, morletWavelet.ts, spikeMetrics.ts, graphMetrics.ts
├── workers/
│   ├── simulation.worker.ts           # Simulation execution & ring-buffer telemetry
│   └── analytics.worker.ts            # Signal, spike, graph & bootstrap worker
├── stores/
│   ├── selectionStore.ts              # Active UCES entity, hover state, studio highlight sync
│   ├── labStore.ts                    # Active model, params, solver, sweep queue, run history
│   ├── analyticsStore.ts              # Active dataset, filter chain, computed spectra/metrics
│   ├── knowledgeGraphStore.ts         # Indexed KG nodes/edges & BFS traversal cache
│   └── notebookStore.ts               # Research notebook entries & export/import state
└── data/
    ├── registryLoader.ts              # On-demand chunked JSON registry loader + Zod validation
    └── routeResolver.ts               # Canonical ID -> UCES / Studio / Model route resolver
```

---

## 3. Zustand Domain Store Contracts

1. **`selectionStore` (UCES & Cross-Module Context):**
   - State: `hoveredEntityId: string | null`, `selectedEntityId: string | null`, `comparisonEntityIds: string[]`, `activeScale: ScaleId`, `inspectorOpen: boolean`.
   - Syncs `selectedEntityId` with URL `?inspect=<id>` so refreshing or sharing any URL preserves the open UCES Inspector.
2. **`labStore` (`MOD-08` Simulation State):**
   - State: `activeModelId`, `parameterValues: Record<string, number>`, `initialConditions`, `solverId`, `dtMs`, `durationMs`, `randomSeed`, `stimulusConfig`, `jobStatus` (`IDLE | RUNNING | CANCELLED | COMPLETED | ERROR`), `progressPct`, `runHistory: ExperimentResult[]`.
3. **`analyticsStore` (`MOD-11` State):**
   - Holds references to typed array signal buffers in a non-reactive `BufferRegistry` (preventing deep proxy cloning of `Float64Array` inside state selectors) while keeping metadata and metric summaries reactive.

## 4. Code Splitting & Lazy Registry Hydration

- **Route-Level Code Splitting:** Each Work Environment (`ENV-01`–`ENV-05`), each 3D Studio (`A`–`D`), and the Knowledge Graph engine load as separate Vite dynamic `import()` chunks.
- **Registry Chunking:** Core entity index (`id`, `canonicalName`, `entityType`, `primaryScale`, `shortDefinition`) loads at boot (`< 80 KB` gzipped) to power instant global search and hover tooltips; full mechanism narratives, dataset payloads, and 3D `.glb`/`SWC` geometries load on demand with LRU memory caching.

## 5. Acceptance Criteria & Related Documents

- **AC-ARCH-002:** Initial entry bundle remains `< 250 KB` gzipped (excluding lazy 3D/worker chunks); store updates for simulation progress never trigger full-page React re-renders.
- **Links:** [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md), [SIMULATION_AND_WORKER_ARCHITECTURE.md](SIMULATION_AND_WORKER_ARCHITECTURE.md), [INFORMATION_ARCHITECTURE.md](../01-product/INFORMATION_ARCHITECTURE.md).
