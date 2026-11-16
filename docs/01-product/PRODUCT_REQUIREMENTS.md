# Product Requirements Document (PRD) — CORTEXIA

**Document ID:** `DOC-PROD-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This PRD establishes numbered, testable functional and non-functional requirements (`REQ-*`) for CORTEXIA across all 12 modules, 5 work environments, 9 scales, 4 3D studios, computational simulation engine, analytics suite, and the mandatory **Universal Contextual Explanation System (UCES)**.

## 2. Terminology

- `Must` / `Shall`: Mandatory Phase A–H implementation requirement.
- `Should`: Recommended enhancement documented with fallback behavior.
- `UCES`: Universal Contextual Explanation System (`REQ-UCES-*`).

---

## 3. Requirement Pillar 1 — Universal Contextual Explanation System (`REQ-UCES`)

> [!IMPORTANT]
> **Central Product Requirement:** Every meaningful scientific element rendered in 3D viewports, 2D diagrams, network graphs, simulators, charts, and analytical tables MUST be explainable, inspectable, and traceable through a unified three-tier explanation architecture.

### 3.1 Functional Requirements — UCES

| ID | Requirement | Priority | Acceptance Target |
|---|---|---|---|
| `REQ-UCES-001` | **Three-Tier Explanation Architecture:** Every eligible scientific entity (`ANAT-*`, `CELL-*`, `MOL-*`, `MECH-*`, `CIRC-*`, `SYS-*`, `COG-*`, `MODEL-*`, `EQ-*`, `PARAM-*`, `ANALYTIC-*`, `DSET-*`) shall expose: (A) concise **Hover Tooltip**, (B) **Click/Selection Inspector Panel**, and (C) **Dedicated Knowledge Page** route (`/knowledge/:entityId`). | P0 | All 17 UI entity classes covered in matrix. |
| `REQ-UCES-002` | **Hover Tooltip Content & Behavior:** On pointer hover (`>= 180 ms` intent delay), display scientific name, 1–2 sentence short definition, primary function/significance, physical units/current value (where applicable), and an explicit affordance (`Click to inspect · K for full page`). Touch-only devices shall disable passive hover and elevate tap-to-inspect. | P0 | Zero oversized hover overlays; touch-safe fallback verified. |
| `REQ-UCES-003` | **Click/Selection Inspector Synchronization:** Selecting any eligible 3D mesh, network node/edge, equation symbol, parameter slider, or metric opens the right-side Inspector displaying 12 structured fields (Name, Definition, Biological Role, Anatomical/Molecular Context, Detailed Mechanism, Related Structures, Equations, Parameters & Units, Associated Models, Visualizations, References, Assumptions & Limitations) and visibly highlights the selected object in the active viewport. | P0 | 100% ID sync between viewport selection and inspector payload. |
| `REQ-UCES-004` | **Dedicated Knowledge Page Navigation:** Clicking "Open Full Scientific Page" inside the Inspector or navigating directly to `/knowledge/:entityId` renders an authoritative encyclopedia specification with cross-scale links, equation cards, interactive simulator launch buttons, and verified bibliographic references. | P0 | Deep link resolves on fresh load & browser refresh. |
| `REQ-UCES-005` | **No Generic Placeholder Fallback:** Selecting an entity MUST resolve its exact ID in `ScientificEntityDocumentation`; missing documentation MUST explicitly render an honest `"Incomplete / Pending Specification"` state rather than fabricated or generic filler text. | P0 | Automated coverage audit flags incomplete entities. |
| `REQ-UCES-006` | **Automated Explanation Coverage Auditing:** CI and documentation tooling MUST detect entities missing short definitions, detailed mechanisms, references, 3D asset mappings, inspector-to-page links, or orphaned pages. | P0 | `run_audit.py` exits non-zero on coverage contract breach. |

---

## 4. Requirement Pillar 2 — Multi-Scale Architecture & 12 Modules (`REQ-MOD`)

| ID | Requirement | Priority | Modules |
|---|---|---|---|
| `REQ-MOD-001` | **Nine Biological Scales (`L1`–`L9`):** Platform navigation, Knowledge Graph, and Multi-Scale Bridge shall index all entities across `L1` Molecular through `L9` Systems & Cognition while displaying explicit abstraction-gap disclaimers where mechanisms cannot be derived deterministically bottom-up. | P0 | `MOD-01`–`MOD-12` |
| `REQ-MOD-002` | **CORTEXIA Observatory (`MOD-01`):** Provide global whole-brain overview, multi-scale navigation wheel, brain systems map, live activity summary, recent explorations, featured experiments, and global scientific search. | P0 | `MOD-01` |
| `REQ-MOD-003` | **Neuroanatomy Atlas (`MOD-02`):** Support hierarchical TNA tree, 3D cortical/subcortical/brainstem/cerebellar/spinal/cranial-nerve inspection, sagittal/coronal/axial slicing planes, region isolation, structural relationship highlighting, and atlas-coordinate provenance. | P0 | `MOD-02` |
| `REQ-MOD-004` | **Cellular Neuroscience (`MOD-03`):** Inspect neuronal classes (pyramidal, interneuron, sensory, motor) and glia (astrocyte, oligodendrocyte, microglia, ependymal), myelination, axonal transport, and cellular metabolism. | P0 | `MOD-03` |
| `REQ-MOD-005` | **Molecular & Neurochemical Systems (`MOD-04`):** Inspect voltage-/ligand-gated ion channels, $Na^+/K^+/Ca^{2+}/Cl^-$ gradients, vesicle cycle, 8 neurotransmitter systems (Glutamate, GABA, Dopamine, Serotonin, ACh, NE, Histamine, Neuropeptides), and second messengers in strictly mechanistic/educational scope. | P0 | `MOD-04` |
| `REQ-MOD-006` | **Synaptic Architecture & Plasticity (`MOD-05`):** Explore chemical/electrical synapses, release machinery, EPSP/IPSP integration, STP (facilitation/depression), LTP/LTD, STDP, homeostatic scaling, and structural spine remodeling linked directly to `MOD-08`. | P0 | `MOD-05` |
| `REQ-MOD-007` | **Neural Circuits & Connectomics (`MOD-06`):** Provide interactive circuit diagrams and graph connectomics (matrices, degree/centrality, community detection) with explicit UI badges separating **Empirical Structural**, **Estimated Functional**, and **Synthetic Simulation** edges. | P0 | `MOD-06` |
| `REQ-MOD-008` | **Neurophysiology & Neural Dynamics (`MOD-07`):** Illustrate resting potential, action potential initiation/propagation, refractory periods, channel gating kinetics, firing patterns, oscillations, and synchrony. | P0 | `MOD-07` |
| `REQ-MOD-009` | **Computational Neuroscience Laboratory (`MOD-08`):** Standard 5-panel Simulation Workspace (`Model & Theory`, `Experiment Setup`, `Simulation View`, `Results & Analytics`, `Validation & Limitations`) covering 16 model families and 28 validated implementations. | P0 | `MOD-08` |
| `REQ-MOD-010` | **Systems Neuroscience (`MOD-09`):** Document 12 sensory/motor/regulatory brain systems with pathway schematics, anatomical anchors, physiological mechanisms, and model links. | P1 | `MOD-09` |
| `REQ-MOD-011` | **Cognitive Neuroscience (`MOD-10`):** Cover memory, working memory, attention, executive control, perception, decision-making, language, emotion, and scientific theories of consciousness with explicit non-localization and hypothesis disclaimers. | P1 | `MOD-10` |
| `REQ-MOD-012` | **Neural Data & Signal Analytics (`MOD-11`):** Deliver EEG/multichannel viewer, digital filtering, FFT/Welch PSD, STFT/Morlet wavelets, ERP, spike rasters/ISI/PSTH/STA, network metrics, descriptive/inferential stats, CSV/metadata import, and correlation-vs-causation warnings. | P0 | `MOD-11` |
| `REQ-MOD-013` | **Scientific Knowledge & Research Library (`MOD-12`):** Serve searchable encyclopedia, equation library, glossary, dataset catalog, bibliography, validation reports, and interactive typed Knowledge Graph. | P0 | `MOD-12` |

---

## 5. Requirement Pillar 3 — Computational Rigor, 3D Studios & Research Reproducibility

| ID | Requirement | Priority | Acceptance Target |
|---|---|---|---|
| `REQ-COMP-001` | **Numerical & Mathematical Rigor:** Every model displays governing equations, variable definitions, physical units, initial/boundary conditions, numerical solver options, `dt` bounds, stability warnings, and validation benchmarks. | P0 | Zero unitless parameters where physical units exist. |
| `REQ-COMP-002` | **Off-Main-Thread Simulation Execution:** All solvers and signal transforms execute in Web Workers using `Transferable` typed arrays, supporting progress telemetry and cancellation. | P0 | UI thread remains `>= 60 fps` during active solves. |
| `REQ-COMP-003` | **Browser Compute Envelopes:** Enforce explicit upper limits on neuron count, synapse count, step count, and runtime memory with clear warnings before execution. | P0 | Tab crash prevention under stress configurations. |
| `REQ-TWIN-001` | **5-Tier Educational Digital Twin:** Support Tiers 1–5 including at least 3 coupled cross-scale experiments (Excitability→Circuit, Plasticity→Network, Oscillations→Signal Analytics) with explicit abstraction boundaries. | P1 | All 3 coupled experiments documented & verifiable. |
| `REQ-VIS-001` | **Four 3D Visualization Studios:** Implement Whole Brain, Cellular, Synaptic & Molecular, and Neural Network studios with 360° orbit, presets, clipping planes, isolation, transparency, relationship highlighting, simulation playback, and asset provenance badges. | P0 | Every 3D mesh maps to stable entity & asset IDs. |
| `REQ-EXP-001` | **Experiment Framework & Reproducibility Manifest:** Support presets, parameter sweeps, multi-run overlay comparisons, sensitivity plots, Research Notebook entries, and JSON/CSV export recording model version, parameters, solver, `dt`, and PRNG seed. | P0 | Identical seed + config reproduces bit-identical outputs. |
| `REQ-DATA-001` | **Dataset Provenance & Privacy Safety:** Imported local files stay strictly client-side; every curated dataset declares source, format, sampling rate, units, attribution, and license. | P0 | Zero unauthorized external uploads; license badge always visible. |
| `REQ-QA-001` | **Accessibility & Deployment:** WCAG 2.1 AA contrast and keyboard/touch controls; clean Vite static build deployed to GitHub Pages with SPA deep-link support. | P0 | Lighthouse/axe zero critical violations; live route refresh HTTP 200. |

## 6. Assumptions, Limitations, Dependencies & Validation

- **Assumptions:** Users interact on WebGL2-capable devices with minimum `1280×720` desktop or `375×812` mobile viewports.
- **Validation:** Every `REQ-*` ID maps into [TRACEABILITY_MATRIX.md](../14-quality-and-validation/TRACEABILITY_MATRIX.md) and `registries/traceability/requirements-traceability.json`.

## 7. Related Documents

- [PRODUCT_VISION_AND_SCOPE.md](PRODUCT_VISION_AND_SCOPE.md)
- [PRODUCT_ARCHITECTURE.md](PRODUCT_ARCHITECTURE.md)
- [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md)
- [TRACEABILITY_MATRIX.md](../14-quality-and-validation/TRACEABILITY_MATRIX.md)
