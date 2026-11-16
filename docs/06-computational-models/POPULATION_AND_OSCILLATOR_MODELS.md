# Neural Population, Neural Mass & Oscillator Models — CORTEXIA

**Document ID:** `DOC-MOD-006`  
**Module:** `MOD-08` (Computational Neuroscience Laboratory)  
**Models Covered:** `MODEL-017`, `MODEL-018`, `MODEL-019`, `MODEL-027`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies CORTEXIA's mesoscopic and macroscopic population models (`MODEL-017`, `MODEL-018`, `MODEL-019`) and coupled phase-oscillator model (`MODEL-027`), defining mean-field equations, sigmoid transfer functions, phase-plane bifurcations, and synchronization order parameters.

---

## 2. `MODEL-017` — Wilson–Cowan Excitatory–Inhibitory Population Model (`FAM-10`)

1. **Identity & Provenance:** `MODEL-017` · Scales `L5`–`L6` · `REF-WILSON-COWAN-1972`.
2. **Biological Interpretation:** Coarse-grained fraction of active excitatory $E(t) \in [0, 1]$ and inhibitory $I(t) \in [0, 1]$ neurons in a localized cortical column or nucleus.
3. **Governing Equations (`EQ-WC-E`, `EQ-WC-I`, `EQ-WC-SIGMOID`):**
   $$\tau_E \frac{dE}{dt} = -E + (1 - r_E E)\,\mathcal{S}_E\!\left(w_{EE} E - w_{EI} I + P_{\text{ext}}(t)\right)$$
   $$\tau_I \frac{dI}{dt} = -I + (1 - r_I I)\,\mathcal{S}_I\!\left(w_{IE} E - w_{II} I + Q_{\text{ext}}(t)\right)$$
   $$\mathcal{S}_k(x) = \frac{1}{1 + \exp\!\left[-a_k(x - \theta_k)\right]} - \frac{1}{1 + \exp(a_k \theta_k)}, \qquad k \in \{E, I\}$$
4. **Default Parameters (Limit-Cycle Oscillation Regime, `REF-WILSON-COWAN-1972`):**
   - $\tau_E = 10.0\text{ ms}$, $\tau_I = 20.0\text{ ms}$, $r_E = 1.0$, $r_I = 1.0$
   - $w_{EE} = 16.0$, $w_{EI} = 12.0$, $w_{IE} = 15.0$, $w_{II} = 3.0$
   - $a_E = 1.3$, $\theta_E = 4.0$, $a_I = 2.0$, $\theta_I = 3.7$, $P_{\text{ext}} = 1.25$, $Q_{\text{ext}} = 0.0$
   - (Bistable Working-Memory Preset: $w_{EE}=12, w_{EI}=4, w_{IE}=13, w_{II}=11, P_{\text{ext}}=0$)
5. **Phase-Plane & Stability Analysis:** Nullclines $\frac{dE}{dt}=0, \frac{dI}{dt}=0$, Jacobian eigenvalues $\lambda_{1,2} = \frac{\text{Tr}(J) \pm \sqrt{\text{Tr}(J)^2 - 4\det(J)}}{2}$ identifying stable nodes, saddle points, and supercritical Hopf limit cycles (`SOLVER-RK4`, `dt = 0.1 ms`, `VAL-WC-001`).
6. **Limitations:** Assumes spatial homogeneity within a population and neglects individual spike timing synchronization.

---

## 3. `MODEL-018` — Jansen–Rit Cortical Column Neural Mass Model (`FAM-11`)

1. **Identity & Provenance:** `MODEL-018` · Scale `L6` · `REF-JANSEN-RIT-1995`.
2. **Biological Interpretation:** Three interacting subpopulations within a cortical macrocolumn—Pyramidal cells ($y_0$), Excitatory spiny stellate interneurons ($y_1$), and Inhibitory interneurons ($y_2$)—generating realistic EEG alpha (`8–12 Hz`) and visual evoked potentials.
3. **Governing 6-ODE System (`EQ-JR-ODE`, `EQ-JR-SIGMOID`):**
   Each second-order synaptic alpha kernel $h_e(t) = A a t e^{-at}\Theta(t)$ and $h_i(t) = B b t e^{-bt}\Theta(t)$ is written as two first-order ODEs ($k \in \{0, 1, 2\}$):
   $$\begin{aligned}
   \dot{y}_0 &= y_3, &\quad \dot{y}_3 &= A a\,\text{Sigm}(y_1 - y_2) - 2a y_3 - a^2 y_0 \\
   \dot{y}_1 &= y_4, &\quad \dot{y}_4 &= A a \left[p(t) + C_2\,\text{Sigm}(C_1 y_0)\right] - 2a y_4 - a^2 y_1 \\
   \dot{y}_2 &= y_5, &\quad \dot{y}_5 &= B b\,C_4\,\text{Sigm}(C_3 y_0) - 2b y_5 - b^2 y_2
   \end{aligned}$$
   $$\text{Sigm}(v) = \frac{2 e_0}{1 + \exp\!\left[r(v_0 - v)\right]}, \qquad V_{\text{EEG-proxy}}(t) = y_1(t) - y_2(t)$$
