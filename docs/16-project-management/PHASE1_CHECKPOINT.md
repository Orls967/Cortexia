# Phase 1 Implementation Checkpoint Log — CORTEXIA

**Document ID:** `DOC-PM-006`  
**Status:** Living document (Phase 1 in progress)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This file is the resume point for Phase 1 implementation. It records what is finished, the decisions already taken, and the exact next steps, so that work interrupted at any time continues from the last checkpoint instead of restarting. Update it and commit at every checkpoint.

**Resume rule:** read this file first, run `git log --oneline | head -20` and `git status`, then continue from Section 4 ("Next steps"). Do not re-read all Phase 0 documents; Section 3 holds the decisions derived from them.

---

## 2. Checkpoint Status

| # | Checkpoint | Status | Evidence |
|---|---|---|---|
| CP-01 | Repository preflight (remote `Orls967/Cortexia`, branch `main`, clean, in sync) | DONE | `git remote -v`, Phase 0 audit passes with 0 errors |
| CP-02 | Phase 0 ingestion (docs, 24 schemas, 17 registries) | DONE | Decisions captured in Section 3 |
| CP-03 | Toolchain scaffold (React 19, Vite 8, TypeScript 6 strict, Vitest, Playwright, Three.js) | DONE | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/404.html` |
| CP-04 | Registry → runtime data pipeline | DONE | `scripts/build-data.mjs` → `public/data/` (generated, git-ignored) |
| CP-05 | Typed data layer with Zod validation | DONE | `src/data/types.ts`, `src/data/registry.ts` |
| CP-06 | Solver core (RK4, RK45, Euler, RK2, Thomas, LU, PRNG, stimulus, recorder) | DONE | `src/kernels/core/*`, `src/kernels/solvers/ode.ts` |
| CP-07 | Model kernels MODEL-001 … MODEL-016 | WRITTEN, not yet tested | `src/kernels/models/{conductance,integrateFire,cable,synapses}.ts` |
| CP-08 | Model kernels MODEL-017 … MODEL-028 | PARTIAL: 017–022 and 027 written (untested); 023–026 and 028 pending | `src/kernels/models/{populations,networks,graphs}.ts` |
| CP-09 | Analytics kernels (26 methods) | PARTIAL: ANALYTIC-003/004 (`fft.ts`) and ANALYTIC-016…019 (`graph.ts`, 17 unit tests green) done | `src/kernels/analytics/*`, `tests/unit/graph.test.ts` |
| CP-10 | Validation cases `VAL-*` + Vitest suites | PENDING | |
| CP-11 | Workers, stores, app shell, design system | PENDING | |
| CP-12 | UCES (tooltip, inspector, knowledge pages, coverage audit) | PENDING | |
| CP-13 | Laboratory (5-panel workspace, sweeps, sensitivity) | PENDING | |
| CP-14 | Analytics environment + CSV import | PENDING | |
| CP-15 | 3D engine + Studios A–D | PENDING | |
| CP-16 | Modules 01–12 pages | PENDING | |
| CP-17 | Digital Twin (3 flagship experiments) | PENDING | |
| CP-18 | Research environment (runs, notebook, export/import) | PENDING | |
| CP-19 | E2E (Playwright + axe), performance benchmarks | PENDING | |
| CP-20 | CI workflow + GitHub Pages deployment + live verification | PENDING | |
| CP-21 | Final completion report | PENDING | |

---

## 3. Decisions Already Taken (do not re-derive)

1. **Registry IDs are authoritative.** Docs use mnemonic IDs (`EQ-HH-MEMBRANE`, `CIRC-HIPP-TRISYNAPTIC`, `ANAT-PREFRONTAL-CORTEX`); the registries use `EQ-011`, `CIRC-007`, `ANAT-DLPFC`. The app uses registry IDs only.
2. **3D geometry is procedural.** `assets-3d.json` describes atlas GLB meshes and SWC reconstructions that do not exist in the repository. All four studios generate parametric geometry anchored on registry MNI centroids and are labelled as educational approximations. The asset registry, schema and asset spec must be updated to say so (new format `PROCEDURAL_PARAMETRIC_MESH`, new accuracy class `PROCEDURAL_EDUCATIONAL_APPROXIMATION`, license `MIT_PROCEDURAL`), keeping `run_audit.py` green.
3. **Datasets `DSET-001`–`DSET-018` are catalog metadata only.** No empirical data files are bundled. The app shows them as external-source catalog entries; only the synthetic benchmarks `DSET-019`–`DSET-022` are generated in-browser and are always labelled synthetic. Users can import their own CSV/JSON.
4. **Kernel-local parameters.** `parameters.json` has 84 `PARAM-*` entries, fewer than the models need. Parameters without a registry ID are defined in the kernel `ParamSpec` (label, symbol, unit, range, description) and resolve in UCES to their parent `MODEL-*` entity.
5. **Cancellation = terminate and respawn the worker.** `SharedArrayBuffer` needs COOP/COEP headers that GitHub Pages cannot set, so cooperative flag polling is not possible in a synchronous kernel loop.
6. **No Rust/WASM** unless a measured benchmark misses budget (benchmark-gated per ADR-006).
7. **No `@react-three/drei`:** `OrbitControls` comes from `three/examples`; labels are plain HTML overlays. Keeps the bundle small.
8. **Charts are in-house Canvas2D/SVG** (allowed by SYSTEM_ARCHITECTURE: "uPlot / Canvas2D").
9. **Routing:** `BrowserRouter` with `basename` = Vite `base` (`/Cortexia/`), `public/404.html` sessionStorage redirect shim, `.nojekyll`.
10. **MODEL-028 covariance:** the documented formula `(I − GW)⁻¹(I − GWᵀ)⁻¹` is the SAR model, not the stationary covariance of the Ornstein–Uhlenbeck system written next to it (which is `σ²/(2τ)·(I − GW)⁻¹` for symmetric W). Implement both, label each, validate simulation against the Lyapunov solution.
11. **MODEL-016** follows SYNAPTIC_MODELS §7 literally (u relaxes to U₀ and jumps before release), so first-spike release is `U₀(2 − U₀)`; disclosed in the model limitations.
12. **Model kernels expose** `ModelDefinition { id, equations, params, initial, stimulus, solvers, views, metrics, presets, sweep, kernelLimitations, run }` (`src/kernels/core/types.ts`). Validation cases live in `src/kernels/validation/cases.ts` and are used by both Vitest and the in-app Validation panel.
13. **Any tolerance in MODEL_VALIDATION.md that the correct implementation cannot meet is reported as a specification discrepancy**, never tuned away silently.
14. **Commits carry no AI attribution.** No `Co-Authored-By` trailer and no tool-generated footer in commits or pull requests; every commit is authored under the repository owner's git identity only. Check `git log origin/main..HEAD --format='%h %(trailers)'` before each push.
15. **Matrix convention:** `W[i*n + j]` is the weight of the edge `j → i` (row sums = in-strength, column sums = out-strength) in graph generators, graph analytics and network kernels.
16. **Checkpoint cadence:** commit after every file or small group of files that typechecks and whose tests pass, and update this log in the same commit. Push only when `npm test` is green.

---

## 4. Next Steps (in order)

1. ~~`populations.ts` (MODEL-017, 018, 019, 027)~~ — done.
2. ~~`networks.ts` (MODEL-020, 021, 022)~~ and ~~`graphs.ts` (seeded generators, synthetic DK-68 graph)~~ — done.
3. `src/kernels/models/plasticity.ts` — MODEL-023 Hebb/Oja/BCM, MODEL-024 STDP, MODEL-025 homeostatic scaling, MODEL-026 TD-RL.
4. `src/kernels/models/connectome.ts` — MODEL-028 (uses `analytics/graph.ts` and `graphs.ts`).
5. `src/kernels/models/index.ts` — registry of all 28 definitions.
6. `src/kernels/analytics/*` — remaining: filters (001, 002), spectral (005, 006, 007, 008), spikes (009–015), stats (020–026). Done: `fft.ts`, `graph.ts`.
7. `src/kernels/validation/cases.ts` + `tests/unit/*` — one `VAL-*` case per registry entry; run and fix until green; commit and push.
8. Continue with CP-11 onward.

## 5. Related Documents

- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [PROGRESS_TRACKER.md](PROGRESS_TRACKER.md)
- [MODEL_CATALOG.md](../06-computational-models/MODEL_CATALOG.md)
