# Experiment Framework & Reproducibility Specification — CORTEXIA

**Document ID:** `DOC-DATA-004`  
**Module:** `MOD-08`, `MOD-11`, `MOD-12`  
**Environment:** `ENV-02` (Laboratory), `ENV-05` (Research Environment)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines the **CORTEXIA Experiment Framework**, covering the 10 standardized experiment types, parameter sweeps, multi-run comparison workflows, Research Notebook architecture, and deterministic reproducibility manifests.

## 2. Ten Standardized Experiment Types

| Type Code | Experiment Type | Description & Execution Pattern | Example Preset ID |
|---|---|---|---|
| `EXP_SINGLE_PARAM` | Single-Parameter Perturbation | Modify one parameter (e.g., $\bar{g}_{\text{Na}}$ or $I_{\text{ext}}$) against baseline | `EXP-HH-EXCITABILITY` |
| `EXP_MULTI_PARAM` | Multi-Parameter Co-Modulation | Simultaneously vary 2+ coupled parameters (e.g., $(g, \eta)$ in Brunel SNN) | `EXP-BRUNEL-PHASE-DIAGRAM` |
| `EXP_PARAM_SWEEP` | Automated 1D / 2D Parameter Sweep | Batch worker execution across $K \in [5, 50]$ grid points producing summary curves/heatmaps | `EXP-HH-FI-CURVE` |
| `EXP_SENSITIVITY` | Local Parameter Sensitivity Analysis | Compute normalized OAT derivatives $S_{p_k}^M$ across all model parameters | `EXP-HH-SENSITIVITY` |
| `EXP_BASELINE_INTERVENTION` | Baseline vs. Intervention Comparison | Paired execution (Control vs. Channel Block / Plasticity Perturbation) with delta metrics | `EXP-TTX-TEA-CHANNEL-BLOCK` |
| `EXP_MODEL_COMPARISON` | Cross-Model Family Comparison | Compare two distinct models under matched stimulus (e.g., `HH` vs `AdEx` vs `LIF`) | `EXP-SPIKE-MODEL-BENCHMARK` |
| `EXP_STOCHASTIC_REPEAT` | Multi-Seed Stochastic Ensemble | Run $M \in [5, 50]$ independent PRNG seeds to quantify trial-to-trial variability (Fano / PSTH) | `EXP-OU-NOISE-RELIABILITY` |
| `EXP_NETWORK_TOPOLOGY` | Graph Topology Perturbation | Vary rewiring probability $p_{\text{WS}}$ or targeted hub lesion fraction $f$ | `EXP-NET-ROBUSTNESS` |
| `EXP_TIME_SERIES` | Empirical / Synthetic Signal Pipeline | Chain filtering, PSD, wavelet, and ERP/spike metrics on a recorded trace | `EXP-EEG-ALPHA-SPECTRAL` |
| `EXP_DIGITAL_TWIN` | Multi-Scale Coupled Digital Twin | Chain cellular → synaptic → circuit → analytics stages (`Tier 5`) | `EXP-TWIN-EXCITABILITY-TO-CIRCUIT` |

---

## 3. Reproducibility Manifest Contract (`schemas/experiments/experiment-result.schema.json`)

Every executed simulation or analysis produces an immutable JSON manifest guaranteeing exact in-browser re-execution:

```json
{
  "experimentRunId": "RUN-20261116-0001",
  "experimentPresetId": "EXP-HH-EXCITABILITY",
  "modelId": "MODEL-001",
  "modelVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "solver": "SOLVER-RK4",
  "timeStepMs": 0.01,
  "durationMs": 50.0,
  "randomSeed": 42,
  "parameterSnapshot": {
    "C_m": 1.0,
    "g_Na_max": 120.0,
    "g_K_max": 36.0,
    "g_L": 0.3,
    "E_Na": 50.0,
    "E_K": -77.0,
    "E_L": -54.387,
    "I_ext_amp": 10.0
  },
  "initialConditions": {
    "V": -65.0,
    "m": 0.05293,
    "h": 0.59612,
    "n": 0.31768
  },
  "summaryMetrics": {
    "spikeCount": 4,
    "meanFiringRateHz": 72.4,
    "firstSpikeLatencyMs": 2.34,
    "peakVoltageMv": 38.6
  },
  "validationStatus": "PASSED",
  "createdAt": "2026-11-16T14:55:00Z"
}
```

---

## 4. Computational Research Notebook (`ENV-05`)

The Research Environment allows users to assemble reproducible educational notebooks containing:
1. **Research Question & Mechanistic Hypothesis** (structured Markdown).
2. **Selected Model(s) & Explicit Assumptions** (auto-populated from `MODEL-*`).
3. **Pinned Experiment Runs & Multi-Run Comparison Overlays** (referencing immutable `experimentRunId` snapshots).
4. **Embedded Signal / Spike / Network Figures** from `ENV-03`.
5. **Interpretation, Methodological Limitations & Citations** (`REF-*`).
6. **Portable Export / Import:** Export complete notebook + run manifests as a single `.cortexia.json` bundle or Markdown/CSV report, and re-import to replay every simulation deterministically.

## 5. Acceptance Criteria & Related Documents

- **AC-DATA-004:** Re-importing a saved `.cortexia.json` experiment manifest with identical `modelVersion`, `solver`, `timeStepMs`, and `randomSeed` reproduces identical state trajectories within IEEE-754 floating-point determinism (`< 10^{-12}` relative delta on same CPU/browser).
- **Links:** [MODEL_CATALOG.md](../06-computational-models/MODEL_CATALOG.md), [MODEL_VALIDATION.md](../06-computational-models/MODEL_VALIDATION.md).
