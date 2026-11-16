# Accessibility & Inclusive Interaction Specification — CORTEXIA

**Document ID:** `DOC-UX-004`  
**Standard:** WCAG 2.1 Level AA  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines CORTEXIA's keyboard navigation, screen-reader semantics, colorblind-safe scientific palettes, motion-reduction adaptations, and touch-device interaction rules across all 3D studios, simulators, and UCES explanation panels.

## 2. Keyboard Accessibility & Focus Management

| Interaction Surface | Keyboard Contract |
|---|---|
| **Global Shortcuts** | `Cmd/Ctrl + K`: Global Search · `Cmd/Ctrl + I`: Toggle UCES Inspector · `K`: Open Dedicated Knowledge Page for selected entity · `Escape`: Close tooltip/drawer/modal and restore focus |
| **3D Visualization Studios (`A–D`)** | Canvas is focusable (`tabIndex={0}`, `role="region"`, `aria-label`) with parallel keyboard-navigable **Structure/Node List Tree**; `Arrow` keys pan/orbit camera (`±5°`), `+/-` zoom, `Enter` inspects focused structure |
| **UCES Inspector & Drawers** | Opening the Inspector announces selection via an `aria-live="polite"` region; modal drawers trap focus cleanly and return focus to the trigger element on close |
| **Simulator Sliders (`MOD-08`)** | Native/ARIA `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (including physical units, e.g., `"120 milliSiemens per square centimeter"`); `ArrowLeft/Right` steps by `1×`, `Shift + Arrow` steps by `10×` |

---

## 3. Colorblind-Safe Scientific Visualization Palettes

1. **Continuous Heatmaps & Spectrograms:** Default to perceptually uniform, colorblind-safe **Viridis** or **Cividis** colormaps. Rainbow/Jet colormaps are strictly prohibited.
2. **Multi-Trace Line Plots (`MOD-08`, `MOD-11`):** Use the **Okabe–Ito** colorblind-safe qualitative palette paired with distinct stroke dash patterns (`solid`, `dashed`, `dotted`, `dash-dot`) and point markers so traces remain distinguishable in monochromatic vision.
3. **Excitatory vs. Inhibitory Coding:** Excitatory (`#38BDF8` ice cyan + upward triangle/plus badge) vs. Inhibitory (`#A855F7` violet + circle/minus badge) never rely on color alone.

---

## 4. Screen-Reader Equivalents for Visual Canvases

- **3D Scenes:** Expose a synchronized `<table class="sr-only">` or collapsible accessible tree listing visible structures, their scale level, and active relationship highlights.
- **Simulation & Signal Charts:** Every chart provides a **"View Data Table / Summary Metrics"** toggle exposing numerical summary statistics (min, max, mean, spike count, dominant frequency) in an accessible HTML `<table>`.

## 5. Touch & Reduced-Motion Adaptations

- **Touch Devices (`pointer: coarse`):** Minimum interactive tap target `44×44 CSS px`; hover tooltips are suppressed in favor of tap-to-pill / bottom-sheet Inspector.
- **`prefers-reduced-motion: reduce`:** Disables continuous idle 3D auto-rotation and replaces smooth camera fly-to animations with instant transitions.

## 6. Acceptance Criteria & Related Documents

- **AC-UX-004:** Zero critical/serious `axe-core` accessibility violations across all 5 Work Environments and 12 Modules in Playwright automated accessibility audits.
- **Links:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](../09-visualization/UNIVERSAL_EXPLANATION_SYSTEM.md).
