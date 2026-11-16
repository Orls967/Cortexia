# Synaptic Plasticity & Learning Model Specifications — CORTEXIA

**Document ID:** `DOC-MOD-008`  
**Module:** `MOD-05`, `MOD-08`, `MOD-10`  
**Models Covered:** `MODEL-023`, `MODEL-024`, `MODEL-025`, `MODEL-026`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies CORTEXIA's long-term plasticity and reinforcement-learning models (`MODEL-023`–`MODEL-026`), detailing rate-based rules (Hebbian, Oja, BCM), spike-timing-dependent plasticity (pair & triplet STDP), homeostatic scaling, and dopaminergic reward prediction error (`TD-RL`).

---

## 2. `MODEL-023` — Rate-Based Hebbian, Oja PCA & BCM Plasticity (`FAM-13`)

1. **Identity & Provenance:** `MODEL-023` · Scale `L4` · `REF-DAYAN-2001`, `REF-OJA-1982`, `REF-BCM-1982`.
2. **Governing Formulations (`EQ-HEBB-BASIC`, `EQ-OJA-RULE`, `EQ-BCM-RULE`):**
   For presynaptic firing rates $\mathbf{x} \in \mathbb{R}^n$ and linear/nonlinear postsynaptic rate $y = \mathbf{w}^\top \mathbf{x}$:
   - **Basic Correlation Hebbian Rule (Unbounded):**
     $$\tau_w \frac{d\mathbf{w}}{dt} = \mathbf{x} y \qquad \text{(requires hard clipping } w_i \in [0, w_{\max}]\text{)}$$
   - **Oja Multiplicative Normalization Rule (`REF-OJA-1982`):**
     $$\tau_w \frac{d\mathbf{w}}{dt} = y\,\mathbf{x} - \alpha y^2 \mathbf{w} \implies \|\mathbf{w}\|_2 \to \frac{1}{\sqrt{\alpha}}, \quad \mathbf{w} \parallel \mathbf{e}_{\max}(\mathbf{C}_{xx})$$
   - **Bienenstock–Cooper–Munro (`BCM`) Sliding Threshold Rule (`REF-BCM-1982`):**
     $$\tau_w \frac{d\mathbf{w}}{dt} = y\,(y - \theta_M)\,\mathbf{x}, \qquad \tau_\theta \frac{d\theta_M}{dt} = y^2 - \theta_M$$
     where $y > \theta_M$ induces LTP, $0 < y < \theta_M$ induces LTD, and superlinear $\theta_M \sim \langle y^2 \rangle$ stabilizes selectivity.
3. **Validation:** Oja's rule converges to unit-norm principal eigenvector of input covariance matrix $\mathbf{C}_{xx}$ (`VAL-OJA-001`).

---

## 3. `MODEL-024` — Pair-Based & Triplet STDP (`FAM-14`)

1. **Identity & Provenance:** `MODEL-024` · Scale `L4` · `REF-BI-POO-1998`, `REF-GERSTNER-2014`.
2. **Pair-Based STDP Window (`EQ-STDP-WINDOW`, `EQ-STDP-TRACES`):**
   For spike-time difference $\Delta t = t_{\text{post}} - t_{\text{pre}}$:
   $$\Delta w(\Delta t) = \begin{cases}
   +A_+(w)\,\exp\!\left(-\dfrac{\Delta t}{\tau_+}\right), & \Delta t > 0 \quad (\text{pre before post } \to \text{LTP}) \\[6pt]
   -A_-(w)\,\exp\!\left(+\dfrac{\Delta t}{\tau_-}\right), & \Delta t < 0 \quad (\text{post before pre } \to \text{LTD})
   \end{cases}$$
   Implemented online via local eligibility traces $x_{\text{pre}}(t), y_{\text{post}}(t)$:
   $$\frac{dx_{\text{pre}}}{dt} = -\frac{x_{\text{pre}}}{\tau_+} + \sum_f \delta(t - t_{\text{pre}}^{(f)}), \qquad \frac{dy_{\text{post}}}{dt} = -\frac{y_{\text{post}}}{\tau_-} + \sum_f \delta(t - t_{\text{post}}^{(f)})$$
