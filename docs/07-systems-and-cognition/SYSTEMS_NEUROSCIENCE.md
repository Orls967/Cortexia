# Systems Neuroscience Specification (Module 09) — CORTEXIA

**Document ID:** `DOC-SYS-001`  
**Module:** `MOD-09` (Systems Neuroscience)  
**Biological Scales:** `L6` Mesoscopic – `L9` Systems & Cognition  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the 12 core neural systems covered in **Module 09 — Systems Neuroscience**, establishing canonical sensory, motor, autonomic, homeostatic, and affective pathways, anatomical relay nodes, physiological transduction mechanisms, and computational model links.

---

## 2. Twelve Integrated Functional Brain Systems (`SYS-01` – `SYS-12`)

| System ID | Functional System | Canonical Anatomical Relay Pathway | Primary Physiological Mechanisms | Linked Computational Models |
|---|---|---|---|---|
| `SYS-VISUAL` | **Visual System** | `Retina (Photoreceptors → Bipolar → RGC) → Optic Chiasm/Tract → LGN → V1 (Calcarine) → Dorsal (V2/V5-MT/Parietal) & Ventral (V2/V4/IT)` | Phototransduction hyperpolarization, center-surround antagonism, V1 simple/complex orientation tuning (`REF-FELLEMAN-VANESSEN-1991`) | `MODEL-020` (FF cascade), `MODEL-023` (`BCM`/`Oja` V1 selectivity), `MODEL-018` (`Jansen–Rit` VEP) |
| `SYS-AUDITORY` | **Auditory System** | `Cochlea (Inner Hair Cells → Spiral Ganglion) → Cochlear Nuclei → Superior Olivary Complex → Inferior Colliculus → MGN → A1 (Heschl's Gyrus)` | Mechanoelectrical tip-link transduction, tonotopic frequency map, interaural time/level difference (`ITD`/`ILD`) coincidence detection | `MODEL-005` (`LIF` coincidence), `MODEL-027` (Phase-locking) |
| `SYS-SOMATOSENSORY` | **Somatosensory System** | *DCML:* `DRG (Aβ) → Gracile/Cuneate Nuclei → Medial Lemniscus → VPL Thalamus → S1 (Postcentral Gyrus, 3a/3b/1/2)` | Mechanosensitive Piezo2 channels, lateral inhibition, somatotopic homunculus, cortical barrel/columnar processing | `MODEL-021` (Balanced E/I barrel circuit) |
| `SYS-VESTIBULAR` | **Vestibular System** | `Semicircular Canals & Otoliths → Scarpa's Ganglion (CN VIII) → Vestibular Nuclei & Flocculonodular Cerebellum → CN III/IV/VI & Spinal Tracts` | Hair-cell stereocilia deflection, vestibulo-ocular reflex (`VOR`) gain adaptation, postural equilibrium | `MODEL-023` (Cerebellar VOR gain adaptation) |
| `SYS-OLFACTORY` | **Olfactory System** | `Olfactory Epithelium (OSNs, CN I) → Olfactory Bulb Glomeruli (Mitral/Tufted) → Piriform Cortex, Amygdala, Entorhinal Cortex` (direct cortical access bypassing thalamus) | Odorant GPCR (`Golf`–cAMP) transduction, glomerular chemotopic convergence + granule-cell dendrodendritic lateral inhibition | `MODEL-015` / `MODEL-021` (Bulb gamma/beta oscillatory inhibition) |
| `SYS-GUSTATORY` | **Gustatory System** | `Taste Buds (CN VII, IX, X) → Rostral Nucleus Tractus Solitarius (rNTS) → VPMpc Thalamus → Primary Gustatory Cortex (Anterior Insula / Frontal Operculum)` | Ionotropic (`Na+`/`H+`) and GPCR (`T1R`/`T2R`) taste transduction, multimodal flavor integration in OFC | `MODEL-017` (Population coding) |
| `SYS-MOTOR` | **Somatic Motor System** | `Premotor/SMA & M1 (Precentral Gyrus L5 Betz/Pyramidal) → Internal Capsule → Corticospinal/Corticobulbar Tracts → Spinal Interneurons & Alpha Motor Neurons` + Basal Ganglia & Cerebellar loops | Population vector coding, Henneman size principle motor-unit recruitment, basal ganglia action selection, cerebellar forward internal models | `MODEL-001` (`HH`), `MODEL-017` (`Wilson–Cowan`), `CIRC-BASAL-GANGLIA-LOOPS` |
| `SYS-AUTONOMIC` | **Autonomic Nervous System (`ANS`)** | `Hypothalamus (PVN) & NTS/RVLM → Sympathetic (IML T1–L2 → Chain Ganglia, NE) & Parasympathetic (CN III, VII, IX, X Vagus & S2–S4, ACh)` | Baroreceptor reflex, sympathetic fight-or-flight vs. vagal rest-and-digest homeostasis | `MODEL-002` (Autonomic pacemaker oscillations) |
| `SYS-PAIN` | **Pain & Nociceptive System** | *Anterolateral:* `DRG (Aδ/C Nociceptors) → Dorsal Horn (Laminae I/II/V) → Decussation → Spinothalamic Tract → VPL/Medial Thalamus → S1, Insula, ACC` + `PAG → RVM` descending modulation | `TRPV1`/`Na_v1.7/1.8` nociception, dorsal-horn wind-up & central sensitization, endogenous opioid/monoaminergic descending gate (`REF-BASBAUM-2009`) | `MODEL-014` (`NMDA` wind-up), `MODEL-012` (Gate-control E/I balance) |
| `SYS-SLEEP` | **Sleep & Arousal System** | `Ascending Arousal (LC-NE, Raphe-5HT, TMN-Histamine, LDT/PPT-ACh, Lateral Hypothalamic Orexin) ⇄ VLPO/MnPO GABAergic Sleep-Active Nuclei` + `SCN` circadian drive | Mutual inhibition "flip-flop" switch stabilized by orexin; NREM thalamocortical slow waves/spindles vs REM pontogeniculo-occipital (`PGO`) theta (`REF-SCAMMELL-2017`) | `MODEL-017` (Bistable flip-flop), `MODEL-018` (`Jansen–Rit` rhythm transition) |
| `SYS-EMOTION` | **Emotion & Defensive/Affective Circuits** | `Sensory Thalamus & Cortex → Basolateral Amygdala (BLA) → Central Amygdala (CeA) / BNST → Hypothalamus, PAG, Autonomic Nuclei` regulated by `vmPFC` & `ACC` | Pavlovian fear conditioning (`BLA` LTP), extinction via `vmPFC` intercalated GABA neurons, interoceptive salience in anterior insula | `MODEL-024` (`STDP` associative conditioning), `MODEL-017` (Prefrontal–amygdala gating) |
| `SYS-REWARD` | **Reward & Valuation System** | *Mesocorticolimbic:* `VTA Dopamine Neurons → Ventral Striatum (Nucleus Accumbens), Amygdala, vmPFC/OFC, dlPFC` modulated by Lateral Habenula (`LHb`) & RMTg | Phasic dopamine reward prediction error ($\delta_t$), incentive salience, striatal `D1/D2` value updating (`REF-SCHULTZ-1997`) | `MODEL-026` (`TD-RL` three-factor plasticity) |

---

## 3. Pathway Diagram & UCES Requirements

Each of the 12 systems in `MOD-09` renders:
1. **Interactive Multi-Node Pathway Schematic:** Clicking any relay node (`ANAT-*`) highlights its 3D location in Studio A and opens the UCES Inspector.
2. **Transduction & Synaptic Mechanism Strip:** Links the system's specialized receptors (`MOL-*`) and physiological processes (`MECH-*`).
3. **One-Click Computational Sandbox Launch:** Opens the paired `MODEL-*` preset in `ENV-02`.

## 4. Acceptance Criteria & References

- **AC-SYS-001:** All 12 systems are populated in `registries/functional-systems/functional-systems.json` with ordered anatomical relay chains, mechanisms, models, and verified references.
- `REF-FELLEMAN-VANESSEN-1991`: DOI `10.1093/cercor/1.1.1`
- `REF-BASBAUM-2009`: DOI `10.1016/j.cell.2009.09.028`
- `REF-SCAMMELL-2017`: DOI `10.1016/j.neuron.2017.01.014`
- `REF-SCHULTZ-1997`: DOI `10.1126/science.275.5306.1593`
