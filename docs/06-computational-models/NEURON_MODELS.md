# Single-Neuron & Dendritic Model Specifications — CORTEXIA

**Document ID:** `DOC-MOD-004`  
**Module:** `MOD-08` (Computational Neuroscience Laboratory)  
**Models Covered:** `MODEL-001` through `MODEL-010`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document provides complete, implementation-ready mathematical specifications for CORTEXIA's ten single-neuron and dendritic models (`MODEL-001`–`MODEL-010`), covering all 22 required specification elements per model.

---

## 2. `MODEL-001` — Hodgkin–Huxley Conductance-Based Model (`FAM-01`)

1. **Identity & Scale:** `MODEL-001` · Family `FAM-01` · Scales `L1`–`L3`.
2. **Scientific Purpose:** Quantify how voltage-gated $Na^+$ activation/inactivation and $K^+$ activation generate all-or-none action potentials, refractory periods, and Type II repetitive firing.
3. **Biological Interpretation:** Space-clamped patch of *Loligo* squid giant axon membrane (`REF-HH-1952`) converted to modern physiological sign conventions ($V_{\text{rest}} = -65\text{ mV}$).
4. **Governing Equations (`EQ-HH-MEMBRANE`, `EQ-HH-CURRENTS`, `EQ-HH-GATING`, `EQ-HH-RATES`):**
   $$C_m \frac{dV}{dt} = I_{\text{ext}}(t) - \bar{g}_{\text{Na}} m^3 h (V - E_{\text{Na}}) - \bar{g}_{\text{K}} n^4 (V - E_{\text{K}}) - \bar{g}_{\text{L}} (V - E_{\text{L}})$$
   $$\frac{dx}{dt} = \phi_T \left[\alpha_x(V)(1 - x) - \beta_x(V)x\right] = \phi_T \frac{x_\infty(V) - x}{\tau_x(V)}, \qquad x \in \{m, h, n\}$$
   where temperature factor $\phi_T = Q_{10}^{(T - 6.3)/10}$ ($Q_{10} = 3.0$, $T_0 = 6.3\ ^\circ\text{C} \implies \phi_T = 1.0$) and rate functions ($\text{ms}^{-1}$, $V$ in $\text{mV}$):
   $$\alpha_m(V) = \frac{0.1(V + 40)}{1 - \exp\!\left(-\frac{V + 40}{10}\right)}, \qquad \beta_m(V) = 4.0 \exp\!\left(-\frac{V + 65}{18}\right)$$
   $$\alpha_h(V) = 0.07 \exp\!\left(-\frac{V + 65}{20}\right), \qquad \beta_h(V) = \frac{1}{1 + \exp\!\left(-\frac{V + 35}{10}\right)}$$
   $$\alpha_n(V) = \frac{0.01(V + 55)}{1 - \exp\!\left(-\frac{V + 55}{10}\right)}, \qquad \beta_n(V) = 0.125 \exp\!\left(-\frac{V + 65}{80}\right)$$
5. **Variables & Units:** $V(t)$ [$\text{mV}$], $m(t), h(t), n(t) \in [0, 1]$ [`dimensionless`], $I_{\text{Na}}, I_{\text{K}}, I_{\text{L}}, I_{\text{ext}}$ [$\mu\text{A/cm}^2$].
6. **Default Parameters & Provenance (`REF-HH-1952`, `REF-DAYAN-2001`):**
   - $C_m = 1.0\ \mu\text{F/cm}^2$, $\bar{g}_{\text{Na}} = 120.0\text{ mS/cm}^2$, $\bar{g}_{\text{K}} = 36.0\text{ mS/cm}^2$, $\bar{g}_{\text{L}} = 0.3\text{ mS/cm}^2$
   - $E_{\text{Na}} = +50.0\text{ mV}$, $E_{\text{K}} = -77.0\text{ mV}$, $E_{\text{L}} = -54.387\text{ mV}$, $T = 6.3\ ^\circ\text{C}$
