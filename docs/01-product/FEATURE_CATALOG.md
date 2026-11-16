# Feature Catalog — CORTEXIA

**Document ID:** `DOC-PROD-006`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This catalog enumerates all functional capabilities across CORTEXIA's 12 modules and cross-cutting infrastructure, specifying their Environment, Implementation Phase (`A`–`H`), UCES integration tier, and verification criteria.

## 2. Cross-Cutting Platform Capabilities

| Feature ID | Feature Name | Environment | Phase | UCES Integration |
|---|---|---|---|---|
| `FEAT-PLAT-001` | Universal Hover Tooltip System (intent delay + touch suppression) | All | `A` | Tier A (Hover) |
| `FEAT-PLAT-002` | Synchronized Selection Inspector Drawer (12 fields) | All | `A` | Tier B (Inspector) |
| `FEAT-PLAT-003` | Dedicated Scientific Entity Pages (`/knowledge/:entityId`) | `ENV-04` | `A` | Tier C (Page) |
| `FEAT-PLAT-004` | Global Command & Scientific Search (`Cmd/Ctrl + K`) | All | `A` | Direct jump to all tiers |
| `FEAT-PLAT-005` | Multi-Scale Stepper (`L1`–`L9`) with abstraction warnings | All | `A`–`B` | Cross-scale KG traversal |
| `FEAT-PLAT-006` | Typed Knowledge Graph Explorer & Path Tracer | `ENV-04` | `A`, `G` | Node & edge UCES |

## 3. Domain Module Feature Matrix (`MOD-01`–`MOD-12`)

| Module | Feature ID | Capability Description | Phase |
|---|---|---|---|
| `MOD-01` | `FEAT-M01-01` | Whole-Brain Systems Observatory overview & live activity telemetry | `A`, `G` |
| `MOD-01` | `FEAT-M01-02` | Featured cross-scale experiments & recently explored items | `A` |
| `MOD-02` | `FEAT-M02-01` | Studio A 3D Whole Brain inspection (orbit, camera presets, layers) | `B` |
| `MOD-02` | `FEAT-M02-02` | Sagittal, coronal & axial orthogonal clipping planes + region isolation | `B` |
| `MOD-02` | `FEAT-M02-03` | Hierarchical TNA anatomical tree + atlas provenance badges | `B` |
| `MOD-03` | `FEAT-M03-01` | Studio B Neuron & Glia morphology viewer (pyramidal, interneuron, glia) | `B` |
| `MOD-03` | `FEAT-M03-02` | Myelination, saltatory sheath & axonal transport schematic animation | `B`–`C` |
| `MOD-04` | `FEAT-M04-01` | Ion channel families ($Na_v, K_v, Ca_v$, AMPA, NMDA, $GABA_A$) & gating inspector | `B`–`C` |
| `MOD-04` | `FEAT-M04-02` | 8 neurotransmitter lifecycle explorers (synthesis, release, receptor, reuptake) | `B`–`C` |
| `MOD-04` | `FEAT-M04-03` | Interactive Nernst & Goldman–Hodgkin–Katz equilibrium calculator | `C` |
| `MOD-05` | `FEAT-M05-01` | Studio C Synaptic cleft, vesicles, SNARE release & PSD interactive scene | `B`–`C` |
| `MOD-05` | `FEAT-M05-02` | LTP/LTD, STDP & STP interactive links directly into `MOD-08` | `C`–`D` |
| `MOD-06` | `FEAT-M06-01` | Studio D Interactive Network Graph + connectivity matrix heatmap | `E` |
| `MOD-06` | `FEAT-M06-02` | Provenance badges distinguishing Empirical SC, Estimated FC & Synthetic Graphs | `E` |
| `MOD-06` | `FEAT-M06-03` | Canonical circuits (Cortical, Thalamocortical, Hippocampal, BG, Cerebellar) | `E` |
| `MOD-07` | `FEAT-M07-01` | Resting potential, AP initiation, refractory period & cable attenuation explorers | `C` |
| `MOD-07` | `FEAT-M07-02` | Neuronal firing pattern & neural oscillation rhythm visualizer | `C` |
| `MOD-08` | `FEAT-M08-01` | Standard 5-panel Simulation Workspace (`Model/Setup/View/Analytics/Validation`) | `D` |
| `MOD-08` | `FEAT-M08-02` | 16 Model Families / 28 Validated Models running in Web Workers | `D` |
| `MOD-08` | `FEAT-M08-03` | 5-Tier Integrated Brain Systems Digital Twin (`3+` cross-scale experiments) | `G` |
| `MOD-09` | `FEAT-M09-01` | 12 Systems Neuroscience pathway explorers (Visual through Reward) | `E` |
| `MOD-10` | `FEAT-M10-01` | Cognitive domains & consciousness theories with distributed-network guardrails | `E` |
| `MOD-11` | `FEAT-M11-01` | Multichannel EEG/LFP viewer with FIR/IIR filtering & ERP averaging | `F` |
| `MOD-11` | `FEAT-M11-02` | FFT, Welch PSD, STFT & Morlet Wavelet time-frequency spectrograms | `F` |
| `MOD-11` | `FEAT-M11-03` | Spike train raster, ISI histogram, CV, Fano factor, PSTH, STA & cross-correlation | `F` |
| `MOD-11` | `FEAT-M11-04` | Graph topology suite (degree, betweenness, clustering, modularity, robustness) | `E`–`F` |
| `MOD-11` | `FEAT-M11-05` | Local CSV/JSON dataset importer with metadata/unit validation & export | `F` |
| `MOD-12` | `FEAT-M12-01` | Complete Neuroscience Encyclopedia, Equation Library, Glossary & Bibliography | `A`–`G` |
| `MOD-12` | `FEAT-M12-02` | Experiment Presets, Parameter Sweeps, Multi-Run Comparison & Research Notebook | `F` |

## 4. Acceptance Criteria & Related Documents

- **AC-PROD-006:** Every `FEAT-*` entry traces to at least one `REQ-*` ID and Phase A–H WBS task in [TASK_BREAKDOWN.md](../16-project-management/TASK_BREAKDOWN.md).
- **Links:** [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md), [MODULES_OVERVIEW_SPECIFICATION.md](MODULES_OVERVIEW_SPECIFICATION.md), [IMPLEMENTATION_ROADMAP.md](../16-project-management/IMPLEMENTATION_ROADMAP.md).
