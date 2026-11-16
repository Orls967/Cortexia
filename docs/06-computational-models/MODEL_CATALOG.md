# Computational Model Catalog (Module 08) — CORTEXIA

**Document ID:** `DOC-MOD-001`  
**Module:** `MOD-08` (Computational Neuroscience Laboratory)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the taxonomy, abstraction levels, solver pairings, browser compute envelopes, and registry identifiers for all **16 Model Families** and **28 Distinct Computational Model Implementations** (`MODEL-001` through `MODEL-028`) in CORTEXIA's Computational Neuroscience Laboratory (`MOD-08`).

> [!IMPORTANT]
> **Anti-Inflation Rule:** Trivial parameter presets (e.g., changing Izhikevich $(a,b,c,d)$ from Regular Spiking to Fast Spiking) are classified as **Experiment Presets (`EXP-*`)**, never as separate models. Each of the 28 `MODEL-*` entries below has a distinct mathematical governing formulation.

---

## 2. Sixteen Model Families & Twenty-Eight Model Implementations

| Model ID | Model Name | Family ID | Family Name | Scale(s) | Primary Solver | Safe Browser Cap |
|---|---|---|---|---|---|---|
| `MODEL-001` | Hodgkin–Huxley Conductance Model | `FAM-01` | Biophysical Conductance Membrane | `L1`–`L3` | `RK4` / `Rush–Larsen` (`dt=0.01 ms`) | `<= 200` cells |
| `MODEL-002` | Morris–Lecar $Ca^{2+}/K^+$ Conductance Model | `FAM-02` | Reduced Conductance-Based | `L2`–`L3` | `RK4` (`dt=0.05 ms`) | `<= 500` cells |
| `MODEL-003` | Connor–Stevens A-Current Model | `FAM-01` | Biophysical Conductance Membrane | `L2`–`L3` | `RK4` (`dt=0.01 ms`) | `<= 200` cells |
| `MODEL-004` | FitzHugh–Nagumo Phase-Plane Excitable Model | `FAM-03` | Phase-Plane Reduced Excitable | `L3` | `RK4` (`dt=0.05 ms`) | `<= 1,000` units |
| `MODEL-005` | Current-Based Leaky Integrate-and-Fire (`CUBA-LIF`) | `FAM-04` | Integrate-and-Fire (`LIF`) | `L3` | Exact / Sub-stepped Euler (`dt=0.1 ms`) | `<= 5,000` cells |
| `MODEL-006` | Conductance-Based Leaky Integrate-and-Fire (`COBA-LIF`) | `FAM-04` | Integrate-and-Fire (`LIF`) | `L3`–`L4` | `RK2` / `RK4` (`dt=0.1 ms`) | `<= 4,000` cells |
| `MODEL-007` | Quadratic Integrate-and-Fire (`QIF` / $\theta$-Neuron) | `FAM-04` | Integrate-and-Fire (`LIF`) | `L3` | `RK4` + threshold interpolation | `<= 5,000` cells |
| `MODEL-008` | Adaptive Exponential Integrate-and-Fire (`AdEx`) | `FAM-05` | Adaptive Spiking Neuron | `L3` | `RK4` / Sub-stepped (`dt=0.05 ms`) | `<= 4,000` cells |
| `MODEL-009` | Izhikevich 2D Phenomenological Spiking Model | `FAM-05` | Adaptive Spiking Neuron | `L3` | Hybrid `0.5 ms` voltage sub-step | `<= 5,000` cells |
| `MODEL-010` | Passive Dendritic Cable & Rall Multi-Compartment | `FAM-06` | Dendritic & Cable Compartmental | `L2`–`L3` | Crank–Nicolson / `RK4` (`N<=50` segs) | `<= 50` compartments |
| `MODEL-011` | Single-Exponential Current-Based Synapse | `FAM-07` | Current-Based Synaptic Kernels | `L4` | Exact exponential decay (`dt=0.1 ms`) | `<= 200,000` edges |
| `MODEL-012` | Alpha-Function Postsynaptic Conductance | `FAM-08` | Conductance-Based Synapses | `L4` | 2-state cascade ODE (`dt=0.1 ms`) | `<= 100,000` edges |
| `MODEL-013` | Bi-Exponential AMPA / $GABA_A$ Conductance Synapse | `FAM-08` | Conductance-Based Synapses | `L4` | Exact dual-exponential (`dt=0.1 ms`) | `<= 100,000` edges |
| `MODEL-014` | Voltage-Dependent NMDA $Mg^{2+}$-Block Synapse | `FAM-08` | Conductance-Based Synapses | `L1`, `L4` | Dual-exp + Jahr–Stevens $B(V)$ | `<= 50,000` edges |
| `MODEL-015` | Electrical Gap-Junction Ohmic Coupling | `FAM-08` | Conductance-Based Synapses | `L4` | Symmetric diffusive coupling | `<= 20,000` pairs |
| `MODEL-016` | Tsodyks–Markram Short-Term Plasticity (`STP`) | `FAM-09` | Short-Term Synaptic Dynamics | `L4` | Event-driven + continuous recovery | `<= 50,000` edges |
| `MODEL-017` | Wilson–Cowan Excitatory–Inhibitory Population | `FAM-10` | Neural Population Rate Models | `L5`–`L6` | `RK4` (`dt=0.1 ms`) | `<= 200` populations |
| `MODEL-018` | Jansen–Rit Cortical Column Neural Mass Model | `FAM-11` | Neural Mass & Macroscopic Rhythm | `L6` | `RK4` (`dt=0.5 ms`) | `<= 100` columns |
| `MODEL-019` | Wong–Wang Two-Population Decision Attractor | `FAM-10` | Neural Population Rate Models | `L6`, `L9` | Euler–Maruyama SDE (`dt=0.5 ms`) | `<= 50` circuits |
| `MODEL-020` | Feedforward Spiking Synfire / Cascade Network | `FAM-12` | Spiking Neural Networks (`SNN`) | `L5` | Event-driven / `dt=0.1 ms` | `<= 3,000` neurons |
| `MODEL-021` | Brunel Balanced Sparse Recurrent E/I Spiking Network | `FAM-12` | Spiking Neural Networks (`SNN`) | `L5` | `dt=0.1 ms` + ring delay buffer | `<= 4,000` neurons |
| `MODEL-022` | Vogels Inhibitory-Plasticity Balanced E/I Network | `FAM-12` | Spiking Neural Networks (`SNN`) | `L4`–`L5` | `dt=0.1 ms` + online iSTDP | `<= 2,500` neurons |
| `MODEL-023` | Rate-Based Hebbian, Oja PCA & BCM Plasticity | `FAM-13` | Rate & Homeostatic Plasticity | `L4` | `RK2` / Euler (`dt=1.0 ms`) | `<= 1,000` synapses |
| `MODEL-024` | Pair-Based & Triplet Spike-Timing-Dependent Plasticity (`STDP`) | `FAM-14` | Spike-Timing Plasticity | `L4` | Online eligibility trace updates | `<= 50,000` synapses |
| `MODEL-025` | Multiplicative Homeostatic Synaptic Scaling | `FAM-13` | Rate & Homeostatic Plasticity | `L3`–`L4` | Slow rate-sensor ODE | `<= 20,000` synapses |
| `MODEL-026` | Dopamine Reward-Prediction-Error (`TD-RL`) Model | `FAM-15` | Reinforcement & Predictive Learning | `L4`, `L9` | Discrete trial / continuous TD($\lambda$) | `<= 500` states |
| `MODEL-027` | Kuramoto Coupled Phase Oscillator Network | `FAM-16` | Coupled Neural Oscillators & Graphs | `L6`, `L8` | `RK4` / Euler–Maruyama (`dt=0.5 ms`) | `<= 200` nodes |
| `MODEL-028` | Connectome Graph Diffusion & Structural-to-Functional Network | `FAM-16` | Coupled Neural Oscillators & Graphs | `L8` | Matrix exponential / coupled ODEs | `<= 180` regions |