7. **Initial Conditions:** Equilibrium at $V_0 = -65.0\text{ mV}$: $m_0 = m_\infty(-65) \approx 0.05293$, $h_0 = h_\infty(-65) \approx 0.59612$, $n_0 = n_\infty(-65) \approx 0.31768$.
8. **Numerical Method & Step:** `SOLVER-RK4` or `SOLVER-RUSH-LARSEN`; default `dt = 0.01 ms` (range `0.001 – 0.025 ms`). Removable singularities at $V = -40\text{ mV}$ ($\alpha_m$) and $V = -55\text{ mV}$ ($\alpha_n$) guarded via Taylor expansion.
9. **Expected Outputs & Visualization:** $V(t)$ trace, gating traces $(m, h, n)$, ionic currents $(I_{\text{Na}}, I_{\text{K}}, I_{\text{L}})$,conductances $(g_{\text{Na}}, g_{\text{K}})$, $(V, n)$ projection, $f\text{–}I$ curve (`EXP-HH-EXCITABILITY`, `EXP-HH-REFRACTORY`, `EXP-HH-ANODAL-BREAK`).
10. **Assumptions, Validity & Limitations:** Assumes isopotential membrane patch, independent gating particles, Ohmic open-channel current, and constant intra/extracellular ion concentrations. Does not capture dendritic geometry, $Ca^{2+}$-activated $K^+$ channels, or mammalian $37\ ^\circ\text{C}$ channel kinetics without isoform substitution.
11. **Verification:** Resting stability $|V(t) - (-65)| < 10^{-4}\text{ mV}$ for $I_{\text{ext}}=0$; single spike peak $V_{\max} \in [+30, +42]\text{ mV}$ under brief $10\ \mu\text{A/cm}^2$ pulse; sustained repetitive spiking for $I_{\text{ext}} = 10\ \mu\text{A/cm}^2$ (`VAL-HH-001`).

---

## 3. `MODEL-002` — Morris–Lecar Conductance Model (`FAM-02`)

- **Purpose & Interpretation:** Two-variable conductance-based model of barnacle giant muscle fiber ($Ca^{2+}$ inward + $K^+$ outward + leak, `REF-MORRIS-LECAR-1981`) demonstrating both **Type I (SNIC)** and **Type II (Hopf)** excitability via parameter regimes.
- **Governing Equations (`EQ-ML-MEMBRANE`, `EQ-ML-STEADY`):**
  $$C_m \frac{dV}{dt} = I_{\text{ext}} - \bar{g}_{\text{Ca}} M_\infty(V)(V - E_{\text{Ca}}) - \bar{g}_{\text{K}} W (V - E_{\text{K}}) - \bar{g}_{\text{L}} (V - E_{\text{L}})$$
  $$\frac{dW}{dt} = \phi \frac{W_\infty(V) - W}{\tau_W(V)}$$
  $$M_\infty(V) = \frac{1}{2}\!\left[1 + \tanh\!\left(\frac{V - V_1}{V_2}\right)\right], \quad W_\infty(V) = \frac{1}{2}\!\left[1 + \tanh\!\left(\frac{V - V_3}{V_4}\right)\right], \quad \tau_W(V) = \frac{1}{\cosh\!\left(\frac{V - V_3}{2V_4}\right)}$$
- **Default Parameters (Hopf Type II Regime, `REF-MORRIS-LECAR-1981`, `REF-GERSTNER-2014`):** $C_m = 20\ \mu\text{F/cm}^2$, $\bar{g}_{\text{Ca}} = 4.4\text{ mS/cm}^2$, $\bar{g}_{\text{K}} = 8.0\text{ mS/cm}^2$, $\bar{g}_{\text{L}} = 2.0\text{ mS/cm}^2$, $E_{\text{Ca}} = 120\text{ mV}$, $E_{\text{K}} = -84\text{ mV}$, $E_{\text{L}} = -60\text{ mV}$, $V_1 = -1.2\text{ mV}$, $V_2 = 18\text{ mV}$, $V_3 = 2\text{ mV}$, $V_4 = 30\text{ mV}$, $\phi = 0.04\text{ ms}^{-1}$. (SNIC Type I preset sets $\bar{g}_{\text{Ca}} = 4.0, V_3 = 12, V_4 = 17.4, \phi = 0.0667$).
- **Solver & Validation:** `SOLVER-RK4` (`dt = 0.05 ms`); interactive $(V, W)$ phase-plane with cubic $V$-nullcline and sigmoidal $W$-nullcline (`VAL-ML-001`).

---

## 4. `MODEL-003` — Connor–Stevens Transient $K^+$ ($I_A$) Model (`FAM-01`)

- **Purpose:** Extends Hodgkin–Huxley with a fast inactivating A-type potassium current $I_A = \bar{g}_A a^3 b (V - E_A)$ explaining how Type I continuous low-frequency firing emerges in crustacean/mammalian axons (`REF-DAYAN-2001`).
- **Equations (`EQ-CS-IA`):** Adds state variables $a(t), b(t) \in [0, 1]$ with $\bar{g}_A = 47.7\text{ mS/cm}^2, E_A = -75\text{ mV}$. Solved via `SOLVER-RK4` (`dt = 0.01 ms`).

---