3. **Additive vs. Multiplicative Soft Weight Bounds (`EQ-STDP-BOUNDS`):**
   - *Additive:* $A_+(w) = \eta_+, \ A_-(w) = \eta_-$ with hard clamp $w \in [w_{\min}, w_{\max}]$ (produces bimodal weight distributions).
   - *Multiplicative:* $A_+(w) = \eta_+(w_{\max} - w), \ A_-(w) = \eta_-(w - w_{\min})$ (produces unimodal weight distributions).
4. **Triplet STDP Extension:** Adds slow postsynaptic trace $y_2(t)$ ($\tau_y = 114\text{ ms}$) capturing high-frequency pairing LTP dependence.
5. **Defaults (`REF-BI-POO-1998`):** $\tau_+ = 16.8\text{ ms}$, $\tau_- = 33.7\text{ ms}$, $\eta_+ = 0.010$, $\eta_- = 0.0105$, $w_{\min} = 0$, $w_{\max} = 1.0$.

---

## 4. `MODEL-025` — Multiplicative Homeostatic Synaptic Scaling (`FAM-13`)

1. **Identity & Provenance:** `MODEL-025` · Scales `L3`–`L4` · `REF-TURRIGIANO-2008`.
2. **Governing Equations (`EQ-HOMEOSTATIC-SCALE`):**
   Slow intracellular calcium/firing-rate sensor $\bar{r}_i(t)$ tracks postsynaptic activity and scales incoming excitatory weights multiplicatively while preserving relative Hebbian ratios:
   $$\tau_r \frac{d\bar{r}_i}{dt} = -\bar{r}_i + S_i(t), \qquad \tau_{\text{homeo}} \frac{dw_{ij}}{dt} = \gamma_H \left(r_{\text{target}} - \bar{r}_i\right) w_{ij}$$
3. **Defaults:** $r_{\text{target}} = 5.0\text{ Hz}$, $\tau_r = 1,000\text{ ms}$, $\tau_{\text{homeo}} = 10,000\text{ ms}$ (accelerated educational timescale, explicitly disclosed vs. biological hours/days).

---

## 5. `MODEL-026` — Dopamine Reward-Prediction-Error (`TD-RL`) Model (`FAM-15`)

1. **Identity & Provenance:** `MODEL-026` · Scales `L4`, `L9` · `REF-SCHULTZ-1997`, `REF-SUTTON-BARTO-2018`.
2. **Biological Interpretation:** Midbrain VTA/SNc dopaminergic neurons encode Temporal-Difference Reward Prediction Error (`RPE` $\delta_t$) gating three-factor corticostriatal plasticity.
3. **Governing Equations (`EQ-TDRL-RPE`, `EQ-TDRL-THREEFACTOR`):**
   $$\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t), \qquad V(s_t) \leftarrow V(s_t) + \alpha_{\text{learn}}\,\delta_t$$
   Three-factor synaptic eligibility update:
   $$\frac{de_{ij}}{dt} = -\frac{e_{ij}}{\tau_e} + \text{Hebb}(r_{\text{pre}, j}, r_{\text{post}, i}), \qquad \frac{dw_{ij}}{dt} = \eta_{\text{DA}}\,\delta_{\text{DA}}(t)\,e_{ij}(t)$$
4. **Canonical Signatures (`VAL-TDRL-001`):** Reproduces (1) positive phasic burst at unexpected reward ($r_t > 0, \delta_t > 0$), (2) shift of phasic burst to conditioned stimulus (`CS`) after conditioning while reward time (`US`) goes to $\delta_t \approx 0$, and (3) phasic pause ($\delta_t < 0$) upon omitted expected reward (`REF-SCHULTZ-1997`).

## 6. Acceptance Criteria & Related Documents

- **AC-MOD-008:** All plasticity and learning models enforce explicit weight bounds, expose parameter sensitivity views, and link to `MOD-05` and `MOD-10`.
- **Links:** [SYNAPTIC_MODELS.md](SYNAPTIC_MODELS.md), [SPIKING_NETWORKS.md](SPIKING_NETWORKS.md), [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
