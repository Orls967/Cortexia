# Cognitive Neuroscience Specification (Module 10) — CORTEXIA

**Document ID:** `DOC-COG-001`  
**Module:** `MOD-10` (Cognitive Neuroscience)  
**Biological Scales:** `L8` Whole-Brain Networks, `L9` Systems & Cognition  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the scientific domains, distributed network architectures, computational links, and mandatory epistemic guardrails for **Module 10 — Cognitive Neuroscience**.

> [!WARNING]
> **Anti-Localization & Epistemic Integrity Mandate:**
> 1. Complex cognitive functions (memory, attention, language, decision-making, emotion, cognitive control) emerge from **distributed, dynamically interacting large-scale brain networks**, NEVER from a single isolated brain region ("phrenological localization fallacy").
> 2. Every cognitive specification in CORTEXIA MUST explicitly categorize statements into:
>    - `ESTABLISHED` — Replicated empirical findings across lesion, electrophysiology, and neuroimaging studies.
>    - `ACTIVE_RESEARCH` — Competing mechanistic accounts under active investigation.
>    - `THEORETICAL_HYPOTHESIS` — Formal mathematical or philosophical frameworks (especially theories of consciousness).

---

## 2. Core Cognitive Domains & Distributed Networks (`COG-01` – `COG-11`)

| Concept ID | Cognitive Domain | Distributed Anatomical Network (`L7`–`L8`) | Established Mechanisms vs. Active Debate | Linked Computational Models |
|---|---|---|---|---|
| `COG-MEMORY-ENC-RET` | **Episodic Memory Encoding & Retrieval** | Hippocampal formation (`DG`, `CA3`, `CA1`, Subiculum), Entorhinal/Parahippocampal/Perirhinal cortices, Anterior/Mediodorsal Thalamus, Retrosplenial/PCC, Prefrontal Cortex (`REF-SQUIRE-2004`) | *Established:* Medial temporal lobe necessity for new episodic encoding; theta/sharp-wave ripple replay. *Debate:* Standard consolidation theory vs. Multiple Trace / Trace Transformation theories. | `MODEL-024` (`STDP`), `MODEL-021` (`CA3` recurrent attractor) |
| `COG-MEMORY-LT` | **Long-Term Memory Systems Taxonomy** | Declarative (Medial Temporal → Neocortex) vs. Non-Declarative: Procedural (`Striatum`, `Cerebellum`, `Motor Cortex`), Priming (`Neocortex`), Conditioning (`Amygdala`, `Cerebellum`) (`REF-SQUIRE-2004`) | *Established:* Double dissociations between amnesic hippocampal lesions and intact striatal skill learning. | `MODEL-023` (`Hebbian`/`BCM`), `MODEL-026` (`TD-RL`) |
| `COG-WORKING-MEMORY` | **Working Memory** | Frontoparietal Network (`dlPFC`, `FEF`, `Intraparietal Sulcus`), Sensory Cortices, Mediodorsal Thalamus, Basal Ganglia gating (`REF-BADDELEY-2003`, `REF-MILLER-COHEN-2001`) | *Debate:* Persistent delay-period spiking (`NMDA` recurrent attractors) vs. activity-silent short-term synaptic facilitation (`STP`) & theta–gamma bursts. | `MODEL-017` (`WC` bistable), `MODEL-016` (`STP`), `MODEL-019` (`Wong–Wang`) |
| `COG-ATTENTION` | **Attention & Orienting Networks** | *Dorsal Attention:* `FEF + IPS/SPL` (goal-directed). *Ventral Attention:* `TPJ + VFC/AI` (stimulus-driven reorienting). *Alerting/Executive:* `LC-NE`, `ACC`, `Pulvinar` (`REF-CORBETTA-SHULMAN-2002`, `REF-PETERSEN-POSNER-2012`) | *Established:* Biased competition and multiplicative/additive gain modulation of sensory tuning curves + alpha suppression in attended hemifield. | `MODEL-021` (Gain-modulated E/I competition) |
| `COG-PERCEPTION` | **Perception & Hierarchical Inference** | Primary & association sensory cortices (`V1–IT`, `A1–STG`, `S1–S2`), Thalamocortical loops, Parietal/Frontal top-down projections | *Established:* Feedforward feature extraction + massive feedback modulation. *Active Research:* Predictive coding precision-weighted prediction errors (`REF-FRISTON-2010`). | `MODEL-020` (`FF`), `MODEL-018` (`Jansen–Rit`) |
| `COG-DECISION` | **Perceptual & Value-Based Decision-Making** | `LIP/IPS`, `dlPFC`, `FEF`, `vmPFC/OFC`, `ACC`, `Striatum`, `STN`, `Superior Colliculus` | *Established:* Ramping neural activity accumulating sensory evidence toward a decision bound (`Drift-Diffusion` / Attractor dynamics). | `MODEL-019` (`Wong–Wang` competing attractor) |
| `COG-LEARNING` | **Reinforcement, Supervised & Unsupervised Learning** | Cortico-striatal-dopaminergic loops (`VTA/SNc`), Cerebellar climbing-fiber error circuits, Neocortical sensory hierarchies | *Established:* Dopaminergic RPE signaling (`REF-SCHULTZ-1997`); cerebellar motor error correction. *Debate:* Biological plausibility of credit assignment in deep cortical hierarchies. | `MODEL-026` (`TD-RL`), `MODEL-023` (`Oja`/`BCM`), `MODEL-024` (`STDP`) |
| `COG-LANGUAGE` | **Language & Speech Processing** | **Dual-Stream Architecture (`REF-HICKOK-POEPPEL-2007`):** Bilateral superior temporal gyrus (`STG/STS` spectrotemporal/phonological); *Ventral Stream* (`MTG/ITG → aSTG/IFG` lexical-semantic comprehension); *Dorsal Stream* (`Spt → IPL → Premotor/Posterior IFG Broca's complex` via arcuate fasciculus) | *Established:* Rejects classic isolated "Broca = pure production / Wernicke = pure comprehension" localizationism; network damage to underlying white matter (`arcuate/SLF`) critically shapes aphasia profiles. | `MODEL-028` (Connectome hub & tract lesion propagation) |
| `COG-EMOTION-REG` | **Emotion Generation & Cognitive Reappraisal** | `BLA/CeA`, `Anterior Insula`, `sgACC/dACC`, `vmPFC`, `vlPFC/dlPFC`, `PAG`, `Hypothalamus` | *Established:* Prefrontal top-down cognitive reappraisal modulates amygdala and autonomic reactivity; emotion involves distributed interoceptive construction. | `MODEL-017` (Top-down inhibitory population control) |
| `COG-CONTROL` | **Cognitive Control & Executive Function** | Frontoparietal Control Network (`dlPFC`, `rostral PFC`), Cingulo-Opercular / Salience Network (`dACC`, `Anterior Insula`), Basal Ganglia hyperdirect/indirect loops (`REF-MILLER-COHEN-2001`, `REF-RAICHLE-2015`) | *Established:* Active maintenance of task rules, conflict monitoring (`dACC`), response inhibition (`rIFG–STN`), and anticorrelation with Default Mode Network (`DMN`) during externally focused tasks. | `MODEL-019`, `MODEL-028` |
| `COG-CONSCIOUSNESS` | **Scientific Theories of Consciousness** | Thalamocortical system, Frontoparietal workspace, Posterior "Hot Zone" (`Temporo-Parieto-Occipital`), Brainstem arousal nuclei | **Strictly Framed as Competing Scientific Theories (`THEORETICAL_HYPOTHESIS`):**<br>1. *Global Neuronal Workspace (`GNW`, `REF-DEHAENE-CHANGEUX-2011`):* Late (`~300 ms`) non-linear ignition across frontoparietal long-range workspace.<br>2. *Integrated Information Theory (`IIT`, `REF-TONONI-2016`):* Irreducible cause-effect repertoire ($\Phi$) maximal in posterior cortical grid-like structures.<br>3. *Recurrent Processing / Predictive Processing (`REF-FRISTON-2010`):* Local sensory recurrent loops vs. hierarchical generative models. | `MODEL-017` (Bistable ignition), `MODEL-027` / `MODEL-028` (Large-scale integration) |

