# Brain Network & Graph Computation Models — CORTEXIA

**Document ID:** `DOC-MOD-009`  
**Module:** `MOD-06`, `MOD-08`, `MOD-11`  
**Models Covered:** `MODEL-028` & Graph-Theoretic Computational Framework  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies `MODEL-028` (**Connectome Graph Diffusion & Structural-to-Functional Network Model**) alongside the graph-theoretic computational framework used across `MOD-06`, `MOD-08`, and `MOD-11` (`REF-BULLMORE-2009`, `REF-RUBINOV-2010`, `REF-BREAKSPEAR-2017`).

> [!IMPORTANT]
> **Mandatory Provenance Distinction:** Every network model and visualization MUST explicitly label whether its adjacency matrix $W$ represents:
> 1. `EMPIRICAL_STRUCTURAL` — anatomically measured tractography / tract-tracing weights.
> 2. `ESTIMATED_FUNCTIONAL` — statistical correlation, coherence, or phase-locking computed from time series.
> 3. `SYNTHETIC_TOPOLOGY` — algorithmically generated graph (Erdős–Rényi, Watts–Strogatz, Barabási–Albert, modular stochastic block model).

---

## 2. `MODEL-028` — Connectome Graph Diffusion & Structural-to-Functional Model (`FAM-16`)

1. **Identity & Scale:** `MODEL-028` · Scale `L8` · `REF-SANZ-LEON-2013`, `REF-BREAKSPEAR-2017`.
2. **Scientific Purpose:** Model how macroscopic neural activity propagates across a structural connectome $W_{ij}$ via graph Laplacian diffusion and Ornstein–Uhlenbeck regional dynamics, predicting steady-state Functional Connectivity (`FC`) from Structural Connectivity (`SC`).
3. **Governing Equations (`EQ-NET-LAPLACIAN`, `EQ-NET-DIFFUSION`, `EQ-NET-SAR`):**
   - **Normalized Graph Laplacian:**
     $$\mathbf{L} = \mathbf{I} - \mathbf{D}^{-1/2} \mathbf{W} \mathbf{D}^{-1/2}, \qquad D_{ii} = \sum_{j=1}^N W_{ij}$$
   - **Linearized Ornstein–Uhlenbeck Network Dynamics:**
     $$\tau_x \frac{d\mathbf{x}}{dt} = -\left(\mathbf{I} - G \tilde{\mathbf{W}}\right)\mathbf{x}(t) + \sigma\,\boldsymbol{\xi}(t)$$
   - **Analytical Covariance & Predicted Functional Connectivity (`EQ-NET-COV`):**
     For $G \rho(\tilde{\mathbf{W}}) < 1$, the stationary covariance matrix $\mathbf{C} = \langle \mathbf{x}\mathbf{x}^\top \rangle$ satisfies the continuous Lyapunov / spatial autoregressive (`SAR`) solution:
     $$\mathbf{C} = \frac{\sigma^2 \tau_x}{2} (\mathbf{I} - G\tilde{\mathbf{W}})^{-1} (\mathbf{I} - G\tilde{\mathbf{W}}^\top)^{-1}, \qquad \text{FC}_{ij}^{\text{pred}} = \frac{C_{ij}}{\sqrt{C_{ii} C_{jj}}}$$
4. **Parameters & Units:** Global coupling gain $G \in [0, 0.99 / \lambda_{\max}(\tilde{\mathbf{W}})]$, regional decay $\tau_x = 20\text{ ms}$, noise amplitude $\sigma = 0.1$, node count $N \in [10, 180]$.

---

## 3. Graph-Theoretic Network Topology Formulation (`REF-RUBINOV-2010`, `REF-WATTS-STROGATZ-1998`, `REF-NEWMAN-2006`)

All graph metrics share exact mathematical definitions across `MOD-06`, `MOD-08`, and `MOD-11`:

1. **Node Degree / Strength (`EQ-GRAPH-DEGREE`):**
   $$k_i = \sum_{j=1}^N A_{ij}, \qquad s_i^{\text{out}} = \sum_{j=1}^N W_{ij}, \qquad s_i^{\text{in}} = \sum_{j=1}^N W_{ji}$$
2. **Clustering Coefficient (`EQ-GRAPH-CLUSTERING`):**
   $$C_i = \frac{2 t_i}{k_i (k_i - 1)}, \qquad t_i = \frac{1}{2}\sum_{j,h} A_{ij} A_{ih} A_{jh}, \qquad C = \frac{1}{N}\sum_{i=1}^N C_i$$
3. **Characteristic Path Length & Global Efficiency (`EQ-GRAPH-PATH`, `EQ-GRAPH-EFFICIENCY`):**
   $$L = \frac{1}{N(N-1)} \sum_{i \neq j} d_{ij}, \qquad E_{\text{glob}} = \frac{1}{N(N-1)} \sum_{i \neq j} \frac{1}{d_{ij}}$$
   where $d_{ij}$ is shortest path length computed via Dijkstra's algorithm (using edge length $\ell_{ij} = 1 / W_{ij}$ for weighted graphs).
4. **Betweenness Centrality (`EQ-GRAPH-BETWEENNESS`, Brandes Algorithm):**
   $$b_i = \frac{1}{(N-1)(N-2)} \sum_{\substack{s \neq i \neq t \\ s \neq t}} \frac{\sigma_{st}(i)}{\sigma_{st}}$$
5. **Newman–Girvan Modularity (`EQ-GRAPH-MODULARITY`, `REF-NEWMAN-2006`):**
   $$Q = \frac{1}{2m} \sum_{i,j} \left[W_{ij} - \gamma_{\text{res}} \frac{s_i s_j}{2m}\right] \delta(c_i, c_j), \qquad 2m = \sum_{i,j} W_{ij}$$
6. **Small-Worldness Index (`EQ-GRAPH-SMALLWORLD`, `REF-WATTS-STROGATZ-1998`):**
   $$\sigma_{\text{SW}} = \frac{C / C_{\text{rand}}}{L / L_{\text{rand}}} \qquad (\sigma_{\text{SW}} > 1 \text{ indicates small-world topology})$$
7. **Network Robustness & Targeted Lesion Simulation (`EXP-NET-ROBUSTNESS`):**
   Iteratively remove fraction $f \in [0, 0.8]$ of nodes either **Randomly** or **Targeted by Hub Degree/Betweenness**, recording Largest Connected Component (`LCC(f)`) and Global Efficiency drop $E_{\text{glob}}(f) / E_{\text{glob}}(0)$.

## 4. Acceptance Criteria & Related Documents

- **AC-MOD-009:** All graph metrics validate against canonical toy graphs (ring lattice, complete graph, star graph, two-clique barbell) with zero numerical discrepancy (`VAL-GRAPH-001`).
- **Links:** [NEURAL_CIRCUITS_AND_CONNECTOMICS.md](../07-systems-and-cognition/NEURAL_CIRCUITS_AND_CONNECTOMICS.md), [SIGNAL_ANALYTICS.md](../08-neural-data-and-analytics/SIGNAL_ANALYTICS.md), [MODEL_VALIDATION.md](MODEL_VALIDATION.md).
