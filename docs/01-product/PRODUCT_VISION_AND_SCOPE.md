# Product Vision and Scope — CORTEXIA

**Document ID:** `DOC-PROD-001`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the product vision, dual-pillar identity, conceptual five-layer brain lens, target user segments, and strict inclusion/exclusion boundaries for CORTEXIA.

## 2. Terminology

See [GLOSSARY.md](../00-governance/GLOSSARY.md). Key terms: *Dual-Pillar Mandate*, *Work Environment*, *UCES*, *Educational Digital Twin*.

## 3. Product Vision

CORTEXIA (*Comprehensive Neuroscience & Computational Brain Systems Platform* — *"Explore the Brain. Decode Its Dynamics. Model Its Intelligence."*) transforms neuroscience learning and computational modeling from isolated static textbooks or black-box demos into one unified scientific observatory and simulation laboratory.

### 3.1 Dual-Pillar Equality
1. **Comprehensive Neuroscience:** Multi-scale biological comprehension from proteins, ion channels, and neurotransmitters (`L1`) through cells, synapses, circuits, and anatomy (`L2`–`L8`) to sensory, motor, and cognitive systems (`L9`).
2. **Computational Neuroscience:** First-class mathematical simulation environment enabling users to inspect governing ODEs/PDEs/graph equations, manipulate biophysical parameters, select numerical solvers, run parameter sweeps, analyze emergent dynamics, and audit reproducibility.

### 3.2 Five Coupled Brain Perspectives

| Perspective | Core Scientific Question | Primary CORTEXIA Modules |
|---|---|---|
| **Biological Organ** | How is the nervous system physically structured across macro and micro anatomy? | `MOD-02`, `MOD-03` |
| **Electrochemical System** | How do ionic gradients, channels, and receptors generate electrical and chemical signals? | `MOD-04`, `MOD-05`, `MOD-07` |
| **Distributed Network** | How do microcircuits and long-range structural pathways organize functional interactions? | `MOD-06`, `MOD-01` |
| **Computational System** | How do mathematical equations, solvers, plasticity rules, and network dynamics model neural behavior? | `MOD-08`, `MOD-11` |
| **Cognitive System** | How do distributed neural circuits support memory, attention, perception, language, and decision-making? | `MOD-09`, `MOD-10`, `MOD-12` |

## 4. Target User Segments

1. **Neuroscience & Biology Students:** Need visual-spatial anatomy coupled directly to physiological mechanisms and guided conceptual explanations via UCES.
2. **Computational Neuroscience Researchers & Engineers:** Need transparent equations, solver controls (`dt`, RK4/Rush–Larsen), parameter sweeps, spike/PSD analytics, and reproducible JSON exports.
3. **Educators & Course Instructors:** Need preset validated experiments (`EXP-*`), side-by-side baseline vs. intervention comparisons, and structured knowledge pages for teaching.
4. **Interdisciplinary Scientists / Neurotech Practitioners:** Need signal processing pipelines (EEG filtering, Welch PSD, STFT, coherence) paired with explicit anatomical and biophysical interpretation limits.

## 5. Product Scope

### 5.1 In-Scope Capabilities
- 5 integrated Work Environments (`ENV-01` through `ENV-05`) unified over 12 domain modules (`MOD-01`–`MOD-12`).
- 9 multi-scale exploration layers (`L1`–`L9`) interconnected by a typed Knowledge Graph.
- 4 interactive WebGL/Three.js 3D Visualization Studios (`Whole Brain`, `Cellular`, `Synaptic & Molecular`, `Neural Network`).
- Universal Contextual Explanation System (`UCES`) providing hover tooltips, click/selection inspectors, and dedicated knowledge pages across all 17+ scientific UI entity classes.
- Client-side Web Worker computational laboratory supporting 16 model families and 28 validated mathematical model implementations, parameter sweeps, and Research Notebook exports.
- Client-side Neural Signal & Network Analytics (FFT, PSD, STFT, wavelets, raster/ISI/PSTH, graph topology, bootstrap/regression statistics) with curated open-dataset schemas and synthetic reference benchmarks.
- 5-tier Educational Brain Systems Digital Twin linking selected cellular, synaptic, microcircuit, and network dynamics.

### 5.2 Explicit Out-of-Scope Exclusions

| Excluded Claim / Capability | Rationale |
|---|---|
| **Clinical diagnosis or patient triage** | CORTEXIA is not a regulated medical device (`SaMD`) and performs no clinical inference. |
| **Treatment or pharmacological recommendation** | Neurochemistry is strictly mechanistic/educational; no dosing or medical guidance is provided. |
| **Whole-human-brain cellular simulation** | Browser hardware cannot simulate ~$8.6 \times 10^{10}$ neurons or $10^{14}+$ synapses; models operate within explicit browser envelopes. |
| **Mind reading / neural thought decoding** | EEG and cognitive models cannot reconstruct private thoughts or individual mental states. |
| **Experimental imaging parity for procedural meshes** | Illustrative/procedural 3D geometry is explicitly tagged and never represented as patient MRI/EM ground truth. |
| **Server-side patient PHI storage** | CORTEXIA deploys statically on GitHub Pages; user-imported CSV/signal files remain strictly in browser memory/local storage without server upload. |

## 6. Assumptions and Limitations

- Initial deployment targets static hosting (GitHub Pages); heavy server-side HPC clusters (NEURON/NetPyNE clusters) are outside client-side runtime scope, though ModelDB conceptual provenance is documented.
- Interactive real-time frame rates (`>= 60 fps`) constrain simultaneous simulated network sizes in-browser.

## 7. Dependencies & Related Documents

- [PROJECT_CHARTER.md](../00-governance/PROJECT_CHARTER.md)
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)
- [DIGITAL_TWIN_ARCHITECTURE.md](../02-scientific-foundation/DIGITAL_TWIN_ARCHITECTURE.md)
- [SECURITY_AND_PRIVACY.md](../12-software-architecture/SECURITY_AND_PRIVACY.md)

## 8. Acceptance Criteria

- **AC-PROD-001:** Every module (`MOD-01`–`MOD-12`) maps cleanly to the dual-pillar mission and adheres to Section 5.2 non-clinical exclusions.
