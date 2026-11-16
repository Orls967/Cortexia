# Scientific & Technical Glossary — CORTEXIA

**Document ID:** `DOC-GOV-003`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This glossary establishes canonical definitions across neuroanatomy, cellular/molecular biology, electrophysiology, computational modeling, connectomics, signal processing, and CORTEXIA software architecture. All specifications and UI explanation records must conform to these definitions.

## 2. Neuroanatomy & Organization Terms

| Term | Canonical Definition | Scale |
|---|---|---|
| **Cerebral Cortex** | Outermost layered gray-matter sheet of the cerebral hemispheres, predominantly six-layered neocortex (isocortex) alongside allocortex (e.g., hippocampal formation, piriform cortex). | `L6`–`L7` |
| **Gyrus / Sulcus** | Respectively, an outward cortical fold (ridge) and inward cortical groove (fissure) formed by cortical gyrification. | `L7` |
| **Hippocampal Formation** | Medial temporal allocortical complex comprising dentate gyrus, hippocampus proper (`CA3`, `CA2`, `CA1`), subiculum, presubiculum, parasubiculum, and entorhinal cortex (functional complex). | `L5`–`L7` |
| **Basal Ganglia** | Deep subcortical nuclei (striatum—caudate, putamen, nucleus accumbens; globus pallidus external/internal; subthalamic nucleus; substantia nigra) forming cortico-basal ganglia-thalamo-cortical loops. | `L5`–`L7` |
| **Thalamus** | Paired diencephalic nuclear complex serving as a primary relay and integrative hub for sensory, motor, and limbic loops to cerebral cortex. | `L6`–`L7` |
| **Terminologia Neuroanatomica (TNA)** | Official international standard for human neuroanatomical nomenclature published by FIPAT (IFAA). | `L7` |
| **Cortical Parcellation** | Subdivision of cortical surface or volume into discrete regions of interest based on macroanatomy (Desikan–Killiany, Destrieux), cytoarchitecture (Julich-Brain), or multimodal properties (Glasser HCP-MMP1.0). | `L6`–`L7` |

## 3. Cellular, Molecular & Synaptic Terms

| Term | Canonical Definition | Scale |
|---|---|---|
| **Pyramidal Neuron** | Principal glutamatergic projection neuron of cerebral cortex and hippocampus featuring a pyramid-shaped soma, apical dendrite, basal dendrites, dendritic spines, and long-range axon. | `L3` |
| **GABAergic Interneuron** | Locally projecting inhibitory neuron releasing GABA (e.g., parvalbumin fast-spiking basket/chandelier, somatostatin Martinotti, VIP disinhibitory interneurons). | `L3` |
| **Astrocyte** | Major CNS glial cell regulating extracellular $K^+$ and neurotransmitter homeostasis, metabolic support, blood-brain barrier / neurovascular coupling, and tripartite synaptic modulation. | `L3` |
| **Oligodendrocyte** | CNS glial cell wrapping multiple axonal segments in lipid-rich myelin sheaths to enable saltatory conduction. | `L3` |
| **Microglia** | CNS-resident myeloid immune cells performing homeostatic surveillance, synaptic pruning, and inflammatory response. | `L3` |
| **Tripartite Synapse** | Functional synaptic unit consisting of presynaptic terminal, postsynaptic spine/membrane, and ensheathing astrocytic perisynaptic process. | `L4` |
| **Reversal Potential ($E_{\text{ion}}$)** | Membrane potential at which net electrochemical flux of a specific ion equals zero, given by the Nernst equation. | `L1`–`L2` |
| **Long-Term Potentiation (LTP)** | Persistent activity-dependent increase in synaptic efficacy, classically induced in hippocampal CA1 via NMDA-receptor-mediated $Ca^{2+}$ influx and AMPA receptor insertion. | `L4` |
| **Spike-Timing-Dependent Plasticity (STDP)** | Asymmetric synaptic plasticity rule where weight change depends on relative timing $\Delta t = t_{\text{post}} - t_{\text{pre}}$ between presynaptic and postsynaptic spikes. | `L4` |
| **Homeostatic Synaptic Scaling** | Slow negative-feedback mechanism globally adjusting postsynaptic receptor strength to stabilize mean neuronal firing rates around a target set-point. | `L3`–`L4` |

