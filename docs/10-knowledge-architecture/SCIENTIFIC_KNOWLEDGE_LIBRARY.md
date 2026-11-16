# Scientific Knowledge & Research Library Specification (Module 12) — CORTEXIA

**Document ID:** `DOC-KG-002`  
**Module:** `MOD-12` (Scientific Knowledge & Research Library)  
**Environment:** `ENV-04` (Knowledge Environment)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the information architecture, content schemas, equation repository, bibliography explorer, model validation report viewer, and dedicated UCES entity detail pages inside **Module 12 — Scientific Knowledge & Research Library**.

## 2. Core Sub-Libraries of Module 12

| Sub-Library | Route | Source Registry / Schema | Key Capabilities |
|---|---|---|---|
| **Neuroscience Encyclopedia & Dedicated Entity Pages** | `/knowledge/:entityId` | `explanation-coverage.json` + domain registries | Full multi-section scientific articles with KaTeX math, 3D preview cards, model launchers, and verified citations |
| **Interactive Knowledge Graph** | `/knowledge/graph/:entityId?` | `knowledge-graph.json` | 2D/3D force-directed ego graph, semantic relation filters, shortest-path finder between any 2 entities |
| **Mathematical Equation & Parameter Repository** | `/knowledge/equations/:eqId?` | `equations.json`, `parameters.json` | Searchable symbol/unit/dimension catalog linking every equation to governing models and derivations |
| **Dataset & Source Catalog** | `/knowledge/datasets/:dsetId?` | `datasets.json` | Provenance, modality, sampling rate, BIDS/NWB/SWC format specs, and license compliance badges |
| **Model Validation Reports** | `/knowledge/validation` | `scientific-models.json` (`VAL-*`) | Convergence plots, analytical benchmark comparisons, error tolerances, and known model limitations |
| **Terminology Glossary & Bibliography** | `/knowledge/references` | `GLOSSARY.md`, `scientific-references.json` | Searchable glossary + DOI-verified peer-reviewed reference explorer with claim traceability |

---

## 3. Anatomy of a Dedicated Scientific Knowledge Page (`/knowledge/:entityId`)

Per Section 3.1.C of the Master Prompt, a dedicated knowledge page MUST never merely repeat a short tooltip. Every page renders ten standardized sections:
1. **Entity Header & Classification Bar:** Canonical name, TNA/biophysical aliases, immutable `ID`, Entity Type badge, Primary & Secondary Biological Scales (`L1`–`L9`), and Epistemic Status badge (`ESTABLISHED`, `ACTIVE_RESEARCH`, `THEORETICAL_HYPOTHESIS`).
2. **Executive Scientific Overview:** Concise synthesis of structure, mechanism, and functional significance.
3. **Biological & Anatomical / Molecular Context:** Hierarchical parent/child placement, cellular localization, or neurotransmitter/channel family.
4. **Detailed Mechanistic Specification:** Step-by-step physiological, biochemical, or dynamical mechanism.
5. **Mathematical Formulation & Parameters (where applicable):** Rendered LaTeX equations (`EQ-*`), variable definitions, and parameter table (`PARAM-*`) with physical units and literature provenance.
6. **Interactive 3D & Studio Links:** Embedded preview card + **"Inspect in 3D Studio (`ENV-01`)"** deep link.
7. **Coupled Computational Models & Experiments:** Direct launch cards for associated `MODEL-*` and preset `EXP-*` runs in `ENV-02`.
8. **Assumptions, Abstraction Boundaries & Limitations:** Explicit statement of what is simplified and where biological variability or clinical non-equivalence applies.
9. **Local Knowledge Graph Neighborhood:** Interactive mini-graph of 1-hop incoming/outgoing typed relationships.
10. **Verified Scientific References:** Clickable `REF-*` citations with DOI/ISBN links and specific claims supported.

## 4. Acceptance Criteria & Related Documents

- **AC-KG-002:** Every substantive entity in CORTEXIA resolves to a complete `/knowledge/:entityId` specification with zero placeholder filler text and >= 1 verified `REF-*` citation.
- **Links:** [KNOWLEDGE_GRAPH_SPECIFICATION.md](KNOWLEDGE_GRAPH_SPECIFICATION.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md).