---

## 3. Five-Panel Standard Simulation Workspace Contract

Every `MODEL-*` entry rendered in `MOD-08` (`ENV-02`) MUST populate five standardized workspace panels:
1. **Panel 1 — Model & Theory:** Biological interpretation, LaTeX governing equations (`EQ-*`), variable table, parameter table with units, and Knowledge Graph links.
2. **Panel 2 — Experiment Setup:** Parameter sliders/inputs with hard min/max bounds, stimulus waveform generator (step, pulse train, ramp, sine, Ornstein–Uhlenbeck noise), initial condition editor, solver selector, `dt` selector, duration, and PRNG seed.
3. **Panel 3 — Simulation View:** Live animated membrane/phase-plane/network canvas or linked 3D Studio playback with play/pause/step/scrub controls.
4. **Panel 4 — Results & Analytics:** Multi-trace time-series plots, phase portraits, spike rasters, firing metrics, parameter-sweep curves, and one-click **"Send to Analytics (`ENV-03`)"** / **"Save to Research (`ENV-05`)"**.
5. **Panel 5 — Validation & Limitations:** Reference benchmark comparison, numerical convergence indicator, explicit model assumptions, validity domain, and phenomena *not* captured by the model.

## 4. Acceptance Criteria & Related Documents

- **AC-MOD-001:** All 28 models are individually specified across `docs/06-computational-models/` and `registries/scientific-models/scientific-models.json` with verified equations, units, solvers, and validation cases.
- **Links:** [MATHEMATICAL_CONVENTIONS.md](MATHEMATICAL_CONVENTIONS.md), [NUMERICAL_METHODS.md](NUMERICAL_METHODS.md), [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
