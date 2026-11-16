# Specialized Neuroscience Research Domains — CORTEXIA

**Document ID:** `DOC-SCI-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

Beyond core anatomy, cellular/molecular biophysics, circuits, systems, and cognition, CORTEXIA integrates **12 specialized research domains** into its Knowledge Library (`MOD-12`), Knowledge Graph, and cross-module annotations. This specification establishes the authoritative scientific scope, primary scales, cross-module links, and strict educational boundaries for each domain.

## 2. Summary Domain Matrix

| Domain ID | Research Domain | Primary Scales | Linked Modules | Epistemic & Clinical Boundary |
|---|---|---|---|---|
| `DOM-DEV` | Developmental Neuroscience | `L1`–`L7` | `MOD-02`, `MOD-03`, `MOD-12` | Human fetal/postnatal staging descriptive; no clinical developmental screening |
| `DOM-NEUROGEN` | Neurogenesis | `L2`–`L6` | `MOD-03`, `MOD-02`, `MOD-12` | Explicitly distinguishes embryonic neurogenesis vs. ongoing scientific debate in adult human hippocampus |
| `DOM-PLAST` | Neuroplasticity | `L1`–`L8` | `MOD-05`, `MOD-08`, `MOD-10` | Links Hebbian/STDP/structural remodeling to learning limits |
| `DOM-IMMUNO` | Neuroimmunology | `L1`–`L7` | `MOD-03`, `MOD-04`, `MOD-12` | Mechanistic microglia, complement pruning & BBB immunity; non-diagnostic |
| `DOM-VASC` | Neurovascular Biology | `L2`–`L8` | `MOD-03`, `MOD-09`, `MOD-11` | Explains neurovascular unit (NVU) basis of BOLD fMRI hemodynamic lag |
| `DOM-CP` | Computational Psychiatry (Educational) | `L1`–`L9` | `MOD-08`, `MOD-10`, `MOD-12` | **Strictly educational theory** (e.g., aberrant prediction error / E/I shift models); never diagnostic |
| `DOM-MOD` | Neuromodulation | `L1`–`L9` | `MOD-04`, `MOD-08`, `MOD-09` | Ascending monoaminergic/cholinergic nuclei altering gain, plasticity & state |
| `DOM-CIRC` | Circadian Neuroscience | `L1`–`L9` | `MOD-02`, `MOD-04`, `MOD-09` | SCN molecular TTFL clock + VLPO/orexin sleep-wake flip-flop |
| `DOM-COMP` | Comparative Neuroscience | `L3`–`L9` | `MOD-02`, `MOD-03`, `MOD-12` | Cross-species scaling (squid axon, C. elegans, rodent, primate) contextualizing model provenance |
| `DOM-TECH` | Neurotechnology | `L3`–`L9` | `MOD-11`, `MOD-07`, `MOD-12` | Electrophysiology, EEG, patch-clamp, optogenetics, BCI signal decoding principles & limits |
| `DOM-LEARN` | Learning & Memory | `L4`–`L9` | `MOD-05`, `MOD-08`, `MOD-10` | Bridges synaptic weight rules (`MODEL-STDP`, `MODEL-TD-RL`) with hippocampal–neocortical consolidation |
| `DOM-THEORY` | Theoretical Neuroscience | `L1`–`L9` | `MOD-08`, `MOD-10`, `MOD-12` | Efficient coding, Bayesian inference, predictive coding, attractor dynamics, information theory |

---

## 3. Detailed Domain Specifications

### 3.1 Developmental Neuroscience (`DOM-DEV`)
- **Scientific Scope:** Neural plate induction, neurulation, neural tube patterning (BMP/Shh/Wnt gradients), radial glia migration, axon guidance (netrins, slits, semaphorins, ephrins), synaptogenesis, and activity-dependent pruning (`REF-SILBEREIS-2016`).
- **Integration:** Links embryonic vesicles (prosencephalon, mesencephalon, rhombencephalon) to adult anatomical hierarchy in `MOD-02`.

### 3.2 Neurogenesis (`DOM-NEUROGEN`)
- **Scientific Scope:** Asymmetric division of neural stem/progenitor cells in ventricular/subventricular zones; adult hippocampal dentate gyrus subgranular zone (`SGZ`) neurogenesis (`REF-GAGE-2019`).
- **Epistemic Guardrail:** Explicitly documents ongoing methodological debate regarding the magnitude of adult human hippocampal neurogenesis across post-mortem fixation studies versus single-nucleus transcriptomics.

### 3.3 Neuroplasticity (`DOM-PLAST`)
- **Scientific Scope:** Activity-dependent functional and structural adaptation across short-term (`ms–s`), early/late LTP & LTD (`min–days`), homeostatic synaptic scaling (`hours–days`, `REF-TURRIGIANO-2008`), dendritic spine morphogenesis, and experience-dependent cortical map reorganization.
- **Model Link:** Coupled to `MODEL-STP-TM`, `MODEL-STDP-PAIR`, `MODEL-BCM`, and `MODEL-HOMEOSTATIC-SCALING`.

### 3.4 Neuroimmunology (`DOM-IMMUNO`)
- **Scientific Scope:** Microglial homeostatic surveillance, purinergic chemotaxis, classical complement cascade (`C1q/C3`) synaptic pruning, reactive astrogliosis, meningeal lymphatic drainage, and adaptive T-cell/CSF cytokine signaling across CNS borders (`REF-KIPNIS-2016`, `REF-RANSOHOFF-2016`).
- **Guardrail:** Explicitly rejects simplistic binary "M1/M2" microglial dichotomies and avoids clinical therapeutic claims.

### 3.5 Neurovascular Biology (`DOM-VASC`)
- **Scientific Scope:** The Neurovascular Unit (NVU)—endothelial tight junctions (blood–brain barrier), pericytes, astrocytic endfeet, vascular smooth muscle, and perivascular spaces—mediating functional hyperemia (`REF-IADECOLA-2017`).
- **Analytics Bridge:** Explains why BOLD fMRI measures slow (`~4–6 s` hemodynamic response) metabolic/vascular correlates of local field potentials rather than direct spike rates.

### 3.6 Computational Psychiatry — Educational Scope (`DOM-CP`)
- **Scientific Scope:** Quantitative frameworks modeling how perturbations in E/I balance, NMDA conductance, dopaminergic reward prediction error (`REF-HUYS-2016`, `REF-SCHULTZ-1997`), or precision-weighted Bayesian belief updating alter simulated task behavior or circuit synchrony.
- **Mandatory Non-Clinical Disclaimer:** Every Computational Psychiatry page and model preset displays a prominent notice: *"Educational theoretical models exploring mechanistic hypotheses; NOT a diagnostic tool and incapable of explaining or predicting individual clinical syndromes."*

### 3.7 Neuromodulation (`DOM-MOD`)
- **Scientific Scope:** Volume transmission and gain modulation via ascending brainstem/basal forebrain nuclei: Ventral Tegmental Area / Substantia Nigra (`Dopamine`), Locus Coeruleus (`Norepinephrine`), Raphe Nuclei (`Serotonin`), Nucleus Basalis (`Acetylcholine`), Tuberomammillary Nucleus (`Histamine`), and Hypothalamic Orexin.

### 3.8 Circadian Neuroscience (`DOM-CIRC`)
- **Scientific Scope:** Suprachiasmatic nucleus (SCN) master pacemaker driven by `CLOCK:BMAL1` / `PER:CRY` transcriptional–translational feedback loops (`~24 h` period, `REF-TAKAHASHI-2017`), retinohypothalamic melanopsin entrainment, and coupling to VLPO/monoaminergic sleep–wake switching (`REF-SCAMMELL-2017`).

### 3.9 Comparative Neuroscience (`DOM-COMP`)
- **Scientific Scope:** Clarifies biological provenance of classic models: why Hodgkin–Huxley parameters derive from *Loligo* squid giant axon ($6.3\ ^\circ\text{C}$), Morris–Lecar from barnacle muscle fiber, STDP experiments from rodent hippocampal cultures, and anatomical atlases from *Homo sapiens*. Prevents naive cross-species parameter conflation.

### 3.10 Neurotechnology (`DOM-TECH`)
- **Scientific Scope:** Biophysical basis and trade-offs of recording/stimulation modalities: intracellular patch-clamp, extracellular tetrodes/Neuropixels, ECoG, scalp EEG (spatial smearing through skull, `REF-BUZSAKI-2012`), fMRI, two-photon calcium imaging, optogenetics, and closed-loop BCI principles (`REF-WOLPAW-2002`).

### 3.11 Learning & Memory (`DOM-LEARN`)
- **Scientific Scope:** Complementary learning systems (fast hippocampal pattern separation/completion vs. slow neocortical statistical consolidation, `REF-SQUIRE-2004`), procedural striatal reinforcement learning (`MODEL-TD-RL`), and working-memory persistent/dynamic attractor hypotheses.

### 3.12 Theoretical Neuroscience (`DOM-THEORY`)
- **Scientific Scope:** Mathematical frameworks for neural computation: Shannon mutual information & neural coding (`REF-DAYAN-2001`), efficient/sparse coding, predictive coding & variational free energy (`REF-FRISTON-2010`), balanced chaos (`REF-VANVREESWIJK-1996`), and dynamical-systems bifurcations.

## 4. Assumptions, Dependencies & Acceptance Criteria

- **Dependencies:** [NEUROSCIENCE_SCOPE_AND_SCALES.md](NEUROSCIENCE_SCOPE_AND_SCALES.md), [SCIENTIFIC_KNOWLEDGE_LIBRARY.md](../10-knowledge-architecture/SCIENTIFIC_KNOWLEDGE_LIBRARY.md).
- **AC-SCI-002:** All 12 specialized domains appear as navigable categories in `MOD-12`, link to verified `REF-*` entries, and display explicit epistemic/non-clinical disclaimers where applicable.

## 5. References

- `REF-SILBEREIS-2016`: DOI `10.1016/j.neuron.2015.12.008`
- `REF-GAGE-2019`: DOI `10.1126/science.aav6885`
- `REF-IADECOLA-2017`: DOI `10.1016/j.neuron.2017.07.030`
- `REF-KIPNIS-2016`: DOI `10.1126/science.aag2638`
- `REF-HUYS-2016`: DOI `10.1038/nn.4238`
- `REF-TAKAHASHI-2017`: DOI `10.1038/nrg.2016.150`
- `REF-WOLPAW-2002`: DOI `10.1016/s1388-2457(02)00057-3`
- `REF-FRISTON-2010`: DOI `10.1038/nrn2787`