## 5. `MODEL-004` — FitzHugh–Nagumo Reduced Phase-Plane Model (`FAM-03`)

- **Purpose & Background:** 2D polynomial reduction of excitable dynamics (`REF-FITZHUGH-1961`, `REF-NAGUMO-1962`) isolating fast regenerative voltage $v$ and slow recovery $w$.
- **Governing Equations (`EQ-FHN-SYSTEM`):**
  $$\frac{dv}{dt} = v - \frac{v^3}{3} - w + I_{\text{ext}}, \qquad \frac{dw}{dt} = \epsilon (v + a - b w)$$
- **Parameters & Units:** Dimensionless state variables $v, w$, time $t$ (scaled ms), defaults $a = 0.7$, $b = 0.8$, $\epsilon = 0.08$, $I_{\text{ext}} \in [0, 1.5]$.
- **Phase-Plane Geometry:** Nullclines $w = v - \frac{v^3}{3} + I_{\text{ext}}$ and $w = \frac{v + a}{b}$; Hopf bifurcation at $|v_*| = \sqrt{1 - \epsilon b}$ (`SOLVER-RK4`, `dt = 0.05`).

---

## 6. `MODEL-005` & `MODEL-006` — Leaky Integrate-and-Fire (`CUBA-LIF` & `COBA-LIF`, `FAM-04`)

- **Governing Equations (`EQ-LIF-CUBA`, `EQ-LIF-COBA`, `REF-ABBOTT-1999`, `REF-GERSTNER-2014`):**
  - `MODEL-005` (`CUBA-LIF`):
    $$\tau_m \frac{dV}{dt} = -(V - E_{\text{L}}) + R_m I_{\text{ext}}(t)$$
  - `MODEL-006` (`COBA-LIF`):
    $$C_m \frac{dV}{dt} = -g_{\text{L}}(V - E_{\text{L}}) - g_{\text{E}}(t)(V - E_{\text{E}}) - g_{\text{I}}(t)(V - E_{\text{I}}) + I_{\text{ext}}(t)$$
  - **Reset Condition:** When $V(t) \ge V_{\text{th}}$, emit spike at $t_{\text{sp}}$, set $V \leftarrow V_{\text{reset}}$, and clamp for $\tau_{\text{ref}}$.
  - **Analytical Steady Firing Rate (`EQ-LIF-FI`):** For constant suprathreshold $I_{\text{ext}} > I_{\text{rh}} = \frac{V_{\text{th}} - E_{\text{L}}}{R_m}$:
    $$f(I_{\text{ext}}) = \left[\tau_{\text{ref}} + \tau_m \ln\!\left(\frac{R_m I_{\text{ext}} + E_{\text{L}} - V_{\text{reset}}}{R_m I_{\text{ext}} + E_{\text{L}} - V_{\text{th}}}\right)\right]^{-1}$$
- **Defaults:** $C_m = 200\text{ pF}$, $g_{\text{L}} = 10\text{ nS}$ ($\tau_m = 20\text{ ms}$, $R_m = 100\text{ M}\Omega$), $E_{\text{L}} = -70\text{ mV}$, $V_{\text{th}} = -50\text{ mV}$, $V_{\text{reset}} = -65\text{ mV}$, $\tau_{\text{ref}} = 2.0\text{ ms}$.
- **Validation:** Numerical firing rate matches closed-form `EQ-LIF-FI` to within `< 0.1%` (`VAL-LIF-001`).

---

## 7. `MODEL-007` — Quadratic Integrate-and-Fire (`QIF`, `FAM-04`)

- **Governing Equation (`EQ-QIF`):** Normal form of Type I SNIC excitability:
  $$\tau_m \frac{dV}{dt} = a_0 (V - V_{\text{rest}})(V - V_{\text{c}}) + R_m I_{\text{ext}}(t), \qquad \text{if } V \ge V_{\text{peak}} \implies V \leftarrow V_{\text{reset}}$$
- **Defaults:** $\tau_m = 20\text{ ms}$, $V_{\text{rest}} = -65\text{ mV}$, $V_{\text{c}} = -55\text{ mV}$, $a_0 = 0.08\text{ mV}^{-1}$, $V_{\text{peak}} = +30\text{ mV}$, $V_{\text{reset}} = -65\text{ mV}$ (`SOLVER-HYBRID-SPIKE`, `dt = 0.05 ms`).

---

## 8. `MODEL-008` — Adaptive Exponential Integrate-and-Fire (`AdEx`, `FAM-05`)

