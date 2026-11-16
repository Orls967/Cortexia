# Architecture & Scientific Decision Log — CORTEXIA

**Document ID:** `DOC-GOV-004`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This log records foundational architectural, scientific, numerical, UX, and deployment decisions (ADRs) locked during Phase 0 so that subsequent implementation Phases A–H operate without contradictory assumptions.

## 2. Decision Summary Table

| ID | Title | Decision | Status |
|---|---|---|---|
| `ADR-001` | Dual-Pillar Identity | Equal first-class status for Neuroscience and Computational Neuroscience | Locked |
| `ADR-002` | Universal Contextual Explanation System | Mandatory 3-tier explanation (Hover, Inspector, Detail Page) + automated coverage audit | Locked |
| `ADR-003` | Nine-Scale Taxonomy (`L1`–`L9`) | Nine explicitly bounded biological scales with non-deterministic abstraction disclaimers | Locked |
| `ADR-004` | Five Work Environments Over 12 Modules | Unified 5-environment shell prevents 12-page fragmentation | Locked |
| `ADR-005` | JSON Schema Draft 2020-12 + Zod Runtime Contracts | Typed contracts across 22 entity domains + immutable IDs | Locked |
| `ADR-006` | Web Worker Offloading & Optional Rust/WASM Gate | All ODE/SNN/FFT kernels execute off the main thread; Rust/WASM gated by benchmarks | Locked |
| `ADR-007` | Multi-Solver Policy | Match numerical solvers (RK4, Rush-Larsen, Euler-Maruyama, event-driven) to model stiffness | Locked |
| `ADR-008` | Three.js / R3F 4-Studio 3D Architecture | Dedicated Whole Brain, Cellular, Synaptic/Molecular, and Network studios with provenance tags | Locked |
| `ADR-009` | Typed Knowledge Graph Backbone | Explicit directional edge semantics (`CONTAINS`, `MODELED_BY`, `ANATOMICAL_CONNECTION`, etc.) | Locked |
| `ADR-010` | Educational Digital Twin Boundaries | 5-tier scoped integration; no whole-human-brain or clinical claims | Locked |
| `ADR-011` | GitHub Pages Hash/SPA Fallback Strategy | Vite `base: '/Cortexia/'` + static `404.html` SPA redirect / clean URL resolution | Locked |
| `ADR-012` | Scientific Provenance & Licensing Enforcement | Mandatory per-dataset license/attribution tags and epistemic status labels | Locked |
| `ADR-013` | Browser-Safe Numerical Envelopes | Hard guardrails on neuron count, synapse edges, duration, and `dt` to protect tab stability | Locked |
| `ADR-014` | Zero-Fabrication Content Target Policy | Report exact audited registry counts; never duplicate/pad entries to hit planning ranges | Locked |

---

## 3. Detailed Architecture Decision Records

### ADR-001 — Dual-Pillar Scientific & Computational Identity
- **Context:** Earlier concept drafts risked positioning CORTEXIA either as a passive 3D anatomy viewer or an abstract ODE playground.
- **Decision:** Every anatomical/physiological module links bidirectionally to mathematical models, and every simulator anchors back to biological structure and mechanism.
- **Consequences:** Requires a unified Knowledge Graph (`MOD-12` backbone) and cross-linking schemas across `docs/03`–`docs/11`.

### ADR-002 — Universal Contextual Explanation System (UCES)
- **Context:** Interactive 3D and mathematical interfaces become opaque educational toys if parameters, meshes, and plots lack deep scientific explanations.
- **Decision:** Every substantive entity in 3D scenes, network graphs, equations, parameter sliders, charts, and analytics metrics MUST expose: (1) Hover Tooltip (adapted for touch), (2) Click/Selection Inspector drawer/panel with 12 canonical fields, and (3) Dedicated Knowledge Page route (`/knowledge/:entityId`). Automated coverage auditing is mandatory.
- **Consequences:** Adds `schemas/explanations/scientific-explanation.schema.json`, `schemas/ui/ui-entity-mapping.schema.json`, and `registries/explanation-coverage/explanation-coverage.json`.

### ADR-004 — Five Work Environments Integrating Twelve Modules
- **Context:** Twelve flat top-level navigation tabs degrade learnability and hide cross-scale workflows.
- **Decision:** Organize the primary shell around 5 Work Environments (`Explore`, `Laboratory`, `Analytics`, `Knowledge`, `Research`) while exposing all 12 domain modules as navigable lenses and deep links inside those environments.

### ADR-006 — Off-Main-Thread Simulation & Benchmark-Gated Rust/WASM
- **Context:** Stiff ODE integration (Hodgkin–Huxley at `dt = 0.01 ms`), 1000+ neuron SNNs, and multichannel STFT/wavelet transforms would drop Three.js below 60 fps if run on the UI thread.
- **Decision:** All numerical simulation and signal-processing kernels execute inside dedicated Web Workers communicating via structured messages and `Transferable` `Float64Array` buffers. TypeScript double-precision kernels serve as the baseline; Rust/WASM optimization is introduced only where profiling proves TS misses target budgets (e.g., dense spiking networks > 2,000 neurons or continuous real-time sweeps).

### ADR-007 — Model-Specific Numerical Solver Policy
- **Context:** Explicit Forward Euler becomes unstable or inaccurate for Hodgkin–Huxley at moderate step sizes (`dt > 0.05 ms`), spikes in AdEx/Izhikevich require precise event/threshold detection, and noisy synapses require SDE integrators.
- **Decision:** Solvers are assigned per model class: RK4 or Rush–Larsen exponential integrator for conductance-based ODEs; exact/sub-stepped integration for LIF/AdEx/Izhikevich; Euler–Maruyama for stochastic Langevin/OU inputs; explicit RK4 for smooth population models (Wilson–Cowan, Jansen–Rit).

### ADR-011 — GitHub Pages Client-Side Routing & Base Path
- **Context:** GitHub Pages serves static files under `/<repo-name>/` (`https://<user>.github.io/Cortexia/`) and returns HTTP 404 on deep browser refreshes of History API routes unless handled.
- **Decision:** Configure Vite `base: '/Cortexia/'` (or configurable env base), generate a static `404.html` redirect shim that preserves path + query + hash into `index.html` boot restoration (with optional hash fallback configuration for strict offline environments), and enforce relative/base-aware asset URLs across Three.js glTF/JSON loaders.

### ADR-013 — Browser-Safe Computational Envelopes
- **Context:** Unbounded user inputs (e.g., $N = 100,000$ all-to-all HH neurons for $100\text{ s}$) would exhaust browser heap memory or freeze workers.
- **Decision:** Each model specifies hard `maxNeurons`, `maxSynapses`, `minDt`, `maxStepsPerRun`, and `workerMemoryBudgetMB` limits documented in `MODEL_CATALOG.md` and enforced before execution.

### ADR-014 — Zero-Fabrication Quantitative Target Policy
- **Context:** Section 23 specifies ambitious flagship planning targets (e.g., 100–150 anatomical structures, 150–250 references).
- **Decision:** Every entry across all registries must represent a distinct, scientifically valid concept with verified provenance. Automated audit tools report exact validated counts without duplicating or padding items. Any gap against planning ranges is transparently documented in the Readiness & Audit Reports.

## 4. Related Documents

- [PROJECT_CHARTER.md](PROJECT_CHARTER.md)
- [SYSTEM_ARCHITECTURE.md](../12-software-architecture/SYSTEM_ARCHITECTURE.md)
- [GITHUB_PAGES_DEPLOYMENT.md](../15-deployment/GITHUB_PAGES_DEPLOYMENT.md)
