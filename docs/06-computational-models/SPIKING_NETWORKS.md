# Spiking Neural Network (SNN) Specifications — CORTEXIA

**Document ID:** `DOC-MOD-007`  
**Module:** `MOD-06`, `MOD-08`  
**Models Covered:** `MODEL-020`, `MODEL-021`, `MODEL-022`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies CORTEXIA's spiking neural network architectures (`MODEL-020`–`MODEL-022`), defining population topologies, sparse recurrent E/I balance, axonal delay ring buffers, dynamical phase regimes (`AI`, `SR`, `SI`), and browser scaling bounds.

---

## 2. `MODEL-020` — Feedforward Spiking Cascade / Synfire Network (`FAM-12`)

1. **Identity & Scale:** `MODEL-020` · Scale `L5` · `REF-DAYAN-2001`, `REF-GERSTNER-2014`.
2. **Scientific Purpose:** Investigate how synchronous spike volleys ("pulse packets" parameterized by spike count $a_k$ and temporal dispersion $\sigma_k$) either propagate stably across $L$ cortical layers or dissipate into asynchronous background firing.
3. **Network Equations (`EQ-SNN-FF`):**
   - $L$ layers ($L \in [3, 10]$), each containing $M \in [50, 200]$ `CUBA-LIF` or `COBA-LIF` excitatory neurons plus local feedforward `PV+` inhibitory gating neurons.
   - Layer $k$ projects to layer $k+1$ with connection probability $p_{\text{ff}} \in [0.1, 1.0]$, weight $J_{\text{ff}}$, and axonal delay $\tau_d = 1.5\text{ ms}$.
4. **Outputs & Analytics:** Layer-by-layer raster plot, pulse-packet survival map $(a_k, \sigma_k) \mapsto (a_{k+1}, \sigma_{k+1})$, and PSTH latency progression.

---

## 3. `MODEL-021` — Brunel Sparse Balanced Recurrent E/I Spiking Network (`FAM-12`)

1. **Identity & Provenance:** `MODEL-021` · Scale `L5` · `REF-BRUNEL-2000`, `REF-VANVREESWIJK-1996`.
2. **Biological Interpretation:** Canonical local cortical microcircuit of $N_E = 0.8 N$ excitatory and $N_I = 0.2 N$ inhibitory `LIF` neurons with sparse random connectivity ($\epsilon = 0.1$) receiving external Poisson drive $\nu_{\text{ext}}$.
3. **Governing Equations (`EQ-BRUNEL-MEMBRANE`, `EQ-BRUNEL-INPUT`):**
   $$\tau_m \frac{dV_i}{dt} = -(V_i - V_{\text{rest}}) + R I_{\text{syn}, i}(t), \qquad i = 1, \dots, N$$
   $$R I_{\text{syn}, i}(t) = \tau_m \sum_{j \in \mathcal{E}_i} J_E \sum_f \delta(t - t_j^{(f)} - D) - \tau_m \sum_{k \in \mathcal{I}_i} g J_E \sum_f \delta(t - t_k^{(f)} - D) + \tau_m J_{\text{ext}} \sum_f \delta(t - t_{\text{ext}, i}^{(f)})$$
4. **Canonical Four Dynamical Regimes (`REF-BRUNEL-2000`):**
   Controlled by relative inhibitory strength $g = J_I / J_E$ and external rate ratio $\eta = \nu_{\text{ext}} / \nu_{\text{thr}}$:
   - **SR (`Synchronous Regular`):** Excitation-dominated ($g < 4$, e.g. $g = 3.0, \eta = 2.0$).
   - **AI (`Asynchronous Irregular` — In-Vivo Cortical Baseline):** Inhibition-balanced ($g > 4$, e.g. $g = 5.0, \eta = 2.0$), producing Poisson-like $CV_{\text{ISI}} \approx 0.8–1.0$.
   - **SI-Fast (`Synchronous Irregular Fast`):** Strong inhibition + high drive ($g = 6.0, \eta = 4.0$) with global fast oscillation (`~150–200 Hz` dictated by delay $D$).
   - **SI-Slow (`Synchronous Irregular Slow`):** Near threshold ($g = 4.5, \eta = 0.9$).
