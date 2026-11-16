# Synaptic Dynamics & Short-Term Plasticity Models — CORTEXIA

**Document ID:** `DOC-MOD-005`  
**Module:** `MOD-05`, `MOD-08`  
**Models Covered:** `MODEL-011` through `MODEL-016`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies CORTEXIA's six synaptic transmission and short-term plasticity models (`MODEL-011`–`MODEL-016`), defining current-based vs. conductance-based formulations, reversal potentials, receptor-specific kinetic time constants (`AMPA`, `NMDA`, `GABA_A`), gap junctions, and Tsodyks–Markram vesicle depletion/facilitation dynamics.

---

## 2. `MODEL-011` — Single-Exponential Current-Based Synapse (`FAM-07`)

- **Governing Equations (`EQ-SYN-CUBA-EXP`):**
  $$I_{\text{syn}}(t) = \sum_{j} w_j s_j(t), \qquad \frac{ds_j}{dt} = -\frac{s_j}{\tau_{\text{syn}}} + \sum_{f} \delta(t - t_j^{(f)} - \tau_d)$$
- **Parameters & Units:** Weight $w_j$ [$\text{pA}$], dimensionless trace $s_j(t)$, decay constant $\tau_{\text{syn}} = 5.0\text{ ms}$ (excitatory) or $10.0\text{ ms}$ (inhibitory), axonal delay $\tau_d = 1.5\text{ ms}$.
- **Solver & Limitations:** Exact analytical update $s(t + \Delta t) = s(t) e^{-\Delta t / \tau_{\text{syn}}}$. Does not capture voltage-dependent driving force saturation or shunting inhibition (`REF-DAYAN-2001`).

---

## 3. `MODEL-012` — Alpha-Function Postsynaptic Conductance (`FAM-08`)

- **Purpose:** Models finite synaptic rise and decay with a single time constant $\tau_\alpha$ peaking at $t = \tau_\alpha$.
- **Governing Equations (`EQ-SYN-ALPHA-KERNEL`, `EQ-SYN-ALPHA-ODE`):**
  $$I_{\text{syn}}(t) = g_{\text{syn}}(t)\,(V(t) - E_{\text{rev}}), \qquad g_{\text{syn}}(t) = \bar{g}_{\text{syn}} \frac{t - t_0}{\tau_\alpha} \exp\!\left(1 - \frac{t - t_0}{\tau_\alpha}\right) \Theta(t - t_0)$$
  Equivalent Markov/ODE cascade for multi-spike superposition:
  $$\frac{dz}{dt} = -\frac{z}{\tau_\alpha} + e \sum_{f} \delta(t - t^{(f)} - \tau_d), \qquad \frac{dg_{\text{syn}}}{dt} = \frac{\bar{g}_{\text{syn}} z - g_{\text{syn}}}{\tau_\alpha}$$
- **Defaults:** $\bar{g}_{\text{syn}} = 2.0\text{ nS}$, $\tau_\alpha = 2.0\text{ ms}$, $E_{\text{rev}} = 0\text{ mV}$ (excitatory) or $-75\text{ mV}$ (inhibitory).

---

## 4. `MODEL-013` — Bi-Exponential AMPA & $GABA_A$ Conductance Synapse (`FAM-08`)

- **Purpose & Provenance:** Independently parameterizes distinct receptor rise ($\tau_r$) and decay ($\tau_d$) kinetics (`REF-DESTEXHE-1994`).
- **Governing Equations (`EQ-SYN-BIEXP`):**
  $$g_{\text{syn}}(t) = \bar{g}_{\text{syn}} \mathcal{N}_{\text{norm}} \left(B(t) - A(t)\right), \qquad \frac{dA}{dt} = -\frac{A}{\tau_r} + \sum_f \delta(t - t^{(f)}), \qquad \frac{dB}{dt} = -\frac{B}{\tau_d} + \sum_f \delta(t - t^{(f)})$$
  where normalization factor $\mathcal{N}_{\text{norm}} = \left[\left(\frac{\tau_r}{\tau_d}\right)^{\frac{\tau_r}{\tau_d - \tau_r}} - \left(\frac{\tau_r}{\tau_d}\right)^{\frac{\tau_d}{\tau_d - \tau_r}}\right]^{-1}$ ensures unit peak conductance for a single spike.