- **Purpose & Provenance:** Captures both fast exponential $Na^+$ spike initiation ($\Delta_T$) and subthreshold/spike-triggered adaptation $w$ (`REF-BRETTE-GERSTNER-2005`).
- **Governing Equations (`EQ-ADEX-MEMBRANE`, `EQ-ADEX-ADAPT`):**
  $$C_m \frac{dV}{dt} = -g_{\text{L}}(V - E_{\text{L}}) + g_{\text{L}} \Delta_T \exp\!\left(\frac{V - V_T}{\Delta_T}\right) - w + I_{\text{ext}}(t)$$
  $$\tau_w \frac{dw}{dt} = a(V - E_{\text{L}}) - w$$
  $$\text{If } V \ge V_{\text{peak}} \ (0\text{ mV}): \quad V \leftarrow V_{\text{reset}}, \quad w \leftarrow w + b$$
- **Defaults (Regular Spiking Cortical Pyramidal):** $C_m = 281\text{ pF}$, $g_{\text{L}} = 30\text{ nS}$, $E_{\text{L}} = -70.6\text{ mV}$, $V_T = -50.4\text{ mV}$, $\Delta_T = 2.0\text{ mV}$, $\tau_w = 144\text{ ms}$, $a = 4.0\text{ nS}$, $b = 80.5\text{ pA}$, $V_{\text{reset}} = -70.6\text{ mV}$.
- **Solver Guardrail:** Exponential term capped at $\frac{V - V_T}{\Delta_T} \le 20$ before reset check (`SOLVER-HYBRID-SPIKE`, `dt = 0.05 ms`).

---

## 9. `MODEL-009` — Izhikevich Phenomenological Spiking Model (`FAM-05`)

- **Purpose & Provenance:** Computationally lightweight 2-variable system reproducing >15 cortical/thalamic firing patterns (`REF-IZHIKEVICH-2003`).
- **Governing Equations (`EQ-IZHIKEVICH`):**
  $$\frac{dv}{dt} = 0.04 v^2 + 5 v + 140 - u + I_{\text{ext}}(t), \qquad \frac{du}{dt} = a(b v - u)$$
  $$\text{If } v \ge 30\text{ mV}: \quad v \leftarrow c, \quad u \leftarrow u + d$$
- **Canonical Presets:**
  - *Regular Spiking (`RS`):* $a=0.02, b=0.2, c=-65, d=8$
  - *Intrinsically Bursting (`IB`):* $a=0.02, b=0.2, c=-55, d=4$
  - *Chattering (`CH`):* $a=0.02, b=0.2, c=-50, d=2$
  - *Fast Spiking (`FS`):* $a=0.1, b=0.2, c=-65, d=2$
  - *Low-Threshold Spiking (`LTS`):* $a=0.02, b=0.25, c=-65, d=2$
- **Limitations:** Phenomenological polynomial scaling (`0.04 v^2`); variables $u$ and $I$ do not map directly to specific physical conductances (`nS`), which MUST be disclosed in Panel 5.

---

## 10. `MODEL-010` — Passive Cable & Multi-Compartment Rall Dendritic Model (`FAM-06`)

- **Purpose & Provenance:** Models spatial electrotonic attenuation, temporal filtering, and Rall $d_{\text{parent}}^{3/2} = \sum d_{\text{child}}^{3/2}$ equivalent cylinder branching (`REF-RALL-1962`).
- **Governing PDE & Discrete Compartmental ODE (`EQ-CABLE-PDE`, `EQ-CABLE-COMP`):**
  $$\tau_m \frac{\partial V}{\partial t} = \lambda^2 \frac{\partial^2 V}{\partial x^2} - (V - E_{\text{L}}) + r_m i_{\text{ext}}(x, t)$$
  $$C_k \frac{dV_k}{dt} = -g_{\text{L}, k}(V_k - E_{\text{L}}) + \sum_{j \in \mathcal{N}(k)} g_{k,j}(V_j - V_k) + I_{\text{syn}, k}(t)$$
- **Boundary Conditions:** Sealed-end Neumann condition $\left.\frac{\partial V}{\partial x}\right|_{x=0, L} = 0$.
- **Solver & Validation:** `SOLVER-CRANK-NICOLSON` or `SOLVER-RK4` (`N = 5` to `50` compartments); steady-state infinite-cable decay matches $V(x) = V_0 e^{-x/\lambda}$ (`VAL-CABLE-001`).

## 11. Acceptance Criteria & Related Documents

- **AC-MOD-004:** Every model `MODEL-001`–`MODEL-010` exposes its exact equations, default parameters, units, solver rules, and validation checks in `MOD-08` and UCES.
- **Links:** [SYNAPTIC_MODELS.md](SYNAPTIC_MODELS.md), [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
