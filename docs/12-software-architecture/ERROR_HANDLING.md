# Error Handling & Fault Resilience Architecture — CORTEXIA

**Document ID:** `DOC-ARCH-005`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's taxonomy of runtime, numerical, visualization, data-import, and explanation-lookup errors, specifying structured error codes, non-destructive recovery behaviors, and user-facing diagnostic messages.

## 2. Structured Error Taxonomy & Recovery Matrix

| Error Code | Subsystem | Trigger Condition | User-Facing Recovery & Diagnostic Behavior |
|---|---|---|---|
| `ERR_NUMERICAL_DIVERGENCE` | Simulation Worker | `NaN`, `±Infinity`, or $\|V\| > 10^4\text{ mV}$ during ODE integration (e.g., stiff `dt` too large) | Halt worker job cleanly, preserve trace up to $t_{\text{fail}}$, highlight step $t_{\text{fail}}$ in amber, suggest reducing `dt` (e.g., `0.01 ms`) or switching to `SOLVER-RK4` / `SOLVER-RUSH-LARSEN`. |
| `ERR_ENVELOPE_EXCEEDED` | Simulation / Analytics | Requested $N_{\text{neurons}}$, $N_{\text{synapses}}$, or $T / dt$ exceeds browser compute envelope | Block execution pre-flight with clear modal explaining the browser memory/compute limit and offering a one-click clamp to safe maximum. |
| `ERR_WORKER_TIMEOUT` | Worker Pool | Worker fails to report heartbeat within `5,000 ms` | Terminate hung worker, spawn fresh replacement worker, restore UI to `IDLE`, and display non-fatal timeout banner. |
| `ERR_WEBGL_CONTEXT_LOST` | 3D Visualization | GPU driver reset, background tab eviction, or WebGL2 unavailable | Pause 3D render loop, show **"Restore 3D Viewport"** button + automatic fallback to 2D SVG anatomical/circuit schematic view. |
| `ERR_ASSET_LOAD_FAILED` | 3D / Registry Loader | Network disconnect or missing `.glb` / `.json` chunk | Retry up to `2` times with exponential backoff (`300 ms, 900 ms`); if still offline, render procedural wireframe fallback and keep UCES text inspector fully functional. |
| `ERR_DATASET_PARSE_INVALID` | Dataset Importer (`MOD-11`) | Malformed CSV/JSON/SWC, missing sampling rate/units, acyclic SWC violation, or file `>50 MB` | Reject import with line-numbered validation table; never crash active Analytics workspace. |
| `ERR_SCHEMA_VALIDATION` | Data Runtime (`Zod`) | Registry or imported `.cortexia.json` manifest fails schema validation | Log exact path/field mismatch (`ZodError.issues`), block corrupted hydration, and surface structured schema diagnostic card. |
| `ERR_EXPLANATION_INCOMPLETE` | UCES Inspector | Selected entity ID missing or `explanationCompleteness !== 'COMPLETE'` | Never display fabricated or generic filler text; render explicit diagnostic state showing `entityId` and link to parent structure. |

---

## 3. React Error Boundary Hierarchy

CORTEXIA wraps independent failure domains in isolated React `<ErrorBoundary>` shells so a failure in one panel never white-screens the application:
1. **Global App Shell Boundary:** Last-resort recovery with state reset & export of unsaved Research Notebook notes.
2. **3D Studio Viewport Boundary:** Isolates Three.js/WebGL crashes while keeping TopNav, Left Tree, and Right UCES Inspector alive.
3. **Simulation / Chart Panel Boundary:** Isolates plotting or KaTeX rendering errors to the single card.

## 4. Acceptance Criteria & Related Documents

- **AC-ARCH-005:** Zero unhandled promise rejections or uncaught exceptions occur under simulated numerical divergence, malformed CSV upload, or WebGL context loss in Playwright tests.
- **Links:** [SIMULATION_AND_WORKER_ARCHITECTURE.md](SIMULATION_AND_WORKER_ARCHITECTURE.md), [3D_ENGINE_SPECIFICATION.md](../09-visualization/3D_ENGINE_SPECIFICATION.md), [TEST_STRATEGY.md](../14-quality-and-validation/TEST_STRATEGY.md).
