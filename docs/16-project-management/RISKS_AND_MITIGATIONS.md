# Risks and Mitigations Register — CORTEXIA

**Document ID:** `DOC-PM-003`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This risk register identifies scientific, mathematical, numerical, performance, licensing, UX, and deployment risks across CORTEXIA and locks concrete technical mitigations.

---

## 2. Master Risk Register

| Risk ID | Category | Risk Description | Likelihood | Impact | Locked Mitigation Strategy |
|---|---|---|---|---|---|
| `RISK-001` | **Numerical Stability** | Stiff Hodgkin–Huxley or AdEx ODEs diverge (`NaN`) when users select large time steps (`dt > 0.05 ms`) or extreme conductances. | High | High | Default to `SOLVER-RK4` / `SOLVER-RUSH-LARSEN` at `dt = 0.01 ms`, clamp slider bounds, and trap `NaN` in worker via `ERR_NUMERICAL_DIVERGENCE` (`DOC-MOD-003`). |
| `RISK-002` | **Browser Freeze on Large SNNs** | Simulating large spiking networks or 2D parameter sweeps on the main thread freezes UI and drops WebGL below 30 fps. | High | Critical | Offload 100% of ODE/SNN/DSP loops to Web Workers (`ADR-006`), enforce hard neuron/synapse caps (`ADR-013`), and stream decimated 60 Hz `Transferable` buffers. |
| `RISK-003` | **3D GPU Memory Exhaustion** | Switching repeatedly between 4 3D Studios leaks `THREE.BufferGeometry` and textures, crashing mobile/integrated GPU tabs. | Medium | High | Enforce explicit `.dispose()` on unmount, 3-tier `THREE.LOD`, `InstancedMesh` for particles/nodes, and verify zero leak in `BM-010` soak test (`DOC-VIS-001`). |
| `RISK-004` | **Opaque Visuals Without Explanation** | Users interact with 3D structures or simulator sliders without understanding biological meaning or assumptions. | Medium | Critical | Enforce **Universal Contextual Explanation System (UCES)** across all 17 UI entity classes + automated `run_audit.py` coverage gate (`DOC-VIS-005`). |
| `RISK-005` | **Dataset Size & Licensing Violations** | Raw neuroimaging (`NIfTI`/`NWB` >100 MB) breaks static GitHub Pages hosting, or Allen non-commercial terms are violated. | Medium | High | Deliver pre-curated downsampled micro-subsets (`<= 500 KB`), tag license & same-page attribution per dataset (`DOC-DATA-002`), and process user CSVs 100% locally. |
| `RISK-006` | **Scientific Overclaim / Clinical Misuse** | Users misinterpret educational models, synthetic EEG traces, or functional connectivity correlations as clinical diagnoses or causal proof. | Medium | Critical | Enforce persistent non-clinical disclaimers, `EMPIRICAL_SC` vs `ESTIMATED_FC` vs `SYNTHETIC` badges, and `Correlation ≠ Causation` banners (`DOC-ARCH-006`). |
| `RISK-007` | **GitHub Pages Deep-Link HTTP 404** | Refreshing `/Cortexia/knowledge/ANAT-HIPPOCAMPUS` on GitHub Pages returns static 404 if History API routing is unguarded. | High | High | Configure Vite `base: '/Cortexia/'`, `.nojekyll`, and `public/404.html` SPA path-restoration shim (`DOC-DEP-002`). |
| `RISK-008` | **Cross-Document / Schema Drift** | Equations, units, or entity IDs diverge between Markdown specs, JSON registries, and UI code during implementation. | Medium | High | Run `python3 tools/documentation-audit/run_audit.py` in CI (`Gate 0`) validating all 22 JSON Schemas, foreign keys, and relative links on every commit. |

## 3. Related Documents

- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [ERROR_HANDLING.md](../12-software-architecture/ERROR_HANDLING.md)
- [SECURITY_AND_PRIVACY.md](../12-software-architecture/SECURITY_AND_PRIVACY.md)
