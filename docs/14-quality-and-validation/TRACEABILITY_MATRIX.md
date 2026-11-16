# Requirements Traceability Matrix (RTM) — CORTEXIA

**Document ID:** `DOC-QA-005`  
**Registry Mirror:** `registries/traceability/requirements-traceability.json`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document provides the complete **Requirements Traceability Matrix (RTM)** mapping every product, scientific, mathematical, visualization, UCES, data, software, and deployment requirement (`REQ-*`) to its category, priority, source, module, domain, specification document, schema/registry, validation method, acceptance criterion, implementation phase (`A`–`H`), and Phase 0 specification status.

---

## 2. Master Requirements Traceability Matrix

| Req ID | Requirement Summary | Category | Priority | Module(s) | Domain / Scale | Authoritative Doc(s) | Schema / Registry | Validation Method | Acceptance Criterion | Impl Phase | Phase 0 Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `REQ-UCES-001` | Three-tier explanation system (Hover, Inspector, Page) across all 17 UI entity classes | UCES | P0 | `MOD-01`–`12` | `L1`–`L9` | `DOC-VIS-005`, `DOC-PROD-002` | `scientific-explanation.schema.json`, `explanation-coverage.json` | Audit + Playwright `E2E-UCES-001` | `AC-UCES-001`..`010` | Phase A | `SPECIFIED` |
| `REQ-UCES-002` | Concise Hover Tooltip with 180ms intent delay & touch suppression | UCES | P0 | `MOD-01`–`12` | `L1`–`L9` | `DOC-VIS-005`, `DOC-UX-004` | `ui-entity-mapping.schema.json` | Component + E2E hover/touch test | `AC-UCES-010` | Phase A | `SPECIFIED` |
| `REQ-UCES-003` | 12-Section Click/Selection Inspector synchronized with active 3D/2D viewport | UCES | P0 | `MOD-01`–`12` | `L1`–`L9` | `DOC-VIS-005`, `DOC-UX-002` | `scientific-explanation.schema.json` | Store + Playwright selection test | `AC-UCES-002`, `003` | Phase A | `SPECIFIED` |
| `REQ-UCES-004` | Dedicated Scientific Detail Pages (`/knowledge/:entityId`) | UCES | P0 | `MOD-12` | `L1`–`L9` | `DOC-VIS-005`, `DOC-KG-002` | `explanation-coverage.json` | Route resolution + E2E deep-link test | `AC-UCES-004`, `AC-KG-002` | Phase A | `SPECIFIED` |
| `REQ-UCES-005` | Prohibition of generic filler; explicit incomplete-content diagnostic state | UCES | P0 | `MOD-01`–`12` | `L1`–`L9` | `DOC-VIS-005`, `DOC-ARCH-005` | `explanation-coverage.json` | Audit script + negative UI test | `AC-UCES-008`, `009` | Phase A | `SPECIFIED` |
| `REQ-UCES-006` | Automated UCES completeness & cross-reference coverage auditor | UCES / QA | P0 | `MOD-12` | All | `DOC-VIS-005`, `DOC-QA-001` | `explanation-coverage.json` | `run_audit.py` UCES check | `GATE-P0-03`, `06` | Phase 0 / A | `SPECIFIED` |
| `REQ-MOD-001` | Nine biological scales (`L1`–`L9`) with non-deterministic abstraction disclaimers | Scientific | P0 | `MOD-01`–`12` | `L1`–`L9` | `DOC-SCI-001`, `DOC-PROD-003` | `kg-node.schema.json` | Scale tag audit + UI badge check | `AC-SCI-001` | Phase A | `SPECIFIED` |
| `REQ-MOD-002` | Module 01 CORTEXIA Observatory overview, scale wheel & discovery index | Product | P0 | `MOD-01` | `L1`–`L9` | `DOC-PROD-007`, `DOC-UX-003` | `knowledge-graph.json` | E2E Observatory navigation test | `AC-PROD-007`, `AC-UX-003` | Phase A / G | `SPECIFIED` |
| `REQ-MOD-003` | Module 02 Neuroanatomy Atlas with TNA tree, 3D Studio A, orthogonal clipping & isolation | Anatomy | P0 | `MOD-02` | `L6`–`L7` | `DOC-ANAT-001`, `DOC-ANAT-002` | `anatomical-entity.schema.json`, `anatomical-entities.json` | Schema audit + Studio A E2E test | `AC-ANAT-001`, `002` | Phase B | `SPECIFIED` |
| `REQ-MOD-004` | Module 03 Cellular Neuroscience covering neuron classes, 4 CNS glia, myelin & transport | Cellular | P0 | `MOD-03` | `L2`–`L3` | `DOC-CELL-001`, `DOC-VIS-002` | `cellular-entity.schema.json`, `cellular-entities.json` | Schema audit + Studio B E2E test | `AC-CELL-001` | Phase B | `SPECIFIED` |
| `REQ-MOD-005` | Module 04 Molecular & Neurochemical Systems (channels, pumps, 8 NTs, second messengers) | Molecular | P0 | `MOD-04` | `L1`–`L2` | `DOC-MOL-001`, `DOC-VIS-002` | `molecular-entity.schema.json`, `molecular-entities.json` | Schema audit + Nernst/GHK unit test | `AC-MOL-001` | Phase B / C | `SPECIFIED` |
| `REQ-MOD-006` | Module 05 Synaptic Architecture & Plasticity (chemical/gap, STP, LTP/LTD, STDP, scaling) | Synaptic | P0 | `MOD-05` | `L4` | `DOC-SYN-001`, `DOC-MOD-005` | `physiological-mechanism.schema.json`, `physiological-mechanisms.json` | Schema audit + simulator link test | `AC-SYN-001` | Phase B / C | `SPECIFIED` |
| `REQ-MOD-007` | Module 06 Neural Circuits & Connectomics with mandatory SC / FC / Synthetic badges | Connectomics | P0 | `MOD-06` | `L5`, `L8` | `DOC-CIRC-001`, `DOC-MOD-009` | `neural-pathway.schema.json`, `circuits-and-pathways.json` | Provenance badge & graph metric test | `AC-CIRC-001`, `AC-MOD-009` | Phase E | `SPECIFIED` |
| `REQ-MOD-008` | Module 07 Neurophysiology & Neural Dynamics (AP, gating, cable, firing patterns, rhythms) | Physiology | P0 | `MOD-07` | `L2`–`L6` | `DOC-PHYS-001` | `physiological-mechanisms.json` | Mechanism-to-equation link audit | `AC-PHYS-001` | Phase C | `SPECIFIED` |
| `REQ-MOD-009` | Module 08 Computational Neuroscience Lab (5-panel workspace, 16 families, 28 models) | Computation | P0 | `MOD-08` | `L1`–`L8` | `DOC-MOD-001`..`010` | `scientific-model.schema.json`, `scientific-models.json` | `VAL-*` numerical suite + E2E test | `AC-MOD-001`..`010` | Phase D | `SPECIFIED` |
| `REQ-MOD-010` | Module 09 Systems Neuroscience covering 12 sensory, motor, autonomic & reward systems | Systems | P1 | `MOD-09` | `L7`–`L9` | `DOC-SYS-001` | `functional-system.schema.json`, `functional-systems.json` | Pathway relay & model link audit | `AC-SYS-001` | Phase E | `SPECIFIED` |
| `REQ-MOD-011` | Module 10 Cognitive Neuroscience & consciousness theories with anti-localization guardrails | Cognition | P1 | `MOD-10` | `L8`–`L9` | `DOC-COG-001` | `explanation-coverage.json` | Epistemic tag & guardrail audit | `AC-COG-001` | Phase E | `SPECIFIED` |
| `REQ-MOD-012` | Module 11 Neural Data & Signal Analytics (26 methods, CSV import, causal warnings) | Analytics | P0 | `MOD-11` | `L3`–`L8` | `DOC-ANA-001` | `analysis-method.schema.json`, `analysis-methods.json` | Synthetic ground-truth DSP/stats tests | `AC-ANA-001` | Phase F | `SPECIFIED` |
| `REQ-MOD-013` | Module 12 Scientific Knowledge Library & typed Knowledge Graph (`20` node types, `16` edge types) | Knowledge | P0 | `MOD-12` | `L1`–`L9` | `DOC-KG-001`, `DOC-KG-002` | `kg-node.schema.json`, `kg-edge.schema.json`, `knowledge-graph.json` | Zero-orphan / zero-dangling KG audit | `AC-KG-001`, `002` | Phase A / G | `SPECIFIED` |
| `REQ-MOD-014` | Twelve specialized neuroscience research domains (`DOM-DEV` through `DOM-THEORY`) | Scientific | P1 | `MOD-12` | `L1`–`L9` | `DOC-SCI-002` | `explanation-coverage.json` | Domain & non-clinical disclaimer audit | `AC-SCI-002` | Phase E / G | `SPECIFIED` |
| `REQ-COMP-001` | Complete mathematical rigor (units, sign conventions, solvers, `VAL-*` benchmarks) | Math / QA | P0 | `MOD-08` | `L1`–`L8` | `DOC-MOD-002`, `DOC-MOD-003`, `DOC-MOD-010` | `mathematical-equation.schema.json`, `model-parameter.schema.json` | Vitest solver convergence & unit audit | `AC-MOD-002`, `003`, `010` | Phase D | `SPECIFIED` |
| `REQ-COMP-002` | Off-main-thread Web Worker execution with `Transferable` Float64Array buffers & cancellation | Runtime | P0 | `MOD-08`, `11` | Compute | `DOC-ARCH-001`, `DOC-ARCH-003` | `simulation-input.schema.json`, `simulation-output.schema.json` | Worker transfer & `<15ms` cancel test | `AC-ARCH-001`, `003` | Phase D / F | `SPECIFIED` |
| `REQ-COMP-003` | Browser compute envelopes & numerical divergence protection (`ERR_NUMERICAL_DIVERGENCE`) | Runtime | P0 | `MOD-08` | Compute | `DOC-ARCH-004`, `DOC-ARCH-005` | `scientific-models.json` | Envelope boundary & NaN trap test | `AC-ARCH-004`, `005` | Phase D | `SPECIFIED` |
| `REQ-TWIN-001` | 5-Tier Educational Digital Twin with 3+ integrated multi-scale experiments | Digital Twin | P1 | `MOD-08` | `L1`–`L9` | `DOC-SCI-003` | `experiment-config.schema.json`, `experiments.json` | Multi-stage pipeline reproducibility test | `AC-SCI-003` | Phase G | `SPECIFIED` |
| `REQ-VIS-001` | Four 3D Visualization Studios (`A–D`) with provenance badges, LOD, instancing & cleanup | 3D Engine | P0 | `MOD-02`–`06` | `L1`–`L8` | `DOC-VIS-001`..`004` | `asset-3d.schema.json`, `assets-3d.json` | `BM-002`, `BM-010` + E2E studio tests | `AC-VIS-001`..`004` | Phase B / E | `SPECIFIED` |
| `REQ-EXP-001` | Experiment Framework (10 types, sweeps, comparisons, Research Notebook & manifests) | Research | P0 | `MOD-08`, `12` | Research | `DOC-DATA-004` | `experiment-config.schema.json`, `experiment-result.schema.json` | Deterministic seed replay test | `AC-DATA-004` | Phase F | `SPECIFIED` |
| `REQ-DATA-001` | Dataset provenance, license attribution, local-only privacy & 22 JSON Schemas | Data / Sec | P0 | `MOD-11`, `12` | Data | `DOC-DATA-001`..`003`, `DOC-ARCH-006` | `dataset.schema.json`, `dataset-metadata.schema.json`, `datasets.json` | Schema validation + zero-upload test | `AC-DATA-001`..`003`, `AC-ARCH-006` | Phase A / F | `SPECIFIED` |
| `REQ-QA-001` | Omniverse-inspired dark scientific design system, 5 environments, WCAG 2.1 AA & GitHub Pages SPA | UX / Deploy | P0 | All | Platform | `DOC-UX-001`..`004`, `DOC-DEP-001`..`003` | `traceability.schema.json` | Lighthouse/axe + live Pages smoke check | `AC-UX-001`..`004`, `AC-IMP-DEPLOY` | Phase A / H | `SPECIFIED` |

---

## 3. Acceptance Criteria & Related Documents

- **AC-QA-005:** `tools/documentation-audit/run_audit.py` verifies that every `REQ-*` entry in `requirements-traceability.json` links to existing documents, schemas, and registries with zero broken pointers.
- **Links:** [PRODUCT_REQUIREMENTS.md](../01-product/PRODUCT_REQUIREMENTS.md), [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).
