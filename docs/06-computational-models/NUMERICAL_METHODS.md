# Numerical Methods & Solver Specifications — CORTEXIA

**Document ID:** `DOC-MOD-003`  
**Module:** `MOD-08` (Computational Neuroscience Laboratory)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies the numerical integration algorithms, stability conditions, accuracy orders, time-step constraints, event-handling rules, and convergence testing protocols governing CORTEXIA's simulation runtime.

## 2. Solver Catalog & Model Pairing Policy

CORTEXIA prohibits forcing a single naive solver onto all models. Solvers are matched to dynamical stiffness, discontinuity (spike reset), and stochasticity:

| Solver ID | Method Name | Order | Target Model Classes | Recommended `dt` |
|---|---|---|---|---|
| `SOLVER-FE` | Explicit Forward Euler | $O(h)$ | Educational comparison baseline; simple rate rules | `0.005 – 0.1 ms` |
| `SOLVER-RUSH-LARSEN` | Rush–Larsen Exponential Euler + Midpoint Voltage | $O(h)$–$O(h^2)$ | Stiff Hodgkin–Huxley & Markov gating variables $m, h, n$ | `0.01 – 0.05 ms` |
| `SOLVER-RK4` | Classical 4th-Order Runge–Kutta | $O(h^4)$ | Hodgkin–Huxley, Morris–Lecar, FitzHugh–Nagumo, Wilson–Cowan, Jansen–Rit, Kuramoto | `0.01 – 0.5 ms` |
| `SOLVER-RK45` | Dormand–Prince Adaptive `RK4(5)` | $O(h^5)$ local | Stiff single-cell bursts, multi-timescale slow-fast bifurcations | Adaptive `atol=1e-6, rtol=1e-5` |
| `SOLVER-EXACT-LIF` | Exact Linear Subthreshold + Linear Spike Interpolation | Exact linear | `CUBA-LIF` with exponential synaptic currents | `0.05 – 0.2 ms` |
| `SOLVER-HYBRID-SPIKE` | Sub-stepped `RK4`/`RK2` with Threshold Crossing & Refractory Clamp | $O(h^2)$–$O(h^4)$ | `COBA-LIF`, `AdEx`, `Izhikevich`, Spiking Networks (`SNN`) | `0.05 – 0.1 ms` |
| `SOLVER-EULER-MARUYAMA` | Euler–Maruyama Stochastic Integrator | Strong $O(h^{1/2})$, Weak $O(h)$ | Ornstein–Uhlenbeck background noise, Wong–Wang decision SDE, noisy Kuramoto | `0.05 – 0.5 ms` |
| `SOLVER-CRANK-NICOLSON` | Implicit Crank–Nicolson Tridiagonal (`Thomas Algorithm`) | $O(\Delta t^2, \Delta x^2)$ | Passive & active multi-compartment Rall cable PDE (`MODEL-010`) | `0.02 – 0.1 ms` |

---

## 3. Mathematical Formulations of Core Solvers

### 3.1 Classical Fourth-Order Runge–Kutta (`SOLVER-RK4`, `EQ-SOLVER-RK4`)
For autonomous/non-autonomous ODE system $\frac{d\mathbf{y}}{dt} = \mathbf{f}(t, \mathbf{y})$ with step $h = \Delta t$:
$$\begin{aligned}
\mathbf{k}_1 &= \mathbf{f}(t_n, \mathbf{y}_n) \\
\mathbf{k}_2 &= \mathbf{f}\!\left(t_n + \tfrac{h}{2}, \mathbf{y}_n + \tfrac{h}{2}\mathbf{k}_1\right) \\
\mathbf{k}_3 &= \mathbf{f}\!\left(t_n + \tfrac{h}{2}, \mathbf{y}_n + \tfrac{h}{2}\mathbf{k}_2\right) \\
\mathbf{k}_4 &= \mathbf{f}(t_n + h, \mathbf{y}_n + h\mathbf{k}_3) \\
\mathbf{y}_{n+1} &= \mathbf{y}_n + \frac{h}{6}\left(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4\right)
\end{aligned}$$
- **Stability:** Absolute stability region along negative real axis extends to $h\lambda \in [-2.785, 0]$. For Hodgkin–Huxley at peak sodium conductance ($g_{\text{Na}} = 120\text{ mS/cm}^2, C_m = 1\ \mu\text{F/cm}^2$, fastest gating timescale $\tau_m \approx 0.05\text{ ms}$), $h \le 0.025\text{ ms}$ is required; default `dt = 0.01 ms`.

