# Cellular Neuroscience Specification (Module 03) — CORTEXIA

**Document ID:** `DOC-CELL-001`  
**Module:** `MOD-03` (Cellular Neuroscience)  
**Biological Scales:** `L2` Subcellular, `L3` Cellular  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Document Purpose and Scope

This specification defines the biological entities, subcellular structures, neuronal and glial classifications, transport/metabolic processes, and interactive Studio B visualizations covered by **Module 03 — Cellular Neuroscience**.

## 2. Subcellular & Morphological Components (`L2`)

Every neuronal representation in Studio B and the `cellular-entities` registry maps inspectable structural compartments:
1. **Soma (Perikaryon):** Nucleus, Nissl bodies (rough ER), Golgi apparatus, somatic mitochondria, metabolic integration center.
2. **Dendritic Tree:** Apical and basal dendrites, oblique branches, high surface-area receptive field carrying passive/active cable properties.
3. **Dendritic Spines:** Mushroom, thin, stubby, and filopodial morphologies housing the postsynaptic density (`PSD`), actin cytoskeleton, AMPA/NMDA receptors, and calcium microdomains.
4. **Axon Initial Segment (AIS):** Specialized `~20–60 µm` ankyrin-G scaffold enriched with dense voltage-gated $Na_v1.2/Na_v1.6$ channels; canonical site of action potential initiation.
5. **Axon & Nodes of Ranvier:** Conducting fiber with internodal myelin sheaths separated by unmyelinated nodes enriched with $Na_v$ channels and paranodal septate junctions.
6. **Presynaptic Bouton / Terminal:** Active zone, voltage-gated $Ca_v2.1/2.2$ channels, docked synaptic vesicles, local mitochondria.

---

## 3. Neuronal Cell Classes (`L3`)

| Cell ID | Class | Neurotransmitter | Key Morphology & Electrophysiological Signature |
|---|---|---|---|
| `CELL-PYRAMIDAL-L23` | Cortical L2/3 Pyramidal | Glutamate | Apical tuft to L1; regular spiking with spike-frequency adaptation |
| `CELL-PYRAMIDAL-L5` | Cortical L5 Thick-Tufted Pyramidal | Glutamate | Prominent apical dendrite, subcortical corticofugal axon; intrinsic bursting / regular spiking |
| `CELL-PYRAMIDAL-CA1` | Hippocampal CA1 Pyramidal | Glutamate | Stratum radiatum/oriens arbor; Schaffer collateral target; classic LTP model cell |
| `CELL-PYRAMIDAL-CA3` | Hippocampal CA3 Pyramidal | Glutamate | Thorny excrescences receiving mossy fibers; dense recurrent auto-associative collaterals |
| `CELL-GRANULE-DG` | Dentate Gyrus Granule Cell | Glutamate | Dense dendritic fan in molecular layer; sparse firing, mossy fiber giant boutons |
| `CELL-INTERNEURON-PV` | Parvalbumin (`PV+`) Fast-Spiking Basket/Chandelier | GABA | Aspiny dendrites, perisomatic/AIS targeting; narrow spikes, high-frequency non-adapting firing; gamma generator |
| `CELL-INTERNEURON-SST` | Somatostatin (`SST+`) Martinotti | GABA | Targets distal apical dendrites of pyramidal neurons; low-threshold spiking, feedback dendritic inhibition |
| `CELL-INTERNEURON-VIP` | Vasoactive Intestinal Peptide (`VIP+`) | GABA | Preferentially inhibits `SST+` and `PV+` interneurons (canonical disinhibitory motif) |
| `CELL-PURKINJE` | Cerebellar Purkinje Neuron | GABA | Planar massive dendritic fan receiving ~150k parallel fibers & 1 climbing fiber; tonic simple spikes + complex spikes |
| `CELL-GRANULE-CEREB` | Cerebellar Granule Cell | Glutamate | Smallest & most numerous CNS neurons; T-shaped parallel fiber axons |
| `CELL-MSN-D1` / `D2` | Striatal Medium Spiny Neuron (`D1` / `D2`) | GABA | Dense dendritic spines; hyperpolarized down-state (`~-85 mV`) and up-state transitions |
| `CELL-MOTOR-ALPHA` | Spinal Alpha Motor Neuron | Acetylcholine | Large multipolar ventral-horn soma; myelinated motor axon innervating extrafusal skeletal muscle |
| `CELL-SENSORY-DRG` | Primary Somatosensory Pseudounipolar Neuron | Glutamate | Soma in dorsal root ganglion; peripheral mechano/nociceptive transducer + central dorsal horn branch |
| `CELL-RETINAL-GANGLION` | Retinal Ganglion Cell (M/P/ipRGC) | Glutamate | Only retinal output neuron forming optic nerve; center-surround receptive fields |
| `CELL-THALAMOCORTICAL` | Thalamocortical Relay Neuron | Glutamate | Dual firing modes: tonic single-spike relay vs. T-type $Ca^{2+}$ low-threshold burst mode |

