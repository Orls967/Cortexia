# Computational Model Validation Specification — CORTEXIA

**Document ID:** `DOC-MOD-010`  
**Module:** `MOD-08`, `MOD-12`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the scientific, mathematical, and numerical validation framework for all 28 computational models in CORTEXIA, specifying canonical validation cases (`VAL-*`), error metrics, tolerances, convergence protocols, and sensitivity analysis standards.

## 2. Four-Tier Model Validation Hierarchy

1. **Dimensional & Unit Audit:** Verify every equation term has identical physical units (`mV/ms`, `pA`, `µA/cm²`, `dimensionless`).
2. **Analytical Exact-Solution Benchmark:** Where closed-form solutions exist (passive cable decay, `CUBA-LIF` $f\text{–}I$ curve, exponential synaptic kernel, STDP window, Oja eigenvector, Kuramoto critical threshold), verify numerical output against analytical truth.
3. **Numerical Step-Convergence Audit:** Verify empirical convergence order $p$ across step sequence $h \in \{0.04, 0.02, 0.01, 0.005\}\text{ ms}$ against `RK4` reference at $h_{\text{ref}} = 10^{-4}\text{ ms}$.
4. **Canonical Physiological Regime Reproduction:** Verify qualitative dynamical transitions (rheobase, refractory block, anodal break excitation, Hopf limit cycle, Brunel `AI` vs `SR` state, dopamine RPE shift).

---

## 3. Authoritative Validation Case Matrix (`VAL-*`)