- **Canonical Receptor Presets:**
  - **AMPA (`Glutamate`):** $\tau_r = 0.4\text{ ms}$, $\tau_d = 2.0\text{ ms}$, $E_{\text{AMPA}} = 0.0\text{ mV}$.
  - **$GABA_A$ (`Chloride`):** $\tau_r = 0.5\text{ ms}$, $\tau_d = 8.0\text{ ms}$, $E_{\text{GABA}_A} = -75.0\text{ mV}$.

---

## 5. `MODEL-014` — Voltage-Dependent NMDA $Mg^{2+}$-Block Synapse (`FAM-08`)

- **Purpose & Provenance:** Models coincidence detection requiring both presynaptic glutamate release and postsynaptic depolarization to relieve extracellular $Mg^{2+}$ pore block (`REF-TRAYNELIS-2010`, `REF-DESTEXHE-1994`, Jahr & Stevens 1990).
- **Governing Equations (`EQ-SYN-NMDA`, `EQ-NMDA-MGBLOCK`):**
  $$I_{\text{NMDA}}(V, t) = g_{\text{NMDA}}(t)\,B(V)\,(V - E_{\text{NMDA}}), \qquad B(V) = \frac{1}{1 + \frac{[Mg^{2+}]_{\text{out}}}{3.57\text{ mM}} \exp(-0.062\text{ mV}^{-1}\,V)}$$
- **Default Parameters:** $\tau_{r,\text{NMDA}} = 2.0\text{ ms}$, $\tau_{d,\text{NMDA}} = 100.0\text{ ms}$, $[Mg^{2+}]_{\text{out}} = 1.0\text{ mM}$, $E_{\text{NMDA}} = 0.0\text{ mV}$, $\bar{g}_{\text{NMDA}} = 1.0\text{ nS}$.

---

## 6. `MODEL-015` — Electrical Gap-Junction Ohmic Coupling (`FAM-08`)

- **Governing Equation (`EQ-SYN-GAP`):**
  $$I_{\text{gap}, i\leftarrow j} = g_{\text{gap}, ij}\,(V_j - V_i)$$
- **Defaults & Properties:** $g_{\text{gap}} = 0.5\text{ to }5.0\text{ nS}$; symmetric bidirectional current conservation ($I_{\text{gap}, i\leftarrow j} = -I_{\text{gap}, j\leftarrow i}$); mediates sub-millisecond `PV+` interneuron synchronization.

---

## 7. `MODEL-016` — Tsodyks–Markram Short-Term Synaptic Plasticity (`FAM-09`)

- **Purpose & Provenance:** Unified dynamical model of short-term synaptic depression (`STD`) and facilitation (`STF`) via utilization $u(t)$ and available vesicle fraction $x(t)$ (`REF-TSODYKS-1997`).
- **Governing Equations (`EQ-STP-TM-ODE`, `EQ-STP-TM-JUMP`):**
  Between presynaptic spikes:
  $$\frac{du}{dt} = \frac{U_0 - u}{\tau_{\text{facil}}}, \qquad \frac{dx}{dt} = \frac{1 - x}{\tau_{\text{rec}}}$$
  At each presynaptic spike arrival $t_{\text{sp}}$:
  $$u^+ = u^- + U_0 (1 - u^-), \qquad \Delta r = u^+ x^-, \qquad x^+ = x^- - \Delta r, \qquad g_{\text{syn}} \leftarrow g_{\text{syn}} + \bar{g}_{\text{max}}\,\Delta r$$
- **Canonical Presets:**
  - *Depression-Dominated (Cortical L5 Pyramidal–Pyramidal):* $U_0 = 0.50$, $\tau_{\text{rec}} = 800\text{ ms}$, $\tau_{\text{facil}} = 20\text{ ms}$.
  - *Facilitation-Dominated (Pyramidal–SST Martinotti):* $U_0 = 0.10$, $\tau_{\text{rec}} = 100\text{ ms}$, $\tau_{\text{facil}} = 750\text{ ms}$.
- **Validation:** Analytical steady-state EPSC amplitude at periodic stimulation rate $f$ verified against `VAL-STP-001`.

## 8. Acceptance Criteria & Related Documents

- **AC-MOD-005:** All 6 synaptic models validate unit consistency (`nS × mV = pA`), support UCES inspection, and couple directly with single-neuron and SNN models.
- **Links:** [NEURON_MODELS.md](NEURON_MODELS.md), [PLASTICITY_AND_LEARNING_MODELS.md](PLASTICITY_AND_LEARNING_MODELS.md), [SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md](../05-neurophysiology/SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md).
