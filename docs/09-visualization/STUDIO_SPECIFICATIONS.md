# Four 3D Visualization Studios Specification — CORTEXIA

**Document ID:** `DOC-VIS-002`  
**Module:** `MOD-02`–`MOD-06`, `MOD-08`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies the four dedicated 3D visualization studios in CORTEXIA (**Studio A: Whole Brain**, **Studio B: Cellular**, **Studio C: Synaptic & Molecular**, **Studio D: Neural Network**), detailing inspectable objects, camera presets, interactive controls, and UCES bindings.

---

## 2. Studio A — Whole Brain Studio (`MOD-02`, Scales `L6`–`L7`)

- **Inspectable Scene Hierarchy:**
  - Cerebral hemispheres (`Left`, `Right`), Cortical Lobes (`Frontal`, `Parietal`, `Temporal`, `Occipital`, `Insular`, `Limbic`), Major Gyri & Sulci.
  - Deep Subcortical Nuclei: Hippocampal formation (`DG, CA3, CA2, CA1, Subiculum`), Amygdala (`BLA, CeA`), Thalamus (`VPL, LGN, MGN, MD, Pulvinar, TRN`), Hypothalamus (`SCN, PVN`), Basal Ganglia (`Caudate, Putamen, NAc, GPe, GPi, STN, SNc/SNr`).
  - Brainstem (`Midbrain, Pons, Medulla`), Cerebellum (`Cortex, Deep Nuclei`), Ventricular System, Cranial Nerves (`CN I–XII`), Cervical Spinal Cord, Major White-Matter Tracts.
- **Interactive Controls:**
  - **Camera Presets:** `Anterior`, `Posterior`, `Left Lateral`, `Right Lateral`, `Superior (Dorsal)`, `Inferior (Ventral)`, `Medial Sagittal Split`, `Deep Limbic Focus`.
  - **Slicing & Opacity:** Sagittal/Coronal/Axial clipping planes (`-100 mm` to `+100 mm`), layer-group visibility toggles, outer-cortex ghosting slider (`0%–100%`), and anatomically bounded exploded-lobe view.
  - **Relationship Highlighting:** Toggle `ANATOMICAL_CONNECTION` tracts vs. `FUNCTIONALLY_ASSOCIATED_WITH` network overlays.

---

## 3. Studio B — Cellular Studio (`MOD-03`, Scales `L2`–`L3`)

- **Inspectable Cellular Scenes:**
  - **Neuronal Morphologies (SWC-driven & compartment-segmented):** Cortical L5 Pyramidal, Hippocampal CA1 Pyramidal, Parvalbumin (`PV+`) Fast-Spiking Basket Interneuron, Cerebellar Purkinje Cell, Spinal Alpha Motor Neuron, DRG Pseudounipolar Sensory Neuron.
  - **Glial & Microenvironment Scene:** Protoplasmic Astrocyte with perisynaptic & perivascular endfeet, Myelinating Oligodendrocyte wrapping multiple internodes, Ramified Microglia, Ependymal Ciliated Sheet.
  - **Subcellular Compartments:** Soma/Nucleus, Apical/Basal Dendrites, Dendritic Spines, Axon Initial Segment (`AIS`), Myelin Internodes, Nodes of Ranvier, Presynaptic Boutons, Microtubule Kinesin/Dynein Transport Tracks.
- **Interactive Controls:** Compartment isolation, saltatory vs. unmyelinated action-potential wave playback (`0.1×` to `2×` speed), dendritic electrotonic attenuation heatmap (`MODEL-010`), and morphometric measurement caliper (`µm`).

---

## 4. Studio C — Synaptic & Molecular Studio (`MOD-04`, `MOD-05`, Scales `L1`, `L2`, `L4`)

- **Inspectable Nanoscale Scene (`nm` scale):**
  - **Presynaptic Terminal:** Active zone scaffold, voltage-gated $Ca_v2.1/2.2$ channels, reserve & docked synaptic vesicles, `V-ATPase` / `VGLUT` / `VGAT` transporters, `SNARE` (`Synaptobrevin, Syntaxin-1, SNAP-25`) + `Synaptotagmin-1` fusion machinery.
  - **Synaptic Cleft (`~20 nm`) & Perisynaptic Astrocyte:** Diffusing neurotransmitter molecules, astrocytic `EAAT2` glutamate transporters, `AChE` enzymatic cleft clearance.
  - **Postsynaptic Spine & Membrane:** Postsynaptic density (`PSD-95`), `AMPA`, `NMDA` (with visible voltage-dependent $Mg^{2+}$ pore block), `$GABA_A$` chloride channel, metabotropic GPCRs (`D1/D2`, `mGluR`), `CaMKII` hexamers.
  - **Membrane Channel Cutaway:** Voltage-gated $Na_v$ (`m` activation gates + `h` inactivation ball) and $K_v$ (`n` gates) synchronized with `MODEL-001` Hodgkin–Huxley state trajectories.
- **Interactive Controls:** Step-by-step animated mechanism playback (`1. AP Arrival → 2. Ca2+ Influx → 3. SNARE Fusion → 4. Cleft Diffusion → 5. Receptor Opening → 6. Reuptake/LTP Insertion`), receptor state inspector, and Electrical Gap-Junction (`Connexon`) comparison toggle.

---

## 5. Studio D — Neural Network Studio (`MOD-06`, `MOD-08`, Scales `L5`, `L8`)

- **Inspectable Network Modes:**
  1. **Microcircuit 3D Graph (`L5`):** 3D/layered spatial arrangement of Excitatory (`cyan/blue pyramids`) and Inhibitory (`violet/amber spheres`) neurons (`N <= 4,000`) with directed synaptic edges, live spike pulses, and E/I population rate bars.
  2. **Whole-Brain Connectome Graph (`L8`):** 3D parcellated regional nodes anchored in MNI stereotaxic space inside a translucent brain hull, connected by weighted edges with mandatory provenance styling (`EMPIRICAL_STRUCTURAL` solid tubes, `ESTIMATED_FUNCTIONAL` dashed arcs, `SYNTHETIC_SIMULATION` dotted vectors).
- **Interactive Controls:** Node sizing by degree/betweenness/firing rate, edge weight threshold slider, community module coloring, targeted node lesion click-to-disable (`EXP-NET-ROBUSTNESS`), and synchronized adjacency matrix brushing.

## 6. Acceptance Criteria & Related Documents

- **AC-VIS-002:** Every selectable object across Studios A, B, C, and D maps to an immutable entity ID (`ANAT-*`, `CELL-*`, `MOL-*`, `MECH-*`, `CIRC-*`) and triggers the UCES hover/inspector/page pipeline.
- **Links:** [3D_ENGINE_SPECIFICATION.md](3D_ENGINE_SPECIFICATION.md), [ANATOMICAL_ASSET_SPECIFICATION.md](ANATOMICAL_ASSET_SPECIFICATION.md), [MULTI_SCALE_NAVIGATION.md](MULTI_SCALE_NAVIGATION.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](UNIVERSAL_EXPLANATION_SYSTEM.md).
