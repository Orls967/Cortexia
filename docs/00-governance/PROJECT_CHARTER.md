# Project Charter — CORTEXIA

**Document ID:** `DOC-GOV-001`  
**Status:** Authoritative (Phase 0)  
**Owner:** CORTEXIA Multidisciplinary Architecture Team  
**Last Updated:** 2026-11-16

---

## 1. Document Purpose

This charter establishes the mandate, product identity, scientific principles, operational boundaries, governance authority, and Phase 0 exit criteria for **CORTEXIA** (*Comprehensive Neuroscience & Computational Brain Systems Platform*). All downstream product, scientific, mathematical, data, visualization, software, and QA specifications must conform to the principles locked in this charter.

## 2. Scope

This charter governs:
- Product identity and dual-pillar mission (Comprehensive Neuroscience + Computational Neuroscience).
- Explicit scientific realism guardrails and non-clinical scope exclusions.
- Multidisciplinary governance roles across Phase 0 and implementation Phases A–H.
- Authoritative precedence of specifications and change-control requirements.

## 3. Terminology

- **Dual-Pillar Mandate:** Equal architectural priority given to descriptive/mechanistic neuroscience and quantitative computational modeling.
- **UCES (Universal Contextual Explanation System):** Mandatory UI/data architecture ensuring every meaningful scientific entity supports hover tooltips, click/selection inspection, and dedicated knowledge pages.
- **Educational Digital Twin:** Multi-scale computational integration of selected anatomical, cellular, synaptic, circuit, and network representations with explicitly bounded scope.
- **Provenance Tier:** Classification identifying whether an artifact originates from peer-reviewed literature, curated open datasets, atlas reconstructions, or illustrative synthetic generation.

## 4. Background and Strategic Rationale

Existing educational and research tools in neuroscience are typically fragmented into three disconnected silos: (1) static 3D anatomical atlases lacking biophysical simulation, (2) standalone mathematical simulators lacking anatomical/cellular context or biological explanations, and (3) research dataset portals lacking interactive multi-scale synthesis. CORTEXIA unifies these layers inside a single browser-accessible computational environment while preserving scientific honesty about abstraction limits.

## 5. Detailed Specification

### 5.1 Authoritative Project Identity
- **Name:** CORTEXIA
- **Full Title:** Comprehensive Neuroscience & Computational Brain Systems Platform
- **Tagline:** *Explore the Brain. Decode Its Dynamics. Model Its Intelligence.*
- **Deployment Target:** Static Web Application via Vite + GitHub Pages (Phases A–H).

### 5.2 Five Perspectives of the Nervous System
CORTEXIA models the nervous system as five coupled perspectives:
1. **Biological Organ:** Multi-scale hierarchical neuroanatomy and cytoarchitecture (`L6`–`L7`).
2. **Electrochemical System:** Ionic gradients, channels, transporters, neurotransmitters, and membrane biophysics (`L1`–`L4`).
3. **Distributed Network:** Microcircuits, long-range pathways, structural connectomics, and functional graphs (`L5`, `L8`).
4. **Computational System:** ODEs, dynamical systems, spiking networks, synaptic plasticity, and signal/network analytics (`M08`, `M11`).
5. **Cognitive System:** Distributed functional networks supporting perception, memory, attention, language, decision-making, and cognitive control (`L9`).

### 5.3 Non-Negotiable Scientific Realism Guardrails
CORTEXIA explicitly prohibits the following claims in UI copy, documentation, and marketing:
1. Claiming to build a complete biological replica of a human brain.
2. Claiming real-time simulation of human-scale (~86 billion) neurons and (~10^14–10^15) synapses in a web browser.
3. Claiming mind reading, thought decoding, or individual cognitive profiling.
4. Claiming clinical diagnosis, prognosis, triage, or medical treatment recommendation.
5. Claiming that simplified educational models capture full human inter-individual biological variability.
6. Representing procedural 3D meshes as patient MRI reconstructions or anatomical ground truth.
7. Presenting correlation or functional connectivity metrics as causal proof.

### 5.4 Multidisciplinary Governance Roles

| Role | Primary Authority | Key Review Gate |
|---|---|---|
| **Principal Product Architect** | Scope, 5 work environments, 12 modules, UCES integration | Product & IA coherence |
| **Neuroscience & Neuroanatomy Specialists** | `L1`–`L9` taxonomy, Terminologia Neuroanatomica consistency, non-localization | Scientific Content Audit (L1) |
| **Computational Neuroscientist & Math/Numerical Engineers** | Equations, SI/biophysical units, solvers, stability, convergence | Mathematical & Numerical Audit (L2–L3) |
| **Scientific Data Architect** | 22 JSON Schemas, 10+ registries, provenance, licensing, KG invariants | Schema & Provenance Audit |
| **3D Visualization & Frontend Systems Architects** | Three.js/R3F studios, Workers, WASM gates, performance budgets | Visualization & Architecture Audit |
| **Scientific QA & Documentation Engineers** | Traceability matrix, automated audit suite, acceptance criteria | Implementation Readiness Gate |

### 5.5 Specification Precedence & Change Control
Phase 0 documentation serves as the **Single Source of Truth** for Phases A–H:
1. No model parameter default, equation, or anatomical ID may differ between UI, solver code, and registry files.
2. Any change to a model equation, unit, data contract, or module UX during Phases A–H requires updating the corresponding `docs/`, `schemas/`, and `registries/` files and passing `tools/documentation-audit/run_audit.py`.

## 6. Assumptions and Limitations

- **Assumptions:** Implementation targets modern evergreen desktop and mobile browsers supporting WebGL2, ES2022, and Web Workers. External data integration respects upstream API CORS and licensing terms (read-only client fetch or curated bundled static subsets).
- **Limitations:** Browser compute envelopes restrict interactive real-time spiking simulations to thousands of neurons and tens/hundreds of thousands of synapses rather than macroscopic cortical populations.

## 7. Dependencies

- [DOCUMENTATION_STANDARD.md](DOCUMENTATION_STANDARD.md) — formatting, ID grammar, and section requirements.
- [DECISION_LOG.md](DECISION_LOG.md) — architectural decisions locked in Phase 0.
- [PRODUCT_REQUIREMENTS.md](../01-product/PRODUCT_REQUIREMENTS.md) — functional and UCES requirements.

## 8. Validation Requirements and Acceptance Criteria

- **VAL-GOV-001:** Charter establishes project identity, non-clinical boundaries, governance roles, and change control.
- **AC-GOV-001:** All downstream governance, product, scientific, and engineering documents link back to `DOC-GOV-001` principles without contradicting Section 5.3 guardrails.

## 9. Related Documents

- [README.md](../../README.md)
- [PRODUCT_VISION_AND_SCOPE.md](../01-product/PRODUCT_VISION_AND_SCOPE.md)
- [SECURITY_AND_PRIVACY.md](../12-software-architecture/SECURITY_AND_PRIVACY.md)

## 10. References

- `REF-KANDEL-2021`: Kandel et al. (2021), *Principles of Neural Science* (6th ed.), McGraw-Hill.
- `REF-GERSTNER-2014`: Gerstner et al. (2014), *Neuronal Dynamics*, Cambridge University Press, DOI: `10.1017/CBO9781107447615`.
- `REF-DAYAN-2001`: Dayan & Abbott (2001), *Theoretical Neuroscience*, MIT Press.