## 4. Computational & Mathematical Terms

| Term | Canonical Definition | Scale |
|---|---|---|
| **Conductance-Based Model** | Biophysical membrane model representing ionic currents via voltage- and time-dependent conductances $g_i(V, t)(V - E_i)$ (e.g., Hodgkin–Huxley, Morris–Lecar). | `L2`–`L3` |
| **Integrate-and-Fire (LIF / AdEx)** | Reduced phenomenological spiking neuron model integrating subthreshold inputs until threshold $V_{\text{th}}$, followed by spike emission and membrane reset. | `L3` |
| **Nullcline** | Curve in phase space where the time derivative of one state variable equals zero ($\frac{dV}{dt}=0$ or $\frac{dw}{dt}=0$); intersections identify fixed points. | `L3`–`L6` |
| **Mean-Field / Neural Mass Model** | Coarse-grained differential equation system describing macroscopic mean firing rates or postsynaptic potentials of coupled excitatory/inhibitory populations (e.g., Wilson–Cowan, Jansen–Rit). | `L5`–`L6` |
| **Balanced E/I Network** | Sparse recurrent network where strong excitatory and inhibitory synaptic currents largely cancel on average, producing irregular, fluctuation-driven spiking. | `L5` |
| **Numerical Stiffness** | Property of ODE systems where widely separated timescales (e.g., fast sodium activation $m$ vs slow recovery $n$ or exponential spike runaway) restrict explicit step stability. | `Compute` |
| **Convergence Order ($O(h^p)$)** | Rate at which numerical discretization error decreases as step size $h \to 0$ (e.g., $p=1$ Forward Euler, $p=4$ classical RK4). | `Compute` |

## 5. Connectomics & Signal Analytics Terms

| Term | Canonical Definition | Scale |
|---|---|---|
| **Structural Connectivity (SC)** | Physical anatomical axonal projections inferred from tract-tracing, microscopy, or diffusion MRI tractography. Distinct from functional connectivity. | `L8` |
| **Functional Connectivity (FC)** | Statistical dependency (correlation, coherence, phase-locking) between recorded or simulated neural time series across regions or electrodes; **not** direct proof of anatomical wiring or causality. | `L8` |
| **Power Spectral Density (PSD)** | Distribution of signal power across frequencies (units e.g. $\mu V^2/\text{Hz}$), commonly estimated via Welch's averaged modified periodograms. | `Analytics` |
| **Phase-Locking Value (PLV)** | Dimensionless synchrony metric $\in [0, 1]$ quantifying consistency of instantaneous phase difference between two band-limited signals across trials or time. | `Analytics` |
| **Small-World Index ($\sigma$)** | Ratio $(C/C_{\text{rand}}) / (L/L_{\text{rand}})$ indicating high local clustering alongside short global path length relative to matched random graphs. | `L8` |

## 6. CORTEXIA Software & Platform Terms

| Term | Canonical Definition | Domain |
|---|---|---|
| **Universal Contextual Explanation System (UCES)** | Cross-platform architecture binding every inspectable UI element to a 3-tier explanation hierarchy: Hover Tooltip, Selection Inspector, and Dedicated Knowledge Page. | `UI/Data` |
| **Work Environment** | One of CORTEXIA's five primary workflow views (`Explore`, `Laboratory`, `Analytics`, `Knowledge`, `Research`) integrating the 12 domain modules. | `UX` |
| **3D Visualization Studio** | One of four specialized WebGL/Three.js inspection contexts (`Whole Brain`, `Cellular`, `Synaptic & Molecular`, `Neural Network`). | `3D` |
| **Reproducibility Manifest** | Immutable JSON record attached to every simulation run capturing model ID/version, parameters, initial conditions, solver, `dt`, PRNG seed, and dataset hash. | `Research` |

## 7. Related Documents & References

- [DOCUMENTATION_STANDARD.md](DOCUMENTATION_STANDARD.md)
- [NEUROSCIENCE_SCOPE_AND_SCALES.md](../02-scientific-foundation/NEUROSCIENCE_SCOPE_AND_SCALES.md)
- `REF-TNA-FIPAT`: FIPAT *Terminologia Neuroanatomica*.
- `REF-RUBINOV-2010`: Rubinov & Sporns (2010), DOI: `10.1016/j.neuroimage.2009.10.003`.
