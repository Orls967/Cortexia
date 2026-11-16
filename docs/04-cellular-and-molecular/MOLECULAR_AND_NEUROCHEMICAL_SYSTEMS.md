# Molecular & Neurochemical Systems (Module 04) — CORTEXIA

**Document ID:** `DOC-MOL-001`  
**Module:** `MOD-04` (Molecular & Neurochemical Systems)  
**Biological Scales:** `L1` Molecular, `L2` Subcellular  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the biophysical, biochemical, and mechanistic coverage of **Module 04**, bridging molecular proteins, ion channels, ionic homeostasis, synaptic vesicle cycling, receptor pharmacology (strictly mechanistic/educational), and intracellular signaling cascades to electrophysiology (`MOD-07`) and mathematical models (`MOD-08`).

> [!IMPORTANT]
> **Educational Scope Disclaimer:** Receptor and neurotransmitter pharmacology descriptions explain normal physiological mechanisms and receptor gating kinetics. CORTEXIA provides zero medical, diagnostic, or drug-dosing recommendations.

---

## 2. Ionic Gradients & Thermodynamic Foundations (`L1`)

Typical mammalian CNS resting concentrations and Nernst equilibrium potentials ($T = 37\ ^\circ\text{C} = 310.15\text{ K}$, $\frac{RT}{F} \approx 26.73\text{ mV}$, `REF-HILLE-2001`):

| Ion | Valence ($z$) | Typical $[X]_{\text{in}}$ ($\text{mM}$) | Typical $[X]_{\text{out}}$ ($\text{mM}$) | Nernst $E_X$ ($\text{mV}$) | Primary Active / Secondary Pump |
|---|---|---|---|---|---|
| $Na^+$ | $+1$ | `12` | `145` | `+66.6 mV` | $3Na^+/2K^+$-ATPase |
| $K^+$ | $+1$ | `155` | `4` | `-97.8 mV` | $3Na^+/2K^+$-ATPase, Kir buffering |
| $Ca^{2+}$ | $+2$ | `0.0001` (`100 nM` basal) | `1.5` | `+128.4 mV` | PMCA, SERCA, NCX (`3Na+/1Ca2+`) |
| $Cl^-$ | $-1$ | `4 – 10` (mature neuron) | `115` | `-89.8` to `-65.3 mV` | KCC2 (extrusion), NKCC1 (uptake) |

**Nernst Equation (`EQ-NERNST`):**
$$E_X = \frac{RT}{zF} \ln\left(\frac{[X]_{\text{out}}}{[X]_{\text{in}}}\right)$$

**Goldman–Hodgkin–Katz Voltage Equation (`EQ-GHK-VOLTAGE`, `REF-GOLDMAN-1943`, `REF-HODGKIN-KATZ-1949`):**
$$V_m = \frac{RT}{F} \ln\left(\frac{P_K [K^+]_o + P_{Na} [Na^+]_o + P_{Cl} [Cl^-]_i}{P_K [K^+]_i + P_{Na} [Na^+]_i + P_{Cl} [Cl^-]_o}\right)$$

---

## 3. Membrane Proteins & Ion Channel Families

### 3.1 Voltage-Gated Ion Channels
- **$Na_v$ (`SCN1A` / $Na_v1.1, 1.2, 1.6$):** Rapid voltage-sensor (`S4` arginine) activation + fast ball-and-chain (`IFM` motif) inactivation; drives AP upstroke (`REF-CATTERALL-2012`).
- **$K_v$ (Delayed rectifier $K_v1/2/3$, A-type $K_v4$, M-current $K_v7$):** Repolarization, afterhyperpolarization (`AHP`), spike-frequency adaptation, and subthreshold resonance.
- **$Ca_v$ (`L-type` $Ca_v1.2$, `P/Q-type` $Ca_v2.1$, `N-type` $Ca_v2.2$, `T-type` $Ca_v3.1$):** Presynaptic transmitter release (`P/Q`, `N`), dendritic spikes/gene transcription (`L`), thalamic burst firing (`T`).
- **HCN (`I_h` pacemaking channels):** Hyperpolarization-activated cyclic nucleotide-gated cation currents mediating rhythmic bursting and dendritic resonance.
- **Leak Channels (`K2P` / `NALCN`):** Establish resting membrane conductance $g_L$ and resting potential.

### 3.2 Synaptic Vesicle Cycle (`REF-SUDHOF-2013`)
1. **Neurotransmitter Loading:** V-ATPase proton pump establishes $\Delta \mu_{H^+}$ driving vesicular transporters (`VGLUT`, `VGAT`, `VMAT2`, `VAChT`).
2. **Docking & Priming:** Active zone scaffolds (`RIM`, `Munc13`, `Munc18`) assemble partial trans-SNARE complexes (`Synaptobrevin/VAMP2`, `Syntaxin-1`, `SNAP-25`).
3. **$Ca^{2+}$-Triggered Fusion:** Action potential opens $Ca_v2.1/2.2$; local $Ca^{2+}$ microdomain (`~10–100 µM`) binds **Synaptotagmin-1/2** `C2A/C2B` domains, driving full SNARE zippering in `< 0.5 ms`.
4. **Endocytosis & Recycling:** Clathrin-mediated endocytosis / ultrafast endocytosis + `Dynamin` scission + vesicle re-acidification.

---

## 4. Eight Neurotransmitter Systems (`MOD-04`)

