# Mathematical Conventions & Physical Units — CORTEXIA

**Document ID:** `DOC-MOD-002`  
**Module:** `MOD-08`, `MOD-11`, `MOD-12`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document locks the physical units, dimensional scaling factors, current/voltage sign conventions, floating-point precision standards, and notation rules across all CORTEXIA equations, solvers, schemas, and UI displays.

## 2. Canonical Neuroscience & SI Unit System

To avoid scaling bugs (`10^3` or `10^6` factor mismatches), CORTEXIA standardizes two mutually consistent unit systems: **Specific (Area-Normalized Membrane)** for Hodgkin–Huxley / Morris–Lecar models, and **Point-Neuron (Total Cell)** for LIF / AdEx / Conductance-Synapse models.

| Physical Quantity | Symbol | Specific Unit (HH / ML) | Point-Neuron Unit (LIF / AdEx) | Base SI Conversion |
|---|---|---|---|---|
| **Membrane Potential** | $V, V_m$ | $\text{mV}$ | $\text{mV}$ | $1\text{ mV} = 10^{-3}\text{ V}$ |
| **Time / Time Constant** | $t, \tau, \Delta t$ | $\text{ms}$ | $\text{ms}$ | $1\text{ ms} = 10^{-3}\text{ s}$ |
| **Membrane Capacitance** | $C_m$ | $\mu\text{F/cm}^2$ | $\text{pF}$ | $1\ \mu\text{F/cm}^2 \times 1\text{ mV/ms} = 1\ \mu\text{A/cm}^2$ |
| **Membrane / Ionic Current** | $I, I_{\text{ion}}, I_{\text{ext}}$ | $\mu\text{A/cm}^2$ | $\text{pA}$ | $1\text{ pF} \times 1\text{ mV/ms} = 1\text{ pA}$ |
| **Conductance** | $g, \bar{g}_{\text{ion}}, g_{\text{syn}}$ | $\text{mS/cm}^2$ | $\text{nS}$ | $1\text{ mS/cm}^2 \times 1\text{ mV} = 1\ \mu\text{A/cm}^2$; $1\text{ nS} \times 1\text{ mV} = 1\text{ pA}$ |
| **Resistance** | $R, R_m$ | $\text{k}\Omega\cdot\text{cm}^2$ | $\text{M}\Omega$ or $\text{G}\Omega$ | $1\text{ G}\Omega \times 1\text{ pA} = 1\text{ mV}$ |
| **Ion Concentration** | $[X]_{\text{in}}, [X]_{\text{out}}$ | $\text{mM}$ ($\text{mmol/L}$) | $\text{mM}$ | $1\text{ mM} = 1\text{ mol/m}^3$ |
| **Firing Rate / Frequency** | $f, r, \nu$ | $\text{Hz}$ ($\text{spikes/s}$) | $\text{Hz}$ | $f\ [\text{Hz}] = 1000 / T_{\text{ISI}}\ [\text{ms}]$ |
| **Phase Angle** | $\theta, \phi$ | $\text{rad}$ | $\text{rad}$ | $\theta \in [-\pi, \pi)$ or $[0, 2\pi)$ |
| **Temperature** | $T$ | $^\circ\text{C}$ or $\text{K}$ | $^\circ\text{C}$ or $\text{K}$ | $T\ [\text{K}] = T\ [^\circ\text{C}] + 273.15$ |
| **Gating / Probability / Weight** | $m, h, n, u, x, w$ | `dimensionless` | `dimensionless` | Bounded in $[0, 1]$ or $[w_{\min}, w_{\max}]$ |

> [!TIP]
> **Dimensional Consistency Identity:** In both canonical systems, $\frac{C_m dV}{dt}$ has identical numerical units to $g (V - E)$ and $I_{\text{ext}}$ **without** any intermediate $10^3$ multiplier:
> - Specific: $(\mu\text{F/cm}^2) \cdot (\text{mV/ms}) = \mu\text{A/cm}^2 = (\text{mS/cm}^2) \cdot \text{mV}$
> - Point-neuron: $\text{pF} \cdot (\text{mV/ms}) = \text{pA} = \text{nS} \cdot \text{mV}$

---

## 3. Sign Conventions (Mandatory Invariant)

1. **Membrane Potential ($V_m$):** Defined as intracellular potential minus extracellular reference potential ($V_m = \Phi_{\text{in}} - \Phi_{\text{out}}$), with resting potential negative (e.g., $-65\text{ mV}$). *Modern physiological convention* is used universally in CORTEXIA (not Hodgkin & Huxley's original 1952 inverted voltage scale).
2. **Transmembrane Ionic Current ($I_{\text{ion}}$):** Outward positive current is positive ($I_{\text{ion}} = g_{\text{ion}}(V - E_{\text{ion}})$). Therefore:
   - Depolarizing inward $Na^+$ or $Ca^{2+}$ flux corresponds to $V < E_{\text{Na}} \implies I_{\text{Na}} < 0$.
   - Repolarizing outward $K^+$ flux corresponds to $V > E_{\text{K}} \implies I_{\text{K}} > 0$.
3. **Injected Electrode Current ($I_{\text{ext}}$):** Depolarizing inward electrode current injected into the cell is **positive** ($I_{\text{ext}} > 0$).
4. **Master Membrane Current Balance Equation:**
   $$C_m \frac{dV}{dt} = I_{\text{ext}}(t) - \sum_{k} I_{\text{ion}, k}(V, t) - \sum_{s} I_{\text{syn}, s}(V, t)$$
   where $I_{\text{syn}, s}(V, t) = g_{\text{syn}, s}(t)\,(V - E_{\text{syn}, s})$ (so an excitatory synapse with $E_{\text{syn}} = 0\text{ mV}$ at $V = -65\text{ mV}$ yields $I_{\text{syn}} < 0$, which when subtracted as $-I_{\text{syn}}$ depolarizes $\frac{dV}{dt} > 0$).

---

## 4. Numerical Precision & Reproducibility Standards

- **Floating-Point Representation:** All ODE state vectors, gating variables, and accumulates in TypeScript/WASM kernels MUST use IEEE 754 **double-precision (`Float64Array` / `number`)**. Down-casting to `Float32Array` is permitted only for WebGL vertex/color buffers after integration completes.
- **Singularities ($0/0$ Removable Indeterminacies):** Hodgkin–Huxley rate functions containing $\frac{x}{\exp(x) - 1}$ MUST evaluate via Taylor expansion ($1 - \frac{x}{2} + \frac{x^2}{12}$) whenever $|x| < 10^{-7}$ (`exprel` helper) to prevent `NaN` spikes near transition voltages.
- **Deterministic PRNG:** Stochastic simulations MUST use a seeded deterministic generator (`Mulberry32` or `xoshiro128**` with Box–Muller normal variates) so any `randomSeed` reproduces bit-identical trajectories across runs.

## 5. Acceptance Criteria & References

- **AC-MOD-002:** Every equation in `registries/equations/equations.json` and parameter in `registries/parameters/parameters.json` conforms to Section 2 units and Section 3 sign conventions.
- `REF-HH-1952`: Hodgkin & Huxley (1952), DOI: `10.1113/jphysiol.1952.sp004764`.
- `REF-DAYAN-2001`: Dayan & Abbott (2001), *Theoretical Neuroscience*.
- `REF-GERSTNER-2014`: Gerstner et al. (2014), *Neuronal Dynamics*, DOI: `10.1017/CBO9781107447615`.
