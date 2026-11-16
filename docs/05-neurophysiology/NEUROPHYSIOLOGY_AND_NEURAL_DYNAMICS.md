# Neurophysiology & Neural Dynamics (Module 07) — CORTEXIA

**Document ID:** `DOC-PHYS-001`  
**Module:** `MOD-07` (Neurophysiology & Neural Dynamics)  
**Biological Scales:** `L2` Subcellular – `L6` Mesoscopic  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the biophysical mechanisms covered by **Module 07**, serving as the physiological bridge between molecular ion channel behavior (`MOD-04`) and mathematical simulation models (`MOD-08`).

## 2. Core Electrophysiological Mechanisms

### 2.1 Resting Membrane Potential
- Maintained near `-65 mV` to `-75 mV` in typical mammalian cortical neurons by asymmetric ionic concentrations ($Na^+/K^+$-ATPase) and high resting $K^+$ permeability relative to $Na^+$ ($P_K : P_{Na} : P_{Cl} \approx 1.0 : 0.04 : 0.45$, modeled by `EQ-GHK-VOLTAGE`).

### 2.2 Action Potential Initiation & Propagation
1. **Subthreshold Integration:** Depolarizing currents charge membrane capacitance $C_m$ toward threshold at the Axon Initial Segment (`AIS`), where $Na_v1.6$ density is highest (`~100–300 channels/µm²`).
2. **All-or-None Threshold & Upstroke:** Positive feedback loop between depolarization and $Na_v$ activation ($m^3$) drives rapid influx of $Na^+$, pushing $V_m$ toward $E_{Na}$ (`~+40 to +55 mV`).
3. **Repolarization & Hyperpolarization:** Fast $Na_v$ inactivation ($h \to 0$) combined with delayed-rectifier $K_v$ activation ($n^4$) restores $V_m$ and often produces an afterhyperpolarization (`AHP`) toward $E_K$.
4. **Refractory Periods:**
   - *Absolute Refractory Period (`~1–2 ms`):* $Na_v$ inactivation gates (`h`) remain closed; no stimulus intensity can elicit a second spike.
   - *Relative Refractory Period (`~3–10 ms`):* Residual elevated $g_K$ and partial $h$ recovery require supranormal current $I_{\text{ext}}$ to fire.
5. **Unmyelinated vs. Saltatory Propagation:** Modeled via cable theory (`REF-RALL-1962`); unmyelinated velocity scales as $v \propto \sqrt{d}$ whereas myelinated saltatory conduction scales approximately linearly with outer fiber diameter ($v \propto d$).

### 2.3 Dendritic Cable Integration & Synaptic Potentials
- **Passive Length ($\lambda$) and Time ($\tau_m$) Constants:**
  $$\lambda = \sqrt{\frac{r_m}{r_i}}, \qquad \tau_m = R_m C_m$$
- **EPSP / IPSP Summation:** Temporal summation ($\Delta t \lesssim \tau_m$) and spatial summation across dendritic compartments, modulated by active dendritic $Ca^{2+}$/NMDA plateaus and shunting inhibition ($E_{\text{GABA}} \approx V_{\text{rest}}$).

### 2.4 Neuronal Excitability Classes & Firing Patterns
- **Hodgkin Type I vs. Type II Excitability (`REF-GERSTNER-2014`):**
  - *Type I (Saddle-Node on Invariant Circle, SNIC):* Continuous $f\text{–}I$ onset from arbitrarily low frequency (`~0 Hz`); acts as an integrator.
  - *Type II (Andronov–Hopf Bifurcation):* Discontinuous jump to non-zero firing frequency at rheobase with subthreshold damped oscillations; acts as a resonator (classic Hodgkin–Huxley).
- **Canonical Cortical & Subcortical Firing Patterns:** Regular Spiking (`RS`), Fast Spiking (`FS`), Intrinsic Bursting (`IB`), Chattering (`CH`), Low-Threshold Spiking (`LTS`), Phasic vs. Tonic spiking (`MODEL-IZHIKEVICH`, `MODEL-ADEX`).

### 2.5 Macroscopic Oscillations & Synchronization (`REF-BUZSAKI-2012`)

| Rhythm Band | Frequency Range | Representative Physiological Context | Primary Cellular/Circuit Generators |
|---|---|---|---|
| **Delta ($\delta$)** | `0.5 – 4 Hz` | Deep NREM slow-wave sleep (`UP/DOWN` cortical states) | Thalamocortical + slow cortical $K^+$ adaptation currents |
| **Theta ($\theta$)** | `4 – 8 Hz` | Hippocampal spatial navigation / active memory encoding (rodent `6–10 Hz`; human `~4–8 Hz`) | Medial septum–diagonal band GABA/ACh pacing + CA3/CA1 circuits |
| **Alpha ($\alpha$)** | `8 – 12 Hz` | Eyes-closed posterior idling & attentional gating | Thalamocortical relay–reticular (`TRN`) loops (`MODEL-JANSEN-RIT`) |
| **Beta ($\beta$)** | `13 – 30 Hz` | Sensorimotor maintenance & cortico-basal ganglia loops | Cortical Layer 5 pyramidal + striatal/STN loops |
| **Gamma ($\gamma$)** | `30 – 80+ Hz` | Local sensory binding & working memory maintenance | Pyramidal–Interneuron Network Gamma (`PING`, `PV+` fast inhibition) |

## 3. Assumptions, Dependencies & Acceptance Criteria

- **Dependencies:** [MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md](../04-cellular-and-molecular/MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md), [NEURON_MODELS.md](../06-computational-models/NEURON_MODELS.md), [SIGNAL_ANALYTICS.md](../08-neural-data-and-analytics/SIGNAL_ANALYTICS.md).
- **AC-PHYS-001:** Every electrophysiological concept links bidirectionally to its governing equations (`EQ-*`), simulator presets (`EXP-*`), and UCES documentation.

## 4. References

- `REF-HH-1952`: Hodgkin & Huxley (1952), DOI: `10.1113/jphysiol.1952.sp004764`.
- `REF-RALL-1962`: Rall (1962), DOI: `10.1111/j.1749-6632.1962.tb54120.x`.
- `REF-GERSTNER-2014`: Gerstner et al. (2014), DOI: `10.1017/CBO9781107447615`.
- `REF-BUZSAKI-2012`: Buzsáki et al. (2012), DOI: `10.1038/nrn3241`.
