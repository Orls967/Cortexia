# Synaptic Architecture & Plasticity (Module 05) — CORTEXIA

**Document ID:** `DOC-SYN-001`  
**Module:** `MOD-05` (Synaptic Architecture & Plasticity)  
**Biological Scales:** `L4` Synaptic  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the biological mechanisms, mathematical connections, Studio C visualizations, and simulator coupling for **Module 05 — Synaptic Architecture & Plasticity**.

## 2. Synaptic Transmission Architectures

### 2.1 Chemical vs. Electrical Synapses

| Property | Chemical Synapse | Electrical Synapse (Gap Junction) |
|---|---|---|
| **Structural Substrate** | Presynaptic active zone, `~20 nm` synaptic cleft, postsynaptic density (`PSD`) | Hexagonal **Connexon** hemichannels (`Cx36` in neurons, `Cx43` in astrocytes) bridging `~3.5 nm` cleft |
| **Transmission Delay** | `~0.5 – 2.0 ms` (calcium-triggered exocytosis + diffusion) | Near-instantaneous (`< 0.1 ms` electrotonic coupling) |
| **Directionality** | Unidirectional (rarely reciprocal dendrodendritic) | Typically bidirectional; passes current $I_{\text{gap}} = g_{\text{gap}}(V_j - V_i)$ |
| **Sign Inversion / Gain** | Excitatory or inhibitory depending on $E_{\text{rev}}$; strong signal amplification | Primarily excitatory/synchronizing; low-pass filters spikes |
| **Role in Networks** | Plastic learning, selective computation, E/I gating | Fast interneuron (`PV+`) synchrony (`REF-KANDEL-2021`) |

### 2.2 Excitatory & Inhibitory Postsynaptic Kinetics
- **AMPA:** Rapid rise (`~0.2–0.5 ms`), fast decay (`~2–5 ms`), $E_{\text{AMPA}} \approx 0\text{ mV}$.
- **NMDA:** Slow kinetics (`~50–150 ms`), voltage-dependent extracellular $Mg^{2+}$ block relieved upon postsynaptic depolarization (`Jahr–Stevens` factor $B(V)$), $Ca^{2+}$ permeability enabling coincidence detection.
- **$GABA_A$:** Chloride-selective fast inhibition ($\tau \approx 6–15\text{ ms}$), $E_{\text{GABA}} \approx -70\text{ to }-75\text{ mV}$ in mature neurons (hyperpolarizing or shunting).
- **$GABA_B$:** Slow metabotropic $G_{i/o}$-coupled $K^+$ (`GIRK`) inhibition (`~100–300 ms`).

---

## 3. Synaptic Plasticity Mechanisms (`L4`)

### 3.1 Short-Term Plasticity (`ms – s`, `REF-TSODYKS-1997`)
- **Short-Term Facilitation (`STF`):** Residual presynaptic $Ca^{2+}$ increases release probability $u(t)$ across high-frequency spikes (`MODEL-STP-TM`).
- **Short-Term Depression (`STD`):** Depletion of the readily releasable vesicle pool $x(t)$ reduces postsynaptic response during sustained high-rate bursts.

### 3.2 Long-Term Potentiation & Depression (`min – days`)
- **NMDA-Dependent CA1 LTP (`REF-BLISS-LOMO-1973`):** Coincident presynaptic glutamate + postsynaptic depolarization expels $Mg^{2+}$ → large $Ca^{2+}$ influx → `CaMKII` activation → AMPA receptor insertion into PSD (`Early LTP`) and CREB-dependent protein synthesis (`Late LTP`).
- **NMDA-Dependent / mGluR-Dependent LTD:** Low-frequency modest $Ca^{2+}$ elevation recruits calcineurin / `PP1` → AMPA endocytosis (`GluA2`) and spine shrinkage.

### 3.3 Spike-Timing-Dependent Plasticity (`STDP`, `REF-BI-POO-1998`)
- Presynaptic spike preceding postsynaptic spike ($\Delta t = t_{\text{post}} - t_{\text{pre}} > 0$, within `~0–40 ms`) induces **LTP** ($+A_+ e^{-\Delta t/\tau_+}$).
- Postsynaptic spike preceding presynaptic spike ($\Delta t < 0$) induces **LTD** ($-A_- e^{\Delta t/\tau_-}$).
- Implemented directly in `MODEL-STDP-PAIR` and `MODEL-STDP-TRIPLET` inside `MOD-08`.

### 3.4 Homeostatic & Structural Plasticity (`hours – days`, `REF-TURRIGIANO-2008`)
- **Homeostatic Synaptic Scaling:** Multiplicative scaling of all excitatory synapses ($w_i \leftarrow \alpha w_i$) to keep mean firing rate near biological target $r_{\text{target}}$, preventing Hebbian runaway saturation (`MODEL-HOMEOSTATIC-SCALING`).
- **Structural Plasticity:** Activity-dependent formation, stabilization, enlargement, or elimination of dendritic spines mediated by actin cytoskeleton remodeling and microglial complement pruning.

## 4. Direct Link to Neural Simulator (`MOD-08`)

Every plasticity card in `MOD-05` exposes a one-click **"Simulate in Computational Lab"** button routing to:
- `MODEL-SYN-CONDUCTANCE` / `MODEL-SYN-NMDA` (AMPA/NMDA/GABA dynamics)
- `MODEL-STP-TM` (Tsodyks–Markram facilitation vs. depression)
- `MODEL-STDP-PAIR` (Bi & Poo STDP window & weight evolution)
- `MODEL-HOMEOSTATIC-SCALING` (Homeostatic firing stabilization)

## 5. Acceptance Criteria & References

- **AC-SYN-001:** All synaptic mechanisms link to Studio C 3D visualizations, `MOD-08` models, and `REF-*` citations.
- `REF-BLISS-LOMO-1973`: Bliss & Lømo (1973), DOI: `10.1113/jphysiol.1973.sp010273`.
- `REF-TSODYKS-1997`: Tsodyks & Markram (1997), DOI: `10.1073/pnas.94.2.719`.
- `REF-BI-POO-1998`: Bi & Poo (1998), DOI: `10.1523/JNEUROSCI.18-24-10464.1998`.
- `REF-TURRIGIANO-2008`: Turrigiano (2008), DOI: `10.1016/j.cell.2008.10.008`.