---

## 3. Acceptance Criteria & Related Documents

- **AC-COG-001:** Every cognitive domain in `MOD-10` displays multi-region network maps, explicit epistemic status tags (`ESTABLISHED` vs `ACTIVE_RESEARCH` vs `THEORETICAL_HYPOTHESIS`), and anti-localization notices.
- **Links:** [SYSTEMS_NEUROSCIENCE.md](SYSTEMS_NEUROSCIENCE.md), [NEURAL_CIRCUITS_AND_CONNECTOMICS.md](NEURAL_CIRCUITS_AND_CONNECTOMICS.md), [KNOWLEDGE_GRAPH_SPECIFICATION.md](../10-knowledge-architecture/KNOWLEDGE_GRAPH_SPECIFICATION.md).

## 4. References

- `REF-SQUIRE-2004`: DOI `10.1016/j.nlm.2004.06.005`
- `REF-BADDELEY-2003`: DOI `10.1038/nrn1201`
- `REF-CORBETTA-SHULMAN-2002`: DOI `10.1038/nrn755`
- `REF-PETERSEN-POSNER-2012`: DOI `10.1146/annurev-neuro-062111-150525`
- `REF-MILLER-COHEN-2001`: DOI `10.1146/annurev.neuro.24.1.167`
- `REF-HICKOK-POEPPEL-2007`: DOI `10.1038/nrn2113`
- `REF-RAICHLE-2015`: DOI `10.1146/annurev-neuro-071013-014030`
- `REF-DEHAENE-CHANGEUX-2011`: DOI `10.1016/j.neuron.2011.03.018`
- `REF-TONONI-2016`: DOI `10.1038/nrn.2016.44`