5. **Default Parameters:** $N = 1,000$ (`800 E`, `200 I`; browser cap `4,000`), $\epsilon = 0.10$, $\tau_m = 20\text{ ms}$, $V_{\text{th}} = 20\text{ mV}$, $V_{\text{reset}} = 10\text{ mV}$, $\tau_{\text{ref}} = 2.0\text{ ms}$, $J_E = 0.1\text{ mV}$, $D = 1.5\text{ ms}$, `dt = 0.1 ms`.
6. **Validation:** Verify $CV_{\text{ISI}} > 0.7$ and low synchrony $\chi < 0.15$ in the `AI` preset (`VAL-BRUNEL-001`).

---

## 4. `MODEL-022` — Vogels Inhibitory-Plasticity Balanced E/I Network (`FAM-12`)

1. **Identity & Provenance:** `MODEL-022` · Scales `L4`–`L5` · `REF-VOGELS-2011`.
2. **Scientific Purpose:** Demonstrate how symmetric inhibitory spike-timing-dependent plasticity (`iSTDP`) on $I \to E$ synapses self-organizes detailed E/I balance and prevents runaway excitation around a target postsynaptic firing rate $\rho_0$.
3. **Governing Equations (`EQ-VOGELS-ISTDP`):**
   Synaptic trace $\frac{dx_i}{dt} = -\frac{x_i}{\tau_{\text{STDP}}}$ updated by $+1$ on each spike; inhibitory weight $w_{ij}^{IE}$ updates via:
   $$\begin{aligned}
   \text{On presynaptic } I\text{ spike } j: &\quad w_{ij}^{IE} \leftarrow w_{ij}^{IE} + \eta_{\text{learn}}\,(x_i - \alpha), \qquad \alpha = 2 \rho_0 \tau_{\text{STDP}} \\
   \text{On postsynaptic } E\text{ spike } i: &\quad w_{ij}^{IE} \leftarrow w_{ij}^{IE} + \eta_{\text{learn}}\,x_j
   \end{aligned}$$
4. **Defaults:** $\tau_{\text{STDP}} = 20\text{ ms}$, target rate $\rho_0 = 5.0\text{ Hz}$, $\eta_{\text{learn}} = 10^{-3}$, $N = 1,000$ (`800 E`, `200 I`).

---

## 5. Computational Scaling & Ring-Buffer Implementation

- **CSR Sparse Adjacency Representation:** Synaptic connectivity matrices use Compressed Sparse Row (`CSR`) typed arrays (`rowPtr: Uint32Array`, `colIdx: Uint16Array`, `weights: Float64Array`) to keep memory footprint `< 16 MB` at `200,000` synapses.
- **Axonal Delay Ring Buffer:** A circular buffer of length $K_{\text{delay}} = \lceil D_{\max} / dt \rceil + 1$ stores incoming synaptic kicks per neuron per time step, achieving $O(N + M_{\text{active}})$ step complexity rather than $O(N^2)$.

## 6. Acceptance Criteria & Related Documents

- **AC-MOD-007:** SNN models execute inside Web Workers without blocking UI frames, support reproducible seeded random graph generation (Erdős–Rényi, Watts–Strogatz, ring), and stream raster/rate telemetry to `MOD-11`.
- **Links:** [NEURON_MODELS.md](NEURON_MODELS.md), [PLASTICITY_AND_LEARNING_MODELS.md](PLASTICITY_AND_LEARNING_MODELS.md), [SIMULATION_AND_WORKER_ARCHITECTURE.md](../12-software-architecture/SIMULATION_AND_WORKER_ARCHITECTURE.md).
