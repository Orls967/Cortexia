# Information Architecture — CORTEXIA

**Document ID:** `DOC-PROD-005`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's global navigation hierarchy, URL route taxonomy, cross-module routing rules, global scientific search architecture, breadcrumb system, and Universal Contextual Explanation System (UCES) deep-linking contracts.

## 2. Primary Navigation Hierarchy

### 2.1 Top-Level Shell Structure
1. **Top Environment Bar (`48px`):**
   - Brand Mark (`CORTEXIA` → `/explore/observatory`)
   - 5 Work Environments (`Explore`, `Laboratory`, `Analytics`, `Knowledge`, `Research`)
   - Scale Context Pill (`L1`–`L9` indicator + dropdown switcher)
   - Global Search Trigger (`Cmd/Ctrl + K`)
   - UCES Inspector Dock Toggle (`Cmd/Ctrl + I`)
2. **Contextual Sub-Navigation Rail (`240px` collapsible):**
   - Inside **Explore**: Observatory, Whole Brain (`MOD-02`), Cellular (`MOD-03`), Molecular (`MOD-04`), Synapses (`MOD-05`), Circuits/Connectomics (`MOD-06`), Systems (`MOD-09`), Cognitive (`MOD-10`).
   - Inside **Laboratory**: Model Catalog (`MOD-08`), Electrophysiology Sandbox (`MOD-07`), Plasticity Lab (`MOD-05`), Network & Oscillations, Integrated Digital Twin (`Tier 5`).
   - Inside **Analytics**: Signal & EEG Viewer (`MOD-11`), Spectral & Wavelet Lab, Spike Train Analyzer, Graph Connectomics Metrics, Statistical Workbench.
   - Inside **Knowledge**: Knowledge Graph (`MOD-12`), Encyclopedia, Equations & Units, Glossary, Dataset Catalog, Validation Reports, Bibliography.
   - Inside **Research**: Experiment Runs, Parameter Sweeps, Multi-Run Comparison, Research Notebook, Export/Import Manifests.
3. **Persistent Right UCES Inspector (`360px`–`420px` collapsible drawer / mobile sheet):**
   - Synchronized globally via URL query param (`?inspect=<entityId>`) or `selectionStore.activeEntityId`.

## 3. Canonical URL Routing Table

| Route Pattern | Environment | Module(s) | Purpose |
|---|---|---|---|
| `/` or `/explore/observatory` | `ENV-01` | `MOD-01` | Global observatory landing view |
| `/explore/anatomy/:entityId?` | `ENV-01` | `MOD-02` | Studio A Whole Brain Atlas + TNA tree |
| `/explore/cellular/:entityId?` | `ENV-01` | `MOD-03` | Studio B Cellular Studio (neurons & glia) |
| `/explore/molecular/:entityId?` | `ENV-01` | `MOD-04` | Studio C Molecular & Neurochemical systems |
| `/explore/synapses/:entityId?` | `ENV-01` | `MOD-05` | Studio C Synaptic architecture & plasticity |
| `/explore/circuits/:entityId?` | `ENV-01` | `MOD-06` | Studio D Neural Circuits & Connectomics |
| `/explore/physiology/:entityId?` | `ENV-01` | `MOD-07` | Neurophysiology & dynamical mechanisms |
| `/explore/systems/:systemId?` | `ENV-01` | `MOD-09` | 12 Functional Brain Systems explorer |
| `/explore/cognition/:conceptId?` | `ENV-01` | `MOD-10` | Cognitive Neuroscience & distributed networks |
| `/lab` or `/lab/:modelId?` | `ENV-02` | `MOD-08` | 5-Panel Computational Neuroscience Workspace |
| `/lab/digital-twin/:experimentId?` | `ENV-02` | `MOD-08` | 5-Tier Integrated Digital Twin Laboratory |
| `/analytics/:workspace?` | `ENV-03` | `MOD-11` | `signals`, `spikes`, `networks`, `stats`, `import` |
| `/knowledge` | `ENV-04` | `MOD-12` | Knowledge Library home & browse index |
| `/knowledge/graph/:entityId?` | `ENV-04` | `MOD-12` | Interactive Knowledge Graph canvas |
| `/knowledge/:entityId` | `ENV-04` | `MOD-12` | **Dedicated UCES Scientific Detail Page** |
| `/knowledge/equations/:equationId?` | `ENV-04` | `MOD-12` | Equation & physical units repository |
| `/knowledge/datasets/:datasetId?` | `ENV-04` | `MOD-12` | Dataset catalog & license inspector |
| `/knowledge/validation` | `ENV-04` | `MOD-12` | Model validation & QA benchmark reports |
| `/knowledge/references` | `ENV-04` | `MOD-12` | Verified scientific bibliography (`REF-*`) |
| `/research` | `ENV-05` | `MOD-08`–`12` | Experiment runs, sweeps, comparisons & notebooks |
| `/research/notebook/:notebookId?` | `ENV-05` | `MOD-12` | Structured computational Research Notebook |

> [!NOTE]
> All routes MUST survive hard browser refreshes on GitHub Pages via the `404.html` SPA restore flow specified in [GITHUB_PAGES_DEPLOYMENT.md](../15-deployment/GITHUB_PAGES_DEPLOYMENT.md).

## 4. Breadcrumbs & Cross-Scale Navigation Grammar

Two orthogonal breadcrumb modes appear in the header sub-bar:
1. **Structural Route Breadcrumb:** `Explore > Neuroanatomy > Limbic System > Hippocampal Formation > CA1`
2. **Biological Scale Stepper (`L1`–`L9`):** Highlights active scale(s) for the selected entity and exposes direct jump links up/down the Knowledge Graph (`PART_OF`, `CONTAINS`, `USES_MECHANISM`, `MODELED_BY`).

## 5. Global Scientific Search (`Cmd/Ctrl + K`)

- Client-side inverted index built from all registries (`ANAT-*`, `CELL-*`, `MOL-*`, `MECH-*`, `CIRC-*`, `SYS-*`, `COG-*`, `MODEL-*`, `EQ-*`, `DSET-*`, `ANALYTIC-*`, `REF-*`).
- Supports alias matching (e.g., `"NaV1.1"`, `"HH"`, `"LTP"`, `"Ammon's horn"`), prefix filtering (`model:`, `eq:`, `anat:`, `ref:`), keyboard arrow selection, and direct action triggers (`Inspect`, `Open Full Page`, `Open in 3D Studio`, `Launch Simulator`).

## 6. UCES Deep-Linking Contract

Every Inspector panel and Hover tooltip resolves an entity ID via a deterministic resolver `resolveEntityRoute(entityId)`:
- Primary Knowledge Page: `/knowledge/${entityId}`
- Primary 3D/Explore Studio route (if `visualizedBy` exists): `/explore/${studioDomain}/${entityId}`
- Associated Simulator route (if `associatedModels` exists): `/lab/${primaryModelId}?context=${entityId}`

## 7. Acceptance Criteria

- **AC-PROD-005:** Every registry entity resolves unambiguously to a dedicated `/knowledge/:entityId` route; zero dead or cyclic navigation links; search matches aliases and IDs in `< 30 ms`.

## 8. Related Documents

- [PRODUCT_ARCHITECTURE.md](PRODUCT_ARCHITECTURE.md)
- [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md)
- [GITHUB_PAGES_DEPLOYMENT.md](../15-deployment/GITHUB_PAGES_DEPLOYMENT.md)
