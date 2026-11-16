# Neural Circuits & Connectomics Specification (Module 06) — CORTEXIA

**Document ID:** `DOC-CIRC-001`  
**Module:** `MOD-06` (Neural Circuits & Connectomics)  
**Biological Scales:** `L5` Microcircuit, `L6` Mesoscopic, `L8` Whole-Brain Networks  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the canonical local microcircuits, long-range functional loops, connectomic graph matrices, and strict connectivity-provenance distinctions governing **Module 06 — Neural Circuits & Connectomics**.

## 2. Canonical Microcircuit Motifs (`L5`)

1. **Feedforward Excitation & Feedforward Inhibition:** External afferent excites both principal glutamatergic neuron and local `PV+` basket interneuron, creating a narrow `~1–3 ms` temporal integration window for coincidence detection.
2. **Feedback (Recurrent) Inhibition:** Principal neurons excite local `PV+` or `SST+` interneurons that project back to inhibit the principal population, stabilizing gain and pacing gamma (`PING`) oscillations.
3. **Lateral Inhibition:** Active principal column suppresses neighboring columns via surround inhibitory projections, sharpening sensory tuning curves.
4. **Disinhibitory Motif (`VIP+ → SST+ → Pyramidal`):** Top-down or cholinergic recruitment of `VIP+` interneurons inhibits `SST+` dendritic-targeting interneurons, releasing pyramidal apical tufts to gate plasticity (`REF-DOUGLAS-MARTIN-2004`).

---

## 3. Five Major Regional & Loop Architectures (`L5`–`L7`)

### 3.1 Neocortical Canonical Microcircuit (`CIRC-CORTICAL-CANONICAL`, `REF-DOUGLAS-MARTIN-2004`)
- **Thalamic Input:** Core thalamic relay afferents terminate primarily in **Layer 4** (`L4` spiny stellate cells).
- **Intracolumnar Flow:** `L4 → L2/3 pyramidal → L5 pyramidal → L6 corticothalamic → L4` (with dense recurrent E/I loops inside `L2/3` and `L5`).
- **Feedforward vs. Feedback Hierarchy (`REF-FELLEMAN-VANESSEN-1991`):** Feedforward projections originate in superficial (`L2/3`) layers and target `L4`; feedback projections originate in deep (`L5/6`) layers and target `L1` and `L6`.

### 3.2 Thalamocortical Loop (`CIRC-THALAMOCORTICAL`)
- Reciprocal glutamatergic loop between Thalamocortical Relay nuclei (`TC`), Neocortex (`L4`/`L6`), and GABAergic **Thalamic Reticular Nucleus (`TRN`)** collateral shield; generates sleep spindles (`11–16 Hz`), alpha rhythms (`8–12 Hz`), and slow-wave oscillations.

### 3.3 Hippocampal Trisynaptic Circuit (`CIRC-HIPP-TRISYNAPTIC`)
- `Entorhinal Cortex (L2)` $\xrightarrow{\text{Perforant Path}}$ `Dentate Gyrus Granule Cells` $\xrightarrow{\text{Mossy Fibers}}$ `CA3 Pyramidal (Recurrent Auto-Associative)` $\xrightarrow{\text{Schaffer Collaterals}}$ `CA1 Pyramidal` $\to$ `Subiculum` $\to$ `Deep Entorhinal Cortex (L5/6)`.

### 3.4 Cortico-Basal Ganglia-Thalamo-Cortical Loops (`CIRC-BASAL-GANGLIA-LOOPS`, `REF-ALEXANDER-1986`)
- **Direct Pathway ("Go"):** `Cortex → Striatum (D1 MSN) ⊣ GPi/SNr ⊣ Ventral Anterior/Lateral Thalamus → Motor Cortex` (net disinhibition of thalamus).
- **Indirect Pathway ("No-Go"):** `Cortex → Striatum (D2 MSN) ⊣ GPe ⊣ STN → GPi/SNr ⊣ Thalamus` (net suppression of movement).
- **Hyperdirect Pathway (Global Stop):** `Frontal Cortex → STN → GPi/SNr ⊣ Thalamus`.

### 3.5 Cerebellar Cortico-Nuclear Microzone (`CIRC-CEREBELLAR-LOOP`)
- `Mossy Fibers → Granule Cells → Parallel Fibers → Purkinje Cells` modulated by `Inferior Olive Climbing Fibers` teaching error signals; `Purkinje Cells (GABA) ⊣ Deep Cerebellar Nuclei → Thalamus / Red Nucleus`.

---

## 4. Connectomics & Mandatory Provenance Classification (`L8`)

> [!CAUTION]
> **Strict Epistemic Rule:** CORTEXIA's UI, Studio D 3D viewer, and data schemas (`schemas/pathways/neural-pathway.schema.json`) MUST never conflate structural, functional, and synthetic connections. Every connectivity matrix and graph edge displays one of three mandatory provenance badges:

| Edge Provenance Class | Physical / Mathematical Meaning | Directionality & Sign | Valid Inference Boundary |
|---|---|---|---|
| `EMPIRICAL_STRUCTURAL` (`SC`) | Physical axonal tracts measured via histological tracing, EM, or diffusion MRI tractography (`REF-SPORNS-2005`) | Directed (tract-tracing) or Undirected (dMRI streamline density $\ge 0$) | Constrains anatomical communication paths and conduction delays; does not prove active task engagement |
| `ESTIMATED_FUNCTIONAL` (`FC`) | Statistical dependency (Pearson $r$, partial correlation, coherence, PLV) between time series | Undirected statistical association ($r \in [-1, 1]$ or $\text{PLV} \in [0, 1]$) | **Correlation $\neq$ Causation.** High FC between $A$ and $B$ may arise from common input $C$ without direct anatomical projection |
| `SYNTHETIC_SIMULATION` | Algorithmically generated adjacency matrix (`Erdős–Rényi`, `Watts–Strogatz`, `Brunel`, or user-edited graph) | User-specified weights & signs ($E/I$) | Strictly in-silico hypothesis exploration; not biological reference data |

## 5. Interactive Features in Module 06

- **Dual Graph & Matrix Inspector:** Synchronized 3D/2D node-link graph (`Studio D`) and reorderable $N \times N$ adjacency heatmap (ordered by hemisphere, lobe, or Louvain community module).
- **SC vs. FC Comparison View:** Side-by-side matrix diff and scatter plot of $W_{ij}^{\text{SC}}$ vs. $\text{FC}_{ij}$ (`MODEL-028`).
- **Topology Metrics Bar:** Live computation of degree, strength, betweenness centrality, clustering coefficient, characteristic path length, modularity $Q$, and small-worldness $\sigma_{\text{SW}}$ (`REF-RUBINOV-2010`).

## 6. Acceptance Criteria & References

- **AC-CIRC-001:** Every circuit and connectome dataset in `circuits-and-pathways.json` carries an explicit provenance class, node/edge entity mappings, and UCES inspector documentation.
- `REF-DOUGLAS-MARTIN-2004`: DOI `10.1146/annurev.neuro.27.070203.144152`
- `REF-ALEXANDER-1986`: DOI `10.1146/annurev.ne.09.030186.002041`
- `REF-SPORNS-2005`: DOI `10.1371/journal.pcbi.0010042`
- `REF-BULLMORE-2009`: DOI `10.1038/nrn2575`
- `REF-RUBINOV-2010`: DOI `10.1016/j.neuroimage.2009.10.003`
