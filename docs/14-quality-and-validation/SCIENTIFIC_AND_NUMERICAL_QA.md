# Scientific & Numerical Quality Assurance Specification — CORTEXIA

**Document ID:** `DOC-QA-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's **Four-Level Scientific Validation Framework** (Section 14 of the project concept and Section 20 of the Master Prompt), ensuring scientific content accuracy, mathematical/unit consistency, numerical solver convergence, and cross-module behavioral parity.

---

## 2. Four-Level Scientific Validation Framework

### Level 1 — Scientific Content & Epistemic Validation
- **Nomenclature Audit:** All anatomical entities (`ANAT-*`) must match FIPAT *Terminologia Neuroanatomica* (`REF-TNA-FIPAT`) and declare valid parent hierarchies.
- **Citation Provenance Audit:** Every scientific claim, equation (`EQ-*`), model (`MODEL-*`), and dataset (`DSET-*`) must link to at least one verified `REF-*` entry in `scientific-references.json`. Zero invented DOIs or unattributed numbers are permitted.
- **Epistemic & Non-Localization Guardrails:** Cognitive (`MOD-10`) and Computational Psychiatry (`DOM-CP`) entries must pass automated checks confirming the presence of `epistemicStatus` tags and non-clinical / distributed-network disclaimers.

### Level 2 — Mathematical & Numerical Solver Validation
- **Dimensional Homogeneity Check:** Every equation in `equations.json` has verified left-hand and right-hand physical units matching [MATHEMATICAL_CONVENTIONS.md](../06-computational-models/MATHEMATICAL_CONVENTIONS.md).
- **Order-of-Convergence Verification:** For smooth ODEs (`MODEL-001`, `MODEL-002`, `MODEL-004`, `MODEL-017`), let $E(h) = \|\mathbf{y}_h(T) - \mathbf{y}_{\text{ref}}(T)\|_\infty$. Automated tests verify:
  $$p_{\text{emp}} = \log_2\!\left(\frac{E(h)}{E(h/2)}\right) \in \begin{cases} [0.9, 1.2] & \text{for } \texttt{SOLVER-FE} \\ [3.7, 4.3] & \text{for } \texttt{SOLVER-RK4} \end{cases}$$
- **Gating Variable Invariant Check:** Throughout any Hodgkin–Huxley or Morris–Lecar run under `SOLVER-RUSH-LARSEN` or `SOLVER-RK4` (`dt <= 0.02 ms`), gating variables must satisfy $x(t) \in [0, 1]$ and synaptic weights must satisfy $w(t) \in [w_{\min}, w_{\max}]$.

### Level 3 — Model Behavior & Reference Benchmark Validation
- Executes all 19 canonical validation cases (`VAL-HH-001` through `VAL-GRAPH-001`) defined in [MODEL_VALIDATION.md](../06-computational-models/MODEL_VALIDATION.md):
  - Action potential threshold, peak overshoot, and absolute refractory block in `MODEL-001`.
  - Exact match to analytical `CUBA-LIF` $f\text{–}I$ curve (`VAL-LIF-001`, relative error `< 0.2%`).
  - Voltage-dependent $Mg^{2+}$ negative-slope conductance in `MODEL-014` (`NMDA`).
  - Bi & Poo asymmetric exponential window in `MODEL-024` (`STDP`).
  - Asynchronous Irregular (`AI`, $CV_{\text{ISI}} \approx 0.85$) vs. Synchronous Regular (`SR`) transition in `MODEL-021` (`Brunel`).

### Level 4 — Application & Cross-Module Integration Validation
- Verifies that selecting an entity in a 3D Studio (`ENV-01`), inspecting its equations in the UCES Inspector, launching its linked simulator in `ENV-02`, and analyzing its output spectrum in `ENV-03` uses the **exact same entity ID, parameter defaults, and physical units** across all four views.

## 3. Acceptance Criteria & Related Documents

- **AC-QA-002:** Zero models or analysis methods ship in Phases D–H without passing Levels 1–4 validation gates.
- **Links:** [MODEL_VALIDATION.md](../06-computational-models/MODEL_VALIDATION.md), [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md), [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).
