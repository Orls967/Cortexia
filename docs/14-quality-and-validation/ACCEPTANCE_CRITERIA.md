# Master Acceptance Criteria — CORTEXIA

**Document ID:** `DOC-QA-004`  
**Status:** Authoritative (Phase 0 & Implementation Phases A–H)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document consolidates the authoritative acceptance criteria governing **Phase 0 Documentation Completion** and **Phase A–H Implementation Delivery** across all domains of CORTEXIA.

---

## 2. Phase 0 Documentation Package Acceptance Gates (`GATE-P0`)

| Gate ID | Area | Acceptance Criterion | Verification Method |
|---|---|---|---|
| `GATE-P0-01` | **Repository Preflight** | Existing Git repository and `origin` remote verified; history preserved; `.gitignore` compliant. | `git status`, `git remote -v`, `git log` |
| `GATE-P0-02` | **Module & Scale Coverage** | All 12 modules (`MOD-01`–`MOD-12`), 5 work environments (`ENV-01`–`ENV-05`), and 9 scales (`L1`–`L9`) fully specified. | `run_audit.py` module/scale check |
| `GATE-P0-03` | **Universal Explanation System** | Hover, Inspector (12 fields), and Dedicated Knowledge Page behaviors, 17-class UI matrix, schema, and coverage audit fully specified. | `DOC-VIS-005` + `run_audit.py` UCES check |
| `GATE-P0-04` | **Computational Models & Math** | All 16 model families and 28 model implementations documented with governing equations, variables, units, solvers, assumptions, and `VAL-*` cases. | `run_audit.py` model/equation check |
| `GATE-P0-05` | **22 Formal JSON Schemas** | All 22 schemas created under `schemas/` and validated against positive (`examples/valid/`) and negative (`examples/invalid/`) test fixtures. | `run_audit.py` schema audit |
| `GATE-P0-06` | **Populated Scientific Registries** | All 16 registries populated with distinct, non-duplicated entries, zero broken foreign keys, and 100% DOI/source-verified `REF-*` references. | `run_audit.py` referential integrity audit |
| `GATE-P0-07` | **Link & Consistency Integrity** | Zero empty Markdown files, zero broken relative links, zero duplicate IDs across docs and registries. | `run_audit.py` link & ID check |
| `GATE-P0-08` | **Traceability Completeness** | Every `REQ-*` requirement traces to module, domain, doc, schema/registry, validation method, acceptance criterion, and phase. | `TRACEABILITY_MATRIX.md` + `run_audit.py` |

---

## 3. Future Implementation Acceptance Criteria (`Phases A–H`)

| Area | Criterion ID | Mandatory Implementation Acceptance Condition |
|---|---|---|
| **Anatomy (`MOD-02`)** | `AC-IMP-ANAT` | Every anatomical structure has a stable `ANAT-*` ID, TNA name, hierarchy parent, atlas provenance badge, and 3D selection sync. |
| **Equations & Units** | `AC-IMP-EQ` | Every displayed equation renders via KaTeX with complete variable definitions, physical units, and sign convention compliance. |
| **Numerical Solvers** | `AC-IMP-SOLV` | All 8 solvers pass step-convergence order tests and divergence traps inside Web Workers. |
| **Simulators (`MOD-08`)** | `AC-IMP-SIM` | All 28 models render the 5-panel workspace and reproduce their `VAL-*` reference benchmarks within specified tolerances. |
| **Universal Explanations** | `AC-IMP-UCES` | All 10 UCES acceptance criteria (`AC-UCES-001`–`010`) pass across desktop hover/click and mobile tap flows with zero generic placeholder text. |
| **3D Studios (`A–D`)** | `AC-IMP-3D` | All 4 Studios support orbit, presets, isolation, clipping, relationship highlighting, asset accuracy badges, and `>= 60 fps` desktop rendering. |
| **Data & Analytics (`MOD-11`)** | `AC-IMP-DATA` | All 26 analytics methods pass synthetic ground-truth tests; all datasets display license, attribution, sampling rate, units, and `Correlation ≠ Causation` notices. |
| **Digital Twin (`Tier 5`)** | `AC-IMP-TWIN` | All 3 coupled cross-scale experiments execute end-to-end and explicitly label mechanistic vs. conceptual links. |
| **Deployment (`GitHub Pages`)** | `AC-IMP-DEPLOY`| Live URL returns HTTP 200 over HTTPS, all deep routes survive refresh, 3D assets and workers load with 0 console/network errors. |

## 4. Related Documents

- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md)
- [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md)
- [GITHUB_PAGES_DEPLOYMENT.md](../15-deployment/GITHUB_PAGES_DEPLOYMENT.md)
