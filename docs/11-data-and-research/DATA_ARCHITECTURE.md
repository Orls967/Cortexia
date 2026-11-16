# Scientific Data Architecture — CORTEXIA

**Document ID:** `DOC-DATA-001`  
**Module:** Cross-Platform (`MOD-01`–`MOD-12`)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's layered scientific data architecture, 22 JSON Schema contracts, 16 structured registries, runtime validation pipeline, versioning policy, and scientific provenance tracking.

## 2. Layered Registry Architecture

CORTEXIA forbids ad-hoc untyped JSON blobs. All static and runtime scientific data is organized into typed, cross-referenced registries under `registries/` governed by JSON Schema Draft 2020-12 definitions under `schemas/`:

| Registry Layer | Registry File (`registries/...`) | Governing Schema (`schemas/...`) | Primary Key Pattern |
|---|---|---|---|
| **Anatomy Registry** | `anatomical-entities/anatomical-entities.json` | `anatomy/anatomical-entity.schema.json` | `^ANAT-[A-Z0-9-]+$` |
| **Cell Registry** | `cellular-entities/cellular-entities.json` | `cells/cellular-entity.schema.json` | `^CELL-[A-Z0-9-]+$` |
| **Molecular Registry** | `molecular-entities/molecular-entities.json` | `molecular/molecular-entity.schema.json` | `^MOL-[A-Z0-9-]+$` |
| **Mechanism Registry** | `mechanisms/physiological-mechanisms.json` | `mechanisms/physiological-mechanism.schema.json` | `^MECH-[A-Z0-9-]+$` |
| **Pathway & Circuit Registry** | `circuits-pathways/circuits-and-pathways.json` | `pathways/neural-pathway.schema.json` | `^CIRC-[A-Z0-9-]+$` |
| **Functional Systems Registry** | `functional-systems/functional-systems.json` | `anatomy/functional-system.schema.json` | `^SYS-[A-Z0-9-]+$` |
| **Model Registry** | `scientific-models/scientific-models.json` | `models/scientific-model.schema.json` | `^MODEL-[0-9]{3}$` |
| **Equation Registry** | `equations/equations.json` | `models/mathematical-equation.schema.json` | `^EQ-[A-Z0-9-]+$` |
| **Parameter Registry** | `parameters/parameters.json` | `models/model-parameter.schema.json` | `^PARAM-[A-Z0-9-]+$` |
| **Experiment Registry** | `experiments/experiments.json` | `experiments/experiment-config.schema.json` | `^EXP-[A-Z0-9-]+$` |
| **Analysis Method Registry** | `analysis-methods/analysis-methods.json` | `analysis/analysis-method.schema.json` | `^ANALYTIC-[0-9]{3}$` |
| **Dataset Registry** | `datasets/datasets.json` | `datasets/dataset.schema.json` | `^DSET-[A-Z0-9-]+$` |
| **Reference Registry** | `scientific-references/scientific-references.json` | `references/scientific-reference.schema.json` | `^REF-[A-Z0-9-]+$` |
| **3D Asset Registry** | `assets-3d/assets-3d.json` | `assets/asset-3d.schema.json` | `^ASSET-[A-Z0-9-]+$` |
| **Knowledge Graph Registry** | `knowledge-graph/knowledge-graph.json` | `knowledge-graph/kg-node.schema.json` & `kg-edge.schema.json` | `Node ID` / `^EDGE-[0-9]{4}$` |
| **UCES Explanation Registry** | `explanation-coverage/explanation-coverage.json` | `explanations/scientific-explanation.schema.json` | Entity ID |
| **Traceability Registry** | `traceability/requirements-traceability.json` | `validation/traceability.schema.json` | `^REQ-[A-Z0-9-]+$` |

*(Additional runtime I/O schemas cover `simulation-input`, `simulation-output`, `experiment-result`, `dataset-metadata`, `ui-entity-mapping`, and `validation-case`, completing all 22 required contracts.)*

---

## 3. Scientific Provenance Tracking Contract

Every numeric parameter, anatomical structure, 3D mesh, dataset, and knowledge claim carries explicit provenance fields answering six mandatory questions:
1. **Origin:** Which `REF-*` publication or repository provided the definition?
2. **Version:** Which dataset/model version or atlas release was used?
3. **Epistemic Nature:** Is it `EMPIRICAL_FACT`, `EXPERIMENTAL_MEASUREMENT`, `THEORETICAL_MODEL_ASSUMPTION`, or `INTERPRETIVE_SYNTHESIS`?
4. **Numeric Provenance:** Is a default parameter value `LITERATURE_MEASURED`, `CANONICAL_BENCHMARK_DEFAULT`, or `ILLUSTRATIVE_TUNED`?
5. **Geometric Provenance:** Is a 3D asset `ATLAS_SURFACE_DERIVED`, `RECONSTRUCTED_MORPHOLOGY`, `PROCEDURAL_SCHEMATIC`, or `SYNTHETIC_GRAPH`?
6. **Legal / License Status:** What license (`CC0-1.0`, `CC-BY-4.0`, `ALLEN_NONCOMMERCIAL`, `MIT/BSD`) and attribution string govern usage?

## 4. Schema Versioning & Runtime Validation

- All schemas and registries carry `"schemaVersion": "1.0.0"`.
- Build-time audit (`tools/documentation-audit/run_audit.py`) validates every registry and example fixture against all 22 JSON Schemas.
- Application runtime (Phases A–H) mirrors these contracts in Zod to validate lazy-loaded JSON chunks and user-imported CSV/JSON experiment manifests before hydration.

## 5. Acceptance Criteria & Related Documents

- **AC-DATA-001:** All 22 JSON Schemas validate both positive (`examples/valid/`) and negative (`examples/invalid/`) fixtures and 100% of populated registries without error.
- **Links:** [DATASET_CATALOG_AND_SOURCES.md](DATASET_CATALOG_AND_SOURCES.md), [DATA_PROVENANCE_AND_LICENSES.md](DATA_PROVENANCE_AND_LICENSES.md), [KNOWLEDGE_GRAPH_SPECIFICATION.md](../10-knowledge-architecture/KNOWLEDGE_GRAPH_SPECIFICATION.md).
