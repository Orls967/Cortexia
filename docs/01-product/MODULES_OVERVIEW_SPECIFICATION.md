# Twelve Primary Modules Overview Specification — CORTEXIA

**Document ID:** `DOC-PROD-007`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the scientific scope, functional boundary, required inputs/outputs, cross-module integrations, and detailed specification links for all twelve primary modules (`MOD-01` through `MOD-12`).

---

## 2. Module Specifications (`MOD-01` – `MOD-12`)

### Module 01 (`MOD-01`) — CORTEXIA Observatory
- **Primary Environment:** `ENV-01` (Explore Landing) · **Scales:** `L1`–`L9`
- **Scope:** Platform command observatory unifying whole-brain anatomical context, multi-scale concentric navigation wheel (`L1`–`L9`), 12 functional brain systems overview, featured curated experiments (`EXP-*`), recent entity history, and global scientific concept discovery.
- **Cross-Module Integration:** Deep-links into all 11 sibling modules; pulls live node counts and coverage summaries from Knowledge Graph (`MOD-12`).
- **Detailed Spec:** [APPLICATION_LAYOUT_AND_ENVIRONMENTS.md](../13-ui-ux/APPLICATION_LAYOUT_AND_ENVIRONMENTS.md), [MODULE_UX_SPECIFICATIONS.md](../13-ui-ux/MODULE_UX_SPECIFICATIONS.md#module-01--cortexia-observatory).

### Module 02 (`MOD-02`) — Neuroanatomy Atlas
- **Primary Environment:** `ENV-01` (Studio A) · **Scales:** `L6`–`L7`
- **Scope:** Cerebral hemispheres, lobes, gyri/sulci, cortex, basal ganglia, thalamus, hypothalamus, hippocampal formation, amygdala, limbic structures, cerebellum, brainstem, ventricular system, spinal cord, PNS, cranial nerves. Supports sagittal/coronal/axial clipping, isolation, relationship highlighting, atlas provenance, and TNA nomenclature.
- **Detailed Specs:** [NEUROANATOMY_SPECIFICATION.md](../03-neuroanatomy/NEUROANATOMY_SPECIFICATION.md), [ANATOMICAL_HIERARCHY_AND_ATLAS_PROVENANCE.md](../03-neuroanatomy/ANATOMICAL_HIERARCHY_AND_ATLAS_PROVENANCE.md).

### Module 03 (`MOD-03`) — Cellular Neuroscience
- **Primary Environment:** `ENV-01` (Studio B) · **Scales:** `L2`–`L3`
- **Scope:** Neuron morphology (soma, apical/basal dendrites, dendritic spines, axon initial segment, nodes of Ranvier, terminals), neuronal classes (pyramidal, PV/SST/VIP interneurons, sensory, motor, Purkinje, granule, medium spiny), all four CNS glial classes (astrocytes, oligodendrocytes, microglia, ependymal cells) plus Schwann cells, myelination, axonal transport (kinesin/dynein), and astrocytic–neuronal metabolic coupling.
- **Detailed Spec:** [CELLULAR_NEUROSCIENCE.md](../04-cellular-and-molecular/CELLULAR_NEUROSCIENCE.md).

### Module 04 (`MOD-04`) — Molecular & Neurochemical Systems
- **Primary Environment:** `ENV-01` (Studio C) · **Scales:** `L1`–`L2`
- **Scope:** Membrane proteins, voltage-gated channels ($Na_v, K_v, Ca_v$), ligand-gated receptors (AMPA, NMDA, Kainate, $GABA_A$, nicotinic ACh), metabotropic GPCRs, $Na^+/K^+/Ca^{2+}/Cl^-$ gradients, Nernst/GHK equilibrium, synaptic vesicle cycle, reuptake transporters, enzymatic degradation, second messengers ($cAMP/PKA, PLC/IP_3/DAG, Ca^{2+}/CaMKII$), and 8 neurotransmitter systems (Glutamate, GABA, Dopamine, Serotonin, ACh, Norepinephrine, Histamine, Neuropeptides). Strictly mechanistic/educational.
- **Detailed Spec:** [MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md](../04-cellular-and-molecular/MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md).

### Module 05 (`MOD-05`) — Synaptic Architecture & Plasticity
- **Primary Environment:** `ENV-01` & `ENV-02` (Studio C) · **Scales:** `L4`
- **Scope:** Chemical vs. electrical synapses, excitatory/inhibitory transmission, presynaptic release probability, postsynaptic density scaffolding, dendritic integration, short-term facilitation/depression, LTP/LTD, STDP, homeostatic synaptic scaling, and structural spine plasticity. Tightly coupled to `MOD-08` synaptic & plasticity simulators.
- **Detailed Spec:** [SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md](../05-neurophysiology/SYNAPTIC_ARCHITECTURE_AND_PLASTICITY.md).

### Module 06 (`MOD-06`) — Neural Circuits & Connectomics
- **Primary Environment:** `ENV-01` & `ENV-03` (Studio D) · **Scales:** `L5`, `L8`
- **Scope:** Local cortical microcircuits, E/I balance, feedforward/feedback/recurrent motifs, thalamocortical loops, hippocampal trisynaptic circuit, basal ganglia loops, cerebellar circuitry, structural connectomics, functional connectivity, and graph-theoretic topology. Enforces visual provenance badges separating empirical SC, estimated FC, and synthetic simulation graphs.
- **Detailed Spec:** [NEURAL_CIRCUITS_AND_CONNECTOMICS.md](../07-systems-and-cognition/NEURAL_CIRCUITS_AND_CONNECTOMICS.md).

### Module 07 (`MOD-07`) — Neurophysiology & Neural Dynamics
- **Primary Environment:** `ENV-01` & `ENV-02` · **Scales:** `L2`–`L6`
- **Scope:** Resting membrane potential, action potential initiation & propagation, refractory periods, membrane conductance, Hodgkin–Huxley gating kinetics, EPSP/IPSP integration, dendritic cable attenuation, excitability classes (Type I vs Type II), firing regimes, neural oscillations ($\delta, \theta, \alpha, \beta, \gamma$), and synchronization.
- **Detailed Spec:** [NEUROPHYSIOLOGY_AND_NEURAL_DYNAMICS.md](../05-neurophysiology/NEUROPHYSIOLOGY_AND_NEURAL_DYNAMICS.md).

### Module 08 (`MOD-08`) — Computational Neuroscience Laboratory
- **Primary Environment:** `ENV-02` (Laboratory) · **Scales:** `L1`–`L8`
- **Scope:** CORTEXIA's primary quantitative workspace featuring the 5-panel Simulation Workspace, 16 computational model families, 28 validated mathematical model implementations, explicit solvers (`RK4`, `Rush–Larsen`, `Euler–Maruyama`, exact/event-driven LIF/AdEx/Izhikevich), parameter sweeps, 5-tier Digital Twin coupled experiments, and reproducibility manifests.
- **Detailed Specs:** [MODEL_CATALOG.md](../06-computational-models/MODEL_CATALOG.md), [NEURON_MODELS.md](../06-computational-models/NEURON_MODELS.md), [DIGITAL_TWIN_ARCHITECTURE.md](../02-scientific-foundation/DIGITAL_TWIN_ARCHITECTURE.md).

### Module 09 (`MOD-09`) — Systems Neuroscience
- **Primary Environment:** `ENV-01` & `ENV-04` · **Scales:** `L7`–`L9`
- **Scope:** 12 integrated neural systems (Visual, Auditory, Somatosensory, Vestibular, Olfactory, Gustatory, Motor, Autonomic, Pain Processing, Sleep & Arousal, Emotion-Related Circuits, Reward Systems) with interactive pathway schematics, anatomical nodes, physiological mechanisms, and computational model links.
- **Detailed Spec:** [SYSTEMS_NEUROSCIENCE.md](../07-systems-and-cognition/SYSTEMS_NEUROSCIENCE.md).

### Module 10 (`MOD-10`) — Cognitive Neuroscience
- **Primary Environment:** `ENV-01` & `ENV-04` · **Scales:** `L8`–`L9`
- **Scope:** Memory encoding/consolidation/retrieval, working memory, attention & executive control, perception, decision-making, learning, language (dual-stream), emotion, cognitive control, and scientific theories of consciousness (GNW, IIT, Predictive Processing/Active Inference) framed with explicit epistemic boundaries against single-region localizationism.
- **Detailed Spec:** [COGNITIVE_NEUROSCIENCE.md](../07-systems-and-cognition/COGNITIVE_NEUROSCIENCE.md).

### Module 11 (`MOD-11`) — Neural Data & Signal Analytics
- **Primary Environment:** `ENV-03` (Analytics) · **Scales:** `L3`–`L8`
- **Scope:** Multichannel EEG/LFP viewer, FIR/IIR digital filtering, FFT, Welch PSD, STFT, Morlet wavelets, ERP averaging, spike raster/ISI/CV/Fano/PSTH/STA/cross-correlation, adjacency/graph topology metrics, descriptive/inferential statistics (bootstrap, permutation, FDR, regression, AIC/BIC), local CSV/JSON import, metadata/unit inspector, and causal-inference safeguards.
- **Detailed Spec:** [SIGNAL_ANALYTICS.md](../08-neural-data-and-analytics/SIGNAL_ANALYTICS.md).

### Module 12 (`MOD-12`) — Scientific Knowledge & Research Library
- **Primary Environment:** `ENV-04` & `ENV-05` · **Scales:** `L1`–`L9`
- **Scope:** Comprehensive encyclopedia, dedicated UCES knowledge pages (`/knowledge/:entityId`), typed Knowledge Graph explorer, mathematical equation repository, glossary, dataset catalog, verified bibliography, model validation reports, and Research Notebook management.
- **Detailed Specs:** [KNOWLEDGE_GRAPH_SPECIFICATION.md](../10-knowledge-architecture/KNOWLEDGE_GRAPH_SPECIFICATION.md), [SCIENTIFIC_KNOWLEDGE_LIBRARY.md](../10-knowledge-architecture/SCIENTIFIC_KNOWLEDGE_LIBRARY.md).

## 3. Acceptance Criteria & Related Documents

- **AC-PROD-007:** Every module `MOD-01`–`MOD-12` has an authoritative domain specification, a UX specification in [MODULE_UX_SPECIFICATIONS.md](../13-ui-ux/MODULE_UX_SPECIFICATIONS.md), and bidirectional Knowledge Graph integration.
- **Links:** [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md), [FEATURE_CATALOG.md](FEATURE_CATALOG.md).
