# Application Layout & Five Work Environments — CORTEXIA

**Document ID:** `DOC-UX-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's master application shell, spatial panel grid, responsive breakpoint adaptations, and workflow layouts across all **5 Work Environments (`ENV-01`–`ENV-05`)**.

## 2. Master Workstation Shell (`Desktop >= 1280px`)

```text
+--------------------------------------------------------------------------------------------------+
| CORTEXIA | [01 Explore] [02 Lab] [03 Analytics] [04 Knowledge] [05 Research] | L1..L9 | Search |I|
+--------------------------------------------------------------------------------------------------+
| Breadcrumb: Explore > Neuroanatomy > Hippocampal Formation > CA1     | Provenance: Atlas Derived |
+------------------+------------------------------------------------------------+------------------+
| Left Context Rail|                   Primary Center Workspace                 | Right UCES       |
| (240px–280px)    |                   (Flexible 1fr Canvas / Grid)             | Inspector Dock   |
|                  |                                                            | (360px–420px)    |
| - Module Switcher|   - 3D Studio Viewport (Explore)                           |                  |
| - TNA Hierarchy  |   - 5-Panel Simulator Grid (Laboratory)                    | 12-Section       |
| - Model Catalog  |   - Multi-Channel Signal & Graph Workbench (Analytics)     | Contextual       |
| - Dataset List   |   - Encyclopedia / Knowledge Graph (Knowledge)             | Explanation      |
| - Presets        |   - Sweep Comparison & Research Notebook (Research)        | + Deep Link CTA  |
|                  +------------------------------------------------------------+                  |
|                  | Bottom Transport / Simulation Telemetry Bar (44px)         |                  |
+------------------+------------------------------------------------------------+------------------+
```

---

## 3. Five Work Environments Layout Specifications

1. **`ENV-01` — Explore Environment:**
   - **Left Rail:** Module selector (`MOD-01`–`07`, `09`, `10`) + searchable hierarchical entity tree (`TNA` anatomy tree, cell taxonomy, receptor families, or system pathways).
   - **Center Viewport:** Full-bleed 3D Studio (`A`, `B`, `C`, or `D`) with floating top-right camera preset bar, orthogonal slicing mini-map, and scale portal buttons.
   - **Right Dock:** UCES Selection Inspector (`Tier B`).
2. **`ENV-02` — Laboratory Environment (`MOD-08`):**
   - Implements the **5-Panel Standard Neural Simulation Workspace**:
     - Left Rail (`280px`): Model Catalog (`16` families / `28` models) + Experiment Presets (`EXP-*`).
     - Center Top-Left: **Panel 1 (Model & Theory)** & **Panel 2 (Experiment Setup: Parameters, Stimulus, Solver, `dt`)**.
     - Center Top-Right: **Panel 3 (Simulation View: Live 3D / Phase-Plane / Membrane Animation)**.
     - Center Bottom-Span: **Panel 4 (Results & Analytics: Voltage/Current/Spike/Rate Traces)** & **Panel 5 (Validation & Limitations)**.
     - Right Collapsible Dock: UCES Inspector for any clicked parameter, variable, or equation.
3. **`ENV-03` — Analytics Environment (`MOD-11`):**
   - Left Rail: Dataset selector (`datasets.json` + local CSV import) + Preprocessing & Filter Pipeline builder.
   - Center Multi-Pane Grid: Synchronized Time-Series Viewer (top), Spectral PSD / Morlet Wavelet Spectrogram or Spike Raster/PSTH (middle), and Connectivity Matrix / Statistical Summary Table (bottom).
4. **`ENV-04` — Knowledge Environment (`MOD-12`):**
   - Left Rail: Domain/Scale taxonomy filter + Equation/Glossary/Reference index.
   - Center Reading & Graph Canvas: Dedicated Scientific Entity Page (`/knowledge/:entityId`, `max-width: 920px` readable measure) alongside interactive split-view Knowledge Graph explorer.
5. **`ENV-05` — Research Environment:**
   - Left Rail: Saved Experiment Run history (`RUN-*`), Parameter Sweep jobs, and Research Notebooks.
   - Center Split Workspace: Multi-run overlay comparison charts + structured Markdown Research Notebook editor with reproducibility manifest inspector and `.cortexia.json` / CSV exporter.

---

## 4. Responsive Breakpoints

| Breakpoint | Viewport Width | Layout Adaptation |
|---|---|---|
| **Desktop Workstation** | `>= 1280px` | 3-column workstation (Left Rail + Center Workspace + Right UCES Inspector) |
| **Compact Laptop / Landscape Tablet** | `1024px – 1279px` | Left Rail collapses to `56px` icon rail (expandable overlay); Right UCES Inspector remains docked (`340px`) |
| **Portrait Tablet** | `768px – 1023px` | Single-column tabbed workspace; UCES Inspector opens as a slide-over right drawer (`85%` height bottom sheet option) |
| **Mobile Viewport** | `360px – 767px` | Sticky top environment bar + full-width stacked cards; 3D Studio uses touch orbit/pinch + tap-to-inspect bottom sheet (`50%` / `90%` snap points) |

## 5. Acceptance Criteria & Related Documents

- **AC-UX-002:** Switching between `ENV-01`–`ENV-05` preserves active entity selection, UCES Inspector state, and pinned simulation results without layout shift (`CLS < 0.05`).
- **Links:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [MODULE_UX_SPECIFICATIONS.md](MODULE_UX_SPECIFICATIONS.md), [ACCESSIBILITY.md](ACCESSIBILITY.md).