| Validation ID | Target Model(s) | Reference Condition | Quantitative Acceptance Metric | Source Reference |
|---|---|---|---|---|
| `VAL-HH-001` | `MODEL-001` (`HH`) | Resting clamp $I_{\text{ext}} = 0\ \mu\text{A/cm}^2$ for $100\text{ ms}$ | $\max_t |V(t) - (-65.0)| < 0.01\text{ mV}$; $m,h,n$ stay within $10^{-5}$ of steady state | `REF-HH-1952` |
| `VAL-HH-002` | `MODEL-001` (`HH`) | Step current $I_{\text{ext}} = 10.0\ \mu\text{A/cm}^2$ ($50\text{ ms}$, `RK4`, `dt=0.01 ms`) | Action potential peak $V_{\max} \in [+30, +42]\text{ mV}$; steady firing frequency $f \in [65, 78]\text{ Hz}$ | `REF-HH-1952`, `REF-GERSTNER-2014` |
| `VAL-HH-003` | `MODEL-001` (`HH`) | Paired pulse during absolute refractory period ($\Delta t = 1.2\text{ ms}$) | Second pulse fails to evoke suprathreshold upstroke ($\frac{dV}{dt}$ peak suppressed $>80\%$) | `REF-HH-1952` |
| `VAL-ML-001` | `MODEL-002` (`ML`) | Type I (SNIC) vs Type II (Hopf) parameter sets | Type I continuous onset near $0\text{ Hz}$; Type II discontinuous jump to $>15\text{ Hz}$ | `REF-MORRIS-LECAR-1981` |
| `VAL-FHN-001` | `MODEL-004` (`FHN`) | $I_{\text{ext}} = 0$ vs $I_{\text{ext}} = 0.5$ ($a=0.7, b=0.8, \epsilon=0.08$) | Stable fixed point at $I_{\text{ext}}=0$; stable limit cycle oscillation at $I_{\text{ext}}=0.5$ | `REF-FITZHUGH-1961` |
| `VAL-LIF-001` | `MODEL-005` (`LIF`) | Suprathreshold steps $I_{\text{ext}} \in [250, 600]\text{ pA}$ | Simulated $f(I)$ matches analytical `EQ-LIF-FI` within relative error $< 0.2\%$ | `REF-DAYAN-2001` |
| `VAL-ADEX-001` | `MODEL-008` (`AdEx`) | Regular Spiking (`b=80.5 pA`) step current $I_{\text{ext}}=500\text{ pA}$ | Monotonically increasing $ISI_1 < ISI_2 < \dots < ISI_{\infty}$ (adaptation ratio $>1.8$) | `REF-BRETTE-GERSTNER-2005` |
| `VAL-IZH-001` | `MODEL-009` (`Izh`) | Canonical `RS`, `IB`, `CH`, `FS` presets | Reproduces distinct spike/burst signatures matching Izhikevich (2003) Fig. 2 | `REF-IZHIKEVICH-2003` |
| `VAL-CABLE-001` | `MODEL-010` (`Cable`) | Steady current injection at $x=0$ in passive cable | Spatial decay matches $V(x)/V(0) = \cosh((L-x)/\lambda)/\cosh(L/\lambda)$ within $< 0.5\%$ | `REF-RALL-1962` |
| `VAL-SYN-001` | `MODEL-012`–`014` | Single spike at $t_0=10\text{ ms}$; NMDA voltage clamp sweep $V \in [-80, +40]\text{ mV}$ | Alpha peaks at $t_0+\tau_\alpha$; NMDA $I\text{–}V$ curve exhibits negative slope conductance below $-30\text{ mV}$ | `REF-DESTEXHE-1994`, `REF-TRAYNELIS-2010` |
| `VAL-STP-001` | `MODEL-016` (`STP`) | $20\text{ Hz}$ train (`10` spikes) under STD vs STF presets | STD shows monotonic amplitude decay; STF shows transient facilitation $>150\%$ of spike 1 | `REF-TSODYKS-1997` |
| `VAL-WC-001` | `MODEL-017` (`WC`) | Limit cycle ($P=1.25$) vs Bistable preset | Nullcline intersections & Jacobian trace/determinant match observed trajectory stability | `REF-WILSON-COWAN-1972` |
| `VAL-JR-001` | `MODEL-018` (`JR`) | Standard $C=135$, $p(t) \sim \mathcal{N}(220, 22^2)\text{ Hz}$ | Output $y_1 - y_2$ Welch PSD peaks in alpha band (`8–12 Hz`) | `REF-JANSEN-RIT-1995` |
| `VAL-BRUNEL-001`| `MODEL-021` (`SNN`) | `AI` ($g=5, \eta=2$) vs `SR` ($g=3, \eta=2$) | `AI` yields mean $CV_{\text{ISI}} \in [0.75, 1.15]$; `SR` yields $CV_{\text{ISI}} < 0.25$ | `REF-BRUNEL-2000` |
| `VAL-STDP-001` | `MODEL-024` (`STDP`) | 60 spike pairs swept across $\Delta t \in [-100, +100]\text{ ms}$ | Matches analytical exponential curve `EQ-STDP-WINDOW` to $< 10^{-6}$ | `REF-BI-POO-1998` |
| `VAL-OJA-001` | `MODEL-023` (`Oja`) | 2D correlated Gaussian stream ($2,000$ steps) | Weight vector norm $\|\mathbf{w}\|_2 \to 1.0 \pm 0.02$; angle to $\mathbf{e}_1(\mathbf{C}_{xx}) < 3^\circ$ | `REF-OJA-1982` |
| `VAL-TDRL-001` | `MODEL-026` (`TDRL`) | Pavlovian CS–US conditioning + omission probe | $\delta_t$ transfers from US to CS and dips negative on US omission | `REF-SCHULTZ-1997` |
| `VAL-KURAMOTO-001`| `MODEL-027` | Coupling sweep $K \in [0.5 K_c, 3 K_c]$ | Order parameter $R$ transitions from $O(N^{-1/2})$ below $K_c$ to $\sqrt{1 - K_c/K}$ above $K_c$ | `REF-KURAMOTO-1984` |
| `VAL-GRAPH-001` | `MODEL-028` | Complete graph $K_{10}$, Ring $R_{10,4}$, Two-clique modular graph | $C(K_{10})=1, L(K_{10})=1$; modularity $Q > 0.35$ on two-clique benchmark | `REF-RUBINOV-2010`, `REF-NEWMAN-2006` |

---

## 4. Sensitivity Analysis Protocol

Each model in `MOD-08` supports local one-at-a-time (`OAT`) normalized sensitivity index computation:
$$S_{p_k}^{M} = \frac{p_{k, 0}}{M(\mathbf{p}_0)} \cdot \frac{M(p_{k, 0} + \Delta p_k) - M(p_{k, 0} - \Delta p_k)}{2 \Delta p_k}$$
where $M$ is an output metric (e.g., firing rate, spike amplitude, oscillation frequency) and $\Delta p_k = 0.05\,p_{k, 0}$.

## 5. Acceptance Criteria & Related Documents

- **AC-MOD-010:** Every model in `scientific-models.json` references at least one `VAL-*` case with explicit pass/fail bounds.
- **Links:** [MODEL_CATALOG.md](MODEL_CATALOG.md), [NUMERICAL_METHODS.md](NUMERICAL_METHODS.md), [SCIENTIFIC_AND_NUMERICAL_QA.md](../14-quality-and-validation/SCIENTIFIC_AND_NUMERICAL_QA.md).