| Neurotransmitter | Primary Synthesis Enzyme(s) | Ionotropic Receptor(s) | Metabotropic Receptor(s) | Clearance / Degradation | Primary System Roles |
|---|---|---|---|---|---|
| **Glutamate** | Glutaminase (glutamine → glutamate) | `AMPA` (`GluA1–4`), `NMDA` (`GluN1/2A–D`), `Kainate` | `mGluR1–8` (`Gq`, `Gi/o`) | Astrocytic `EAAT1/2` (GLAST/GLT-1) + glutamine synthetase cycle | Primary fast CNS excitatory transmission; NMDA coincidence detection (`REF-TRAYNELIS-2010`) |
| **GABA** | Glutamate decarboxylase (`GAD65/67`) | `GABA_A` ($Cl^-$ / $HCO_3^-$ pentamer, `REF-SIGEL-2012`) | `GABA_B` (`Gi/o` → GIRK activation / $Ca_v$ inhibition) | `GAT-1/3` reuptake + `GABA-T` mitochondrial transaminase | Primary fast & slow CNS inhibition; E/I balance & oscillation pacing |
| **Dopamine** | Tyrosine hydroxylase (`TH`) → `AADC` | None | `D1/D5` (`Gs/olf` → $\uparrow cAMP$); `D2/D3/D4` (`Gi/o` → $\downarrow cAMP$) | `DAT` reuptake; `MAO-B` & `COMT` degradation | Striatal motor selection, reward prediction error (`REF-SCHULTZ-1997`), PFC working-memory gain |
| **Serotonin (`5-HT`)** | Tryptophan hydroxylase (`TPH2`) → `AADC` | `5-HT3` (cationic) | `5-HT1,2,4,5,6,7` (`Gi/o`, `Gq`, `Gs`) | `SERT` (`SLC6A4`) reuptake; `MAO-A` | Mood/arousal modulation, sensory gating, sleep-wake regulation |
| **Acetylcholine (`ACh`)** | Choline acetyltransferase (`ChAT`) | `nAChR` ($\alpha/\beta$ cationic pentamers) | `M1/3/5` (`Gq`); `M2/4` (`Gi/o`) | Synaptic **Acetylcholinesterase (`AChE`)** + `CHT1` choline reuptake | Neuromuscular junction, autonomic ganglia, cortical arousal & attentional signal-to-noise |
| **Norepinephrine (`NE`)** | `TH` → `AADC` → Dopamine $\beta$-hydroxylase (`DBH`) | None | $\alpha_1$ (`Gq`), $\alpha_2$ (`Gi/o`), $\beta_{1–3}$ (`Gs`) | `NET` (`SLC6A2`) reuptake; `MAO`, `COMT` | Locus coeruleus gain modulation, vigilance, stress response, sympathetic postganglionic |
| **Histamine** | Histidine decarboxylase (`HDC`) | None (indirect modulation) | `H1` (`Gq`), `H2` (`Gs`), `H3` (`Gi/o` autoreceptor), `H4` | Histamine N-methyltransferase (`HNMT`) | Tuberomammillary nucleus wakefulness promotion |
| **Neuropeptides** | Ribosomal prepropeptide → ER/Golgi cleavage | None | Peptide GPCRs (Opioid, Oxytocin, Vasopressin, NPY, Orexin, Substance P) | Extracellular peptidases (`NEP`, etc.); slow diffusion | Slow high-threshold cotransmission, analgesia, feeding, social/circadian states |

---

## 5. Second Messenger & Intracellular Signaling Cascades

1. **$G\alpha_s / G\alpha_{i/o}$ – Adenylyl Cyclase – cAMP – PKA Pathway:** Modulates HCN channels, AMPA phosphorylation (`GluA1 S845`), and CREB-mediated gene expression in late LTP.
2. **$G\alpha_q$ – PLC$\beta$ – $IP_3/DAG$ Pathway:** $IP_3$ triggers ER $Ca^{2+}$ release via $IP_3R$; $DAG + Ca^{2+}$ activates Protein Kinase C (`PKC`).
3. **$Ca^{2+}$ / Calmodulin (`CaM`) – CaMKII / Calcineurin Switch:** High brief $Ca^{2+}$ pulses activate `CaMKII` autophosphorylation (`Thr286`) driving AMPA trafficking (LTP), whereas modest prolonged $Ca^{2+}$ favors `Calcineurin / PP1` dephosphorylation (LTD).

## 6. Assumptions, Dependencies & Acceptance Criteria

- **Dependencies:** [CELLULAR_NEUROSCIENCE.md](CELLULAR_NEUROSCIENCE.md), [SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md](../05-neurophysiology/SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md), [STUDIO_SPECIFICATIONS.md](../09-visualization/STUDIO_SPECIFICATIONS.md) (Studio C).
- **AC-MOL-001:** Every entity in `molecular-entities.json` declares molecular class, ion/ligand specificity, physiological mechanism, non-clinical boundary tag, and `REF-*` verification.

## 7. References

- `REF-HILLE-2001`: Hille (2001), *Ion Channels of Excitable Membranes* (3rd ed.).
- `REF-GOLDMAN-1943`: Goldman (1943), DOI: `10.1085/jgp.27.1.37`.
- `REF-HODGKIN-KATZ-1949`: Hodgkin & Katz (1949), DOI: `10.1113/jphysiol.1949.sp004310`.
- `REF-CATTERALL-2012`: Catterall (2012), DOI: `10.1113/jphysiol.2011.224204`.
- `REF-SUDHOF-2013`: Südhof (2013), DOI: `10.1016/j.neuron.2013.10.022`.
- `REF-TRAYNELIS-2010`: Traynelis et al. (2010), DOI: `10.1124/pr.109.002451`.
- `REF-SIGEL-2012`: Sigel & Steinmann (2012), DOI: `10.1074/jbc.R112.386664`.