---

## 4. Glial Cell Architecture (`L3`)

CORTEXIA treats glia as active participants in neural function rather than passive glue:

| Glial Class | Primary Functions | Key Mechanisms & Structures |
|---|---|---|
| **Protoplasmic & Fibrous Astrocytes** | $K^+$ spatial buffering (Kir4.1), glutamate clearance (`EAAT1/EAAT2`), lactate shuttle, neurovascular endfeet, tripartite synapse modulation (`REF-ARAQUE-1999`) | Perisynaptic processes, connexin-43 gap-junction syncytium, aquaporin-4 endfeet |
| **Oligodendrocytes** | CNS axonal myelination (up to 30–50 internodes per cell); metabolic axon support via monocarboxylate transporters (`MCT1`) | Concentric myelin lamellae (`MBP`, `PLP`), paranodal loops |
| **Schwann Cells** | PNS myelination (1 internode per cell) & unmyelinated Remak bundles; axonal regeneration guidance | Basal lamina, Schmidt–Lanterman incisures |
| **Microglia** | Continuous parenchymal surveillance, debris phagocytosis, complement-mediated (`C1q/C3`) developmental synapse pruning, cytokine signaling (`REF-RANSOHOFF-2016`) | Ramified motile processes, amoeboid reactive continuum |
| **Ependymal Cells** | Single-layered ciliated epithelial lining of ventricles & spinal central canal; CSF circulation & barrier interface | Apical motile cilia, tanycytes in hypothalamic third ventricle |

---

## 5. Myelination, Axonal Transport & Cellular Metabolism

1. **Myelination & Saltatory Conduction:** Myelin decreases effective internodal membrane capacitance $C_m$ and increases transverse membrane resistance $R_m$, expanding space constant $\lambda$ and boosting conduction velocity (`~1–120 m/s` vs `~0.5–2 m/s` unmyelinated).
2. **Axonal Transport:** Bidirectional microtubule tracks (`+` end outward):
   - *Fast Anterograde* (`~50–400 mm/day`, **kinesin**): synaptic vesicle precursors, mitochondria, membrane channels.
   - *Fast Retrograde* (`~50–250 mm/day`, **cytoplasmic dynein**): neurotrophin signaling endosomes, autophagosomes.
   - *Slow Transport* (`~0.1–8 mm/day`): cytoskeletal polymers (neurofilaments, tubulin) & cytosolic enzymes.
3. **Cellular Metabolism:** Brain accounts for `~20%` of resting organismal $O_2$/glucose consumption (`~2%` body mass); high ATP demand primarily driven by $Na^+/K^+$-ATPase restoring ionic gradients post-spiking and postsynaptic currents (`REF-KANDEL-2021`).

## 6. Assumptions, Dependencies & Acceptance Criteria

- **Dependencies:** [STUDIO_SPECIFICATIONS.md](../09-visualization/STUDIO_SPECIFICATIONS.md) (Studio B), [MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md](MOLECULAR_AND_NEUROCHEMICAL_SYSTEMS.md), `registries/cellular-entities/cellular-entities.json`.
- **AC-CELL-001:** Every neuronal and glial cell class in `cellular-entities.json` contains morphological descriptors, neurotransmitter/function tags, scale anchors (`L2`/`L3`), UCES explanation payloads, and `REF-*` citations.

## 7. References

- `REF-KANDEL-2021`: Kandel et al. (2021), *Principles of Neural Science* (6th ed.).
- `REF-ARAQUE-1999`: Araque et al. (1999), *Trends in Neurosciences*, DOI: `10.1016/S0166-2236(98)01349-6`.
- `REF-RANSOHOFF-2016`: Ransohoff (2016), *Science*, DOI: `10.1126/science.aag2590`.
- `REF-NEUROMORPHO-2007`: Ascoli et al. (2007), *NeuroMorpho.Org*, *J. Neurosci.*.