### 3.2 Rush–Larsen Exponential Integrator for Gating Variables (`SOLVER-RUSH-LARSEN`, `EQ-SOLVER-RL`)
Because gating variables $x \in \{m, h, n\}$ obey linear-in-$x$ kinetics $\frac{dx}{dt} = \frac{x_\infty(V) - x}{\tau_x(V)}$ when $V$ is held fixed over $[t_n, t_n+h]$:
$$x_{n+1} = x_\infty(V_n) + \left(x_n - x_\infty(V_n)\right) \exp\!\left(-\frac{h}{\tau_x(V_n)}\right)$$
- **Advantage:** Unconditionally preserves $x_{n+1} \in [0, 1]$ without oscillatory overshoot even when $\tau_m(V) \ll h$.

### 3.3 Euler–Maruyama for Stochastic Differential Equations (`SOLVER-EULER-MARUYAMA`, `EQ-SOLVER-EM`)
For an Itô SDE $d\mathbf{y} = \mathbf{f}(t, \mathbf{y})\,dt + \mathbf{G}(t, \mathbf{y})\,d\mathbf{W}_t$:
$$\mathbf{y}_{n+1} = \mathbf{y}_n + \mathbf{f}(t_n, \mathbf{y}_n)\,h + \mathbf{G}(t_n, \mathbf{y}_n)\,\sqrt{h}\,\boldsymbol{\xi}_n, \qquad \boldsymbol{\xi}_n \sim \mathcal{N}(\mathbf{0}, \mathbf{I})$$

### 3.4 Hybrid Spike-Event & Refractory Handling (`SOLVER-HYBRID-SPIKE`)
In integrate-and-fire models (`LIF`, `AdEx`, `Izhikevich`), discontinuous resets degrade fixed-step accuracy unless threshold crossing is interpolated:
1. If $V_n < V_{\text{peak}}$ and $V_{n+1} \ge V_{\text{peak}}$, estimate fractional spike time:
   $$t_{\text{spike}} = t_n + h\,\frac{V_{\text{peak}} - V_n}{V_{n+1} - V_n}$$
2. Emit spike event at $t_{\text{spike}}$ into axonal delay ring buffer; apply adaptation jump $w \leftarrow w + b$; clamp $V = V_{\text{reset}}$ for $t \in [t_{\text{spike}}, t_{\text{spike}} + \tau_{\text{ref}}]$.

---

## 4. Stability Guardrails & Divergence Detection

- **Pre-Flight Courant / Stiffness Check:** Before starting a worker job, validate `dt <= model.maxSafeDt`. If the user overrides `dt` in educational "Solver Instability Demo" mode, display an amber warning banner.
- **Runtime Divergence Trap:** At every step, check `Number.isFinite(V)`. If `NaN` or `|V| > 1e4` occurs, halt integration immediately, return partial trace up to $t_{\text{fail}}$, and surface structured error `ERR_NUMERICAL_DIVERGENCE` advising a smaller `dt` or `SOLVER-RK4`/`SOLVER-RUSH-LARSEN`.

## 5. Convergence & Benchmark Verification Protocol

Every deterministic solver MUST pass automated Vitest verification in Phase D:
1. **Self-Convergence Ratio Test:** Solve reference trajectory at $h, h/2, h/4$ against ultra-fine reference $h_{\text{ref}} = 10^{-4}\text{ ms}$; verify empirical order $p = \log_2 \frac{\|y_h - y_{h/2}\|_\infty}{\|y_{h/2} - y_{h/4}\|_\infty}$ matches theoretical order ($p \approx 1.0$ for Forward Euler, $p \approx 4.0$ for RK4).
2. **Analytical Decay Benchmark:** Passive RC membrane step response must match $V(t) = V_{\text{rest}} + R_m I_0 (1 - e^{-t/\tau_m})$ to within $< 10^{-9}\text{ mV}$ under `SOLVER-EXACT-LIF` and $< 10^{-6}\text{ mV}$ under `SOLVER-RK4` (`dt = 0.01 ms`).

## 6. Acceptance Criteria & Related Documents

- **AC-MOD-003:** All 8 solver algorithms are mathematically specified, paired to appropriate models, and backed by convergence acceptance gates in [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
- **Links:** [MATHEMATICAL_CONVENTIONS.md](MATHEMATICAL_CONVENTIONS.md), [NEURON_MODELS.md](NEURON_MODELS.md), [SIMULATION_AND_WORKER_ARCHITECTURE.md](../12-software-architecture/SIMULATION_AND_WORKER_ARCHITECTURE.md).
