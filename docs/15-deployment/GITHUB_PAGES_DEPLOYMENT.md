# GitHub Pages Deployment Specification — CORTEXIA

**Document ID:** `DOC-DEP-002`  
**Deployment Target:** GitHub Pages (`https://orls967.github.io/Cortexia/`)  
**Status:** Authoritative (Phase 0 — Specification Only; No Live Deployment Claimed in Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document specifies the static hosting architecture, SPA client-side route fallback strategy, asset delivery constraints, cache behavior, rollback strategy, and post-deployment production verification checklist for deploying CORTEXIA to **GitHub Pages** in Phase H.

> [!IMPORTANT]
> **Phase 0 Honesty Statement:** No application build or GitHub Pages deployment has been executed during Phase 0. This specification governs future Phase H production delivery.

---

## 2. GitHub Pages Subpath & SPA Deep-Link Routing Solution

GitHub Pages serves repository project sites from `https://<username>.github.io/Cortexia/` and returns static `404.html` when a user refreshes or directly opens a deep client-side route such as `/Cortexia/knowledge/ANAT-HIPPOCAMPUS?inspect=MODEL-024`.

### 2.1 Dual-Defense SPA Routing Architecture (`ADR-011`)
1. **Vite Base Path:** Set `base: '/Cortexia/'` and `<BrowserRouter basename="/Cortexia">`.
2. **Static `public/404.html` Session-Storage / Query Redirect Shim:**
   During `npm run build`, generate `dist/404.html` containing a lightweight inline script that encodes `window.location.pathname + window.location.search + window.location.hash` into `sessionStorage.getItem('__cortexia_spa_redirect')` (or `?p=...` query parameter) and redirects immediately to `/Cortexia/`, where `index.html` restores the exact URL via `window.history.replaceState(...)` **before** React Router mounts.
3. **`.nojekyll` Marker:** Include `public/.nojekyll` in `dist/` so GitHub Pages never strips underscore-prefixed chunks or folders.

---

## 3. Environment Constraints & Cache Behavior

- **File Size Limits:** Individual static files MUST remain `< 25 MB` (practical target `<= 2.5 MB` per `.glb` chunk) to avoid GitHub Pages CDN throttling.
- **CORS & Web Workers:** Because workers and WASM modules are loaded from the same origin (`https://orls967.github.io/Cortexia/assets/...`), standard `new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })` executes without cross-origin isolation errors.
- **Cache Behavior:** HTML entry (`index.html`, `404.html`) revalidates on navigation (`max-age=600`), while content-hashed JS/CSS/GLB assets (`assets/*-[hash].*`) cache immutably.

---

## 4. Mandatory Phase H Production Verification Checklist (`AC-IMP-DEPLOY`)

Before Phase H can be marked complete, automated Playwright live smoke tests against the deployed GitHub Pages URL MUST verify:
1. Root URL `https://orls967.github.io/Cortexia/` returns **HTTP 200** over **HTTPS**.
2. Main Observatory shell renders with zero uncaught console errors or page errors.
3. Deep routes (`/explore/anatomy/ANAT-HIPPOCAMPUS`, `/lab/MODEL-001`, `/analytics/signals`, `/knowledge/ANAT-HIPPOCAMPUS`, `/research`) work both via in-app navigation and **after hard browser refresh**.
4. All 4 3D Visualization Studios (`A–D`) load their geometries and respond to hover/click UCES inspection.
5. Scientific registries load and validate without failed network requests (`0` HTTP 4xx/5xx on essential assets).
6. Web Worker simulators (`MODEL-001`, `MODEL-021`, `MODEL-024`) execute and plot results live.
7. Desktop (`1440×900`) and Mobile (`390×844`) responsive layouts pass visual and interaction checks.

## 5. Rollback Procedure

If a post-deployment smoke check fails on `main`, revert or re-run the `deploy-pages` GitHub Actions workflow pinned to the previous verified release tag (`git revert` + workflow dispatch), restoring the last green artifact within `< 2 minutes`.

## 6. Related Documents

- [BUILD_CONFIGURATION.md](BUILD_CONFIGURATION.md)
- [CI_CD_AND_RELEASE_PROCESS.md](CI_CD_AND_RELEASE_PROCESS.md)
- [TEST_STRATEGY.md](../14-quality-and-validation/TEST_STRATEGY.md)
