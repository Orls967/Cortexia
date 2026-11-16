# Scientific UI Design System — CORTEXIA

**Document ID:** `DOC-UX-001`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines CORTEXIA's visual design language, color tokens, typography scale, spacing grid, scientific widget components, and visual restraint rules.

## 2. Visual Direction — Omniverse-Inspired Computational Research Studio

CORTEXIA's aesthetic is modeled after precision scientific instruments and workstation software (NVIDIA Omniverse, ParaView, Allen Brain Explorer):
- **Primary Surfaces:** Deep graphite and midnight navy backgrounds that maximize dynamic range for 3D anatomical shading and multi-trace oscilloscope plots.
- **Signal & Neural Accents:** High-contrast ice blue and cyan for baseline neural structures and excitatory activity, violet for inhibitory/plasticity/selected neural accents, and amber for threshold indicators, provenance notices, and numerical warnings.
- **Explicit Anti-Patterns (Prohibited):** Hospital EHR white-and-teal admin templates, cyberpunk neon glow overload, decorative sci-fi HUD clutter that obscures axis labels, or low-contrast gray-on-black text.

---

## 3. Semantic Color Token Specification

| Token Name | Hex Value | Usage Context & WCAG AA Contrast |
|---|---|---|
| `--bg-canvas-primary` | `#0A0E17` | Root application & 3D Studio viewport background |
| `--bg-panel-elevated` | `#111827` | Workspace panels, left hierarchy tree, bottom timeline bar (`1px` border `#1E293B`) |
| `--bg-inspector-dock` | `#151E30` | UCES Right Selection Inspector & modal drawers |
| `--bg-control-input` | `#1E293B` | Parameter sliders, number inputs, dropdowns |
| `--text-primary` | `#F1F5F9` | Primary body copy, equations, titles (`>14:1` contrast on `#0A0E17`) |
| `--text-secondary` | `#94A3B8` | Axis labels, parameter descriptions, secondary metadata (`>6.5:1` contrast) |
| `--text-muted` | `#64748B` | Disabled states, subtle grid captions (`>=4.5:1` on `#0A0E17`) |
| `--accent-ice-blue` | `#38BDF8` | Primary interactive highlight, excitatory traces, selected 3D mesh outline |
| `--accent-neural-cyan` | `#06B6D4` | Active signal propagation, hover states, `L1–L4` scale indicators |
| `--accent-activity-violet`| `#A855F7` | Inhibitory populations, STDP plasticity curves, secondary comparison trace |
| `--accent-indicator-amber`| `#F59E0B` | Action potential threshold line, provenance badges, numerical stiffness warnings |
| `--status-valid-emerald` | `#10B981` | Validation passed (`VAL-*`), stable fixed point, empirical structural badge |
| `--status-error-rose` | `#F43F5E` | Numerical divergence, threshold exceeded, lesion target |

---

## 4. Typography & Data-Ink Hierarchy

- **UI & Scientific Prose Font (`--font-sans`):** `Inter` or system geometric sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`), optimized for dense technical reading (`14px` base / `1.55` line-height).
- **Numerical & Code Monospace (`--font-mono`):** `JetBrains Mono` or `Fira Code` with `font-variant-numeric: tabular-nums` mandatory on all parameter sliders, time counters, matrix cells, and coordinate readouts so digits never jitter during 60 Hz playback.
- **Mathematical Equations:** `KaTeX` 1.0 serif math rendering at `1.05rem` display size.

| Scale Token | Size / Line-Height | Weight | Usage |
|---|---|---|---|
| `type-display-sm` | `20px / 28px` | `600` | Module header, Dedicated Knowledge Page title |
| `type-heading-md` | `16px / 24px` | `600` | Workspace panel title, Inspector entity name |
| `type-heading-sm` | `13px / 18px` | `600` | Uppercase section headers (`letter-spacing: 0.05em`) |
| `type-body-md` | `14px / 22px` | `400` | Encyclopedia prose, detailed mechanism narrative |
| `type-data-sm` | `12px / 16px` | `500` (tabular) | Parameter controls, axis ticks, tooltip definitions |

---

## 5. Core Scientific UI Component Primitives

1. **`<ScientificParameterControl>`:** Displays parameter symbol ($g_{\text{Na}}$), canonical name, UCES hover/click info button, range slider, exact numeric input box, physical unit badge (`mS/cm²`), and reset-to-literature-default button.
2. **`<ProvenanceBadge>`:** Color-coded pill (`EMPIRICAL STRUCTURAL`, `ESTIMATED FUNCTIONAL`, `SYNTHETIC SIMULATION`, `ATLAS DERIVED`, `PROCEDURAL 3D`) with UCES hover explanation.
3. **`<UCESTooltipPortal>` & `<UCESInspectorDrawer>`:** Standardized Tier A and Tier B explanation surfaces.
4. **`<ScientificTraceCanvas>`:** High-DPI Canvas2D oscilloscope with crosshair readout, zoom-box, unit-labeled axes, and threshold overlay.

## 6. Acceptance Criteria & Related Documents

- **AC-UX-001:** All color combinations meet WCAG 2.1 AA contrast (`>= 4.5:1` normal text, `>= 3:1` UI graphics); all numeric readouts enforce `tabular-nums`.
- **Links:** [APPLICATION_LAYOUT_AND_ENVIRONMENTS.md](APPLICATION_LAYOUT_AND_ENVIRONMENTS.md), [MODULE_UX_SPECIFICATIONS.md](MODULE_UX_SPECIFICATIONS.md), [ACCESSIBILITY.md](ACCESSIBILITY.md).