4. **Default Parameters (`REF-JANSEN-RIT-1995`):** $A = 3.25\text{ mV}$, $B = 22.0\text{ mV}$, $a = 100\text{ s}^{-1}$ ($0.1\text{ ms}^{-1}$), $b = 50\text{ s}^{-1}$ ($0.05\text{ ms}^{-1}$), $v_0 = 6.0\text{ mV}$, $e_0 = 2.5\text{ s}^{-1}$, $r = 0.56\text{ mV}^{-1}$, $C = 135$, $C_1 = C$, $C_2 = 0.8 C$, $C_3 = 0.25 C$, $C_4 = 0.25 C$, $p(t) \in [120, 320]\text{ Hz}$.
5. **Solver & Validation:** `SOLVER-RK4` (`dt = 0.5 ms`); verified ~`10 Hz` alpha peak in Welch PSD for $C = 135, p = 220\text{ Hz}$ (`VAL-JR-001`).

---

## 4. `MODEL-019` — Wong–Wang Two-Population Decision Attractor (`FAM-10`)

- **Purpose & Provenance:** Reduced two-variable NMDA-gating neural circuit model of perceptual two-alternative forced-choice (`2AFC`) decision-making and working memory (`L6`, `L9`; Wong & Wang 2006 / `REF-GERSTNER-2014`).
- **Governing SDEs (`EQ-WW-SDE`):**
  $$\frac{dS_1}{dt} = -\frac{S_1}{\tau_S} + (1 - S_1)\gamma H(x_1), \qquad \frac{dS_2}{dt} = -\frac{S_2}{\tau_S} + (1 - S_2)\gamma H(x_2)$$
  $$x_1 = J_{11} S_1 - J_{12} S_2 + I_0 + I_{\text{stim}, 1}(t) + I_{\text{noise}, 1}(t), \qquad H(x) = \frac{a x - b}{1 - \exp[-d(a x - b)]}$$
- **Defaults:** $\tau_S = 100\text{ ms}$, $\gamma = 0.641$, $J_{11} = J_{22} = 0.2609\text{ nA}$, $J_{12} = J_{21} = 0.0497\text{ nA}$, $I_0 = 0.3255\text{ nA}$, $a = 270\ (\text{V}\cdot\text{nC})^{-1}$, $b = 108\text{ Hz}$, $d = 0.154\text{ s}$ (`SOLVER-EULER-MARUYAMA`, `dt = 0.5 ms`).

---

## 5. `MODEL-027` — Kuramoto Coupled Phase Oscillator Network (`FAM-16`)

1. **Identity & Provenance:** `MODEL-027` · Scales `L6`, `L8` · `REF-KURAMOTO-1984`, `REF-BREAKSPEAR-2017`.
2. **Governing Equations (`EQ-KURAMOTO-PHASE`, `EQ-KURAMOTO-ORDER`):**
   $$\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N} \sum_{j=1}^{N} A_{ij} \sin\!\left(\theta_j(t - \tau_{ij}) - \theta_i(t)\right) + \sigma \xi_i(t)$$
   Complex Kuramoto Order Parameter quantifying macroscopic phase coherence $R(t) \in [0, 1]$:
   $$R(t)\,e^{i\Psi(t)} = \frac{1}{N} \sum_{j=1}^{N} e^{i\theta_j(t)}$$
3. **Parameters & Units:** Phases $\theta_i \in [0, 2\pi)\ [\text{rad}]$, intrinsic angular frequencies $\omega_i = 2\pi f_i\ [\text{rad/s}]$ drawn from Lorentzian/Gaussian distribution $g(\omega)$ with spread $\gamma$, global coupling $K\ [\text{rad/s}]$, adjacency matrix $A_{ij}$, conduction delays $\tau_{ij}\ [\text{ms}]$.
4. **Validation (`VAL-KURAMOTO-001`):** For all-to-all coupling ($A_{ij}=1, \tau_{ij}=0, \sigma=0$) with Lorentzian $g(\omega)$ of half-width $\gamma$, onset of macroscopic synchronization occurs at critical coupling $K_c = 2\gamma$, with steady-state order parameter $R = \sqrt{1 - K_c / K}$ for $K > K_c$.

## 6. Acceptance Criteria & Related Documents

- **AC-MOD-006:** All population and oscillator models expose phase-plane/nullcline or order-parameter diagnostics and link to `MOD-11` spectral analytics.
- **Links:** [SPIKING_NETWORKS.md](SPIKING_NETWORKS.md), [NETWORK_MODELS.md](NETWORK_MODELS.md), [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
