# Test Strategy & Verification Architecture — CORTEXIA

**Document ID:** `DOC-QA-001`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the multi-layered automated testing strategy for CORTEXIA across Phase 0 documentation/schema auditing and Phase A–H application, numerical solver, 3D rendering, UCES coverage, and end-to-end browser verification.

## 2. Five-Pyramid Testing Architecture

| Test Layer | Tooling | Target Scope | Execution Gate |
|---|---|---|---|
| **Layer 0: Documentation, Schema & Registry Audit** | `python3 tools/documentation-audit/run_audit.py` | Markdown inventory, links, 22 JSON Schemas, 16 registries, UCES coverage, KG anti-orphan invariants | Phase 0 + Every CI commit |
| **Layer 1: Static Type & Lint Verification** | `tsc --noEmit`, `ESLint` | Strict TypeScript contracts across stores, worker messages, and kernels | Pre-commit & CI |
| **Layer 2: Numerical Solver & Analytics Unit Tests** | `Vitest` (Node Float64) | ODE convergence order $O(h^p)$, `VAL-*` analytical benchmarks (`HH`, `LIF`, `STDP`, `Welch PSD`, `Graph Metrics`) | Every PR (`< 10 s`) |
| **Layer 3: Component & Store Integration Tests** | `Vitest` + `@testing-library/react` | UCES Tooltip/Inspector state sync, parameter bounds, `.cortexia.json` import/export | Every PR |
| **Layer 4: End-to-End Browser, 3D & Accessibility QA** | `Playwright` + `@axe-core/playwright` | All 5 Work Environments, 12 Modules, 3D WebGL canvas boot, SPA route refresh, WCAG 2.1 AA | Release & Deployment Gate |

---

## 3. Critical Integration Test Scenarios (`Playwright`)

1. **UCES Three-Tier End-to-End Flow (`E2E-UCES-001`):**
   - Hover structure in Studio A → assert tooltip renders canonical name, short definition, and scale badge.
   - Click structure → assert 3D highlight activates and Right Inspector renders all 12 required fields.
   - Click *"Open Full Scientific Knowledge Page"* → assert navigation to `/knowledge/:entityId` and verify equations + `REF-*` citations render.
2. **Cross-Environment Simulation-to-Analytics Handover (`E2E-SIM-001`):**
   - Select `MODEL-001` (`Hodgkin–Huxley`) in `ENV-02`, run with `I_ext = 10 µA/cm²`, click *"Analyze in ENV-03"*, verify voltage trace and Welch PSD render with `SYNTHETIC_SIMULATION` provenance badge.
3. **Fault Resilience & Divergence Recovery (`E2E-ERR-001`):**
   - Force an unstable explicit Euler step in `Solver Instability Demo` mode → verify `ERR_NUMERICAL_DIVERGENCE` banner renders gracefully without crashing the tab.
4. **GitHub Pages Deep-Link Refresh (`E2E-SPA-001`):**
   - Hard-reload `/Cortexia/knowledge/ANAT-HIPPOCAMPUS?inspect=MODEL-024` → verify HTTP 200 / SPA restore boots directly into the target page and open Inspector.

## 4. Acceptance Criteria & Related Documents

- **AC-QA-001:** `100%` of `VAL-*` numerical cases and `100%` of `REQ-*` acceptance criteria map to automated tests before Phase H release.
- **Links:** [SCIENTIFIC_AND_NUMERICAL_QA.md](SCIENTIFIC_AND_NUMERICAL_QA.md), [PERFORMANCE_BENCHMARKS.md](PERFORMANCE_BENCHMARKS.md), [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).
