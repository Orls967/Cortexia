# Individual Module UX Specifications (Modules 01–12) — CORTEXIA

**Document ID:** `DOC-UX-003`  
**Modules Covered:** `MOD-01` through `MOD-12`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document provides individual user experience, layout, control, visualization, state (loading/empty/error), and UCES interaction specifications for all **12 primary modules (`MOD-01`–`MOD-12`)**.

---

## 2. Module-by-Module UX Specifications

### Module 01 (`MOD-01`) — CORTEXIA Observatory
- **Primary View:** Interactive 9-Scale Concentric Navigator (`L1`–`L9`) paired with a 3D Whole-Brain activity preview, 12 Module Launch Cards, Featured Experiments carousel (`EXP-*`), and Recently Inspected Entities tray.
- **UCES Binding:** Hovering any scale ring or system node previews its scope; clicking opens the UCES Inspector and filters featured experiments.

### Module 02 (`MOD-02`) — Neuroanatomy Atlas
- **Primary View:** Left searchable TNA Hierarchy Tree + Center **Studio A Whole Brain 3D Viewport** + Bottom Orthogonal Slice Trio (`Sagittal`, `Coronal`, `Axial` linked crosshairs) + Right UCES Inspector.
- **Controls:** Camera preset bar (`8` views), 3-axis clipping sliders, Region Isolation toggle, Cortex Opacity slider, and Tract/System Relationship highlighter.
- **Empty/Error States:** WebGL fallback renders interactive 2D SVG sagittal/coronal/axial atlas plates with identical click-to-inspect entity IDs.

### Module 03 (`MOD-03`) — Cellular Neuroscience
- **Primary View:** Cell Class Selector (`Pyramidal`, `PV/SST/VIP Interneurons`, `Purkinje`, `Motor`, `Sensory`, `Astrocyte`, `Oligodendrocyte`, `Microglia`, `Ependymal`) + Center **Studio B Cellular 3D Viewport** + Subcellular Compartment Strip (`Soma`, `Dendrites`, `Spines`, `AIS`, `Myelin`, `Nodes of Ranvier`, `Bouton`).
- **Controls:** Myelinated vs. Unmyelinated conduction comparison split-view, Axonal Transport kinesin/dynein animation scrubber, and **"Launch Single-Cell Simulator (`MOD-08`)"** CTA.

### Module 04 (`MOD-04`) — Molecular & Neurochemical Systems
- **Primary View:** Top tab bar switching between **(1) Ion Channel Biophysics**, **(2) Synaptic Vesicle Cycle**, **(3) Eight Neurotransmitter Systems**, and **(4) Nernst / GHK Equilibrium Calculator**.
- **Interactive Widgets:** Studio C channel cutaway synchronized with voltage step; interactive $[Na^+], [K^+], [Ca^{2+}], [Cl^-]$ concentration sliders updating Nernst $E_{\text{ion}}$ and GHK $V_m$ in real time; prominent non-clinical educational notice.

### Module 05 (`MOD-05`) — Synaptic Architecture & Plasticity
- **Primary View:** Center **Studio C Synaptic Cleft 3D Scene** (Chemical vs. Electrical Gap-Junction toggle) + Bottom Plasticity Timeline comparing `STF/STD` (`ms`), `Early/Late LTP & LTD` (`min–hr`), `STDP` ($\Delta t$ window), and `Homeostatic Scaling`.
- **Direct Simulator Coupling:** Clicking *"Run STDP Pair Experiment"* or *"Run Tsodyks–Markram STP"* opens the pre-configured model in `MOD-08` while keeping the synaptic entity selected.

### Module 06 (`MOD-06`) — Neural Circuits & Connectomics
- **Primary View:** Split workspace: Left **Studio D 3D/2D Interactive Network Graph** + Right **Reorderable $N \times N$ Connectivity Matrix Heatmap** + Bottom Graph Topology Metric Cards (`Degree`, `Betweenness`, `Clustering`, `Path Length`, `Modularity Q`, `Small-World σ`).
- **Mandatory Provenance UX:** Top toolbar requires selecting active matrix layer (`Empirical Structural SC`, `Estimated Functional FC`, or `Synthetic Simulation Graph`) and renders an unmistakable color-coded provenance banner.

### Module 07 (`MOD-07`) — Neurophysiology & Neural Dynamics
- **Primary View:** Interactive Membrane Equivalent Circuit Diagram ($C_m, g_{\text{Na}}(V,t), g_{\text{K}}(V,t), g_{\text{L}}$) synchronized with live Action Potential phase stages (`Resting → Depolarization → Overshoot → Repolarization → Hyperpolarization / Refractory`) and Neural Oscillation Band Explorer ($\delta, \theta, \alpha, \beta, \gamma$).

### Module 08 (`MOD-08`) — Computational Neuroscience Laboratory
- **Primary View:** **Standardized 5-Panel Simulation Workspace** (`Model & Theory`, `Experiment Setup`, `Simulation View`, `Results & Analytics`, `Validation & Limitations`) plus a dedicated tab for the **5-Tier Educational Digital Twin Pipeline**.
- **Controls:** Grouped parameter sliders with physical units, Stimulus Builder (`Step`, `Pulse Train`, `Ramp`, `Sine`, `OU Noise`), Solver & `dt` selector with stiffness guardrails, `Run / Cancel / Sweep` action bar, and progress telemetry bar.

### Module 09 (`MOD-09`) — Systems Neuroscience
- **Primary View:** 12-System Selector Grid + Interactive Multi-Stage Anatomical Relay Flowchart (`Receptor Organ → First-Order Nucleus → Thalamic Relay → Primary/Association Cortex`) synchronized with Studio A 3D pathway highlighting.

### Module 10 (`MOD-10`) — Cognitive Neuroscience
- **Primary View:** Cognitive Domain Matrix (`Memory`, `Working Memory`, `Attention`, `Perception`, `Decision`, `Learning`, `Language Dual-Stream`, `Emotion`, `Control`, `Consciousness Theories`) displaying multi-region distributed network maps and mandatory Epistemic Badges (`ESTABLISHED`, `ACTIVE_RESEARCH`, `THEORETICAL_HYPOTHESIS`).
- **Guardrail Banner:** Persistent header warning against single-region phrenological localization.

### Module 11 (`MOD-11`) — Neural Data & Signal Analytics
- **Primary View:** 4-Workbench Tab Bar: **(A) EEG & Time-Series Explorer** (multichannel stack, FIR/IIR filters, Welch PSD, STFT, Morlet Wavelet, ERP), **(B) Spike Train Suite** (Raster, ISI, CV, Fano, PSTH, STA, CCG, Synchrony), **(C) Network Science Suite**, and **(D) Statistical Workbench & CSV Importer**.
- **Safeguards:** Every correlation, coherence, and FC panel displays a pinned `Correlation ≠ Causation` interpretive banner and dataset license/provenance pill.

### Module 12 (`MOD-12`) — Scientific Knowledge & Research Library
- **Primary View:** Unified Library Shell hosting Dedicated Entity Pages (`/knowledge/:entityId`), Interactive Force-Directed Knowledge Graph (`/knowledge/graph`), Equation & Parameter Repository, Dataset Catalog, Model Validation Reports, and DOI-Verified Bibliography.

## 3. Acceptance Criteria & Related Documents

- **AC-UX-003:** All 12 modules implement consistent UCES hover/inspector/page affordances, loading skeletons, empty states, and error boundaries.
- **Links:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [APPLICATION_LAYOUT_AND_ENVIRONMENTS.md](APPLICATION_LAYOUT_AND_ENVIRONMENTS.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md).
