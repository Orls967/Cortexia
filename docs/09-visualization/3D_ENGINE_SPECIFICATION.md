# 3D Visualization Engine Specification — CORTEXIA

**Document ID:** `DOC-VIS-001`  
**Module:** `MOD-01`–`MOD-06`, `MOD-08`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines CORTEXIA's WebGL2 / Three.js / React Three Fiber (`R3F`) rendering engine, covering scene graph organization, level-of-detail (`LOD`) management, GPU instancing, orthogonal clipping planes, raycasting for UCES hover/selection, simulation-linked attribute streaming, and WebGL resource lifecycle management.

## 2. Core Rendering Stack & Scene Architecture

- **Graphics Runtime:** `Three.js` (WebGL2Renderer, `powerPreference: "high-performance"`, `antialias: true`, `stencil: true` for cross-section cap rendering) orchestrated via `@react-three/fiber`.
- **Coordinate Convention:** Right-handed RAS neuroanatomical coordinate system (`+X = Right`, `+Y = Anterior`, `+Z = Superior`, units in `mm` for Studio A, `µm` for Studio B, `nm` for Studio C, normalized topological coordinates for Studio D).
- **Lighting & Shading:** Omniverse-inspired scientific PBR shading—3-point directional/hemisphere studio rig, subtle Fresnel rim shader for translucent outer cortex (`opacity: 0.12–0.25`, `depthWrite: false`), and colorblind-safe Viridis/Plasma/Ice-Blue activity colormaps.

---

## 3. Performance & Geometry Optimization Mechanisms

| Mechanism | Technical Specification | Target Studio(s) |
|---|---|---|
| **3-Tier Level of Detail (`THREE.LOD`)** | `LOD0` (`<150 units` camera distance: full mesh `15k–40k` tris), `LOD1` (`150–400 units`: `4k–10k` tris), `LOD2` (`>400 units`: `<1.5k` tris) | Studio A, Studio B |
| **GPU Instancing (`THREE.InstancedMesh`)** | Single draw call for repeated synaptic vesicles (`<= 2,000`), neurotransmitter particles (`<= 5,000`), ion channels (`<= 500`), or network soma nodes (`<= 4,000`) updated via `instanceMatrix` / `instanceColor` | Studio C, Studio D |
| **Draco / Meshopt glTF Compression** | Static `.glb` assets compressed to `<= 2.5 MB` per bundle chunk, loaded on demand via `SuspendableGLTF` | Studio A, Studio B |
| **BVH-Accelerated Raycasting (`three-mesh-bvh`)** | Bounding Volume Hierarchy acceleration structure keeps pointer hover raycast latency `< 1.5 ms` on 100k-triangle scenes | All Studios |
| **Stencil-Capped Orthogonal Clipping** | Three world-space `THREE.Plane` clipping planes (`Sagittal X`, `Coronal Y`, `Axial Z`) with stencil-buffer solid cross-section caps | Studio A |

---

## 4. Simulation-Linked Visualization Bridge

When a simulator runs in `ENV-02` (`MOD-08`), the Web Worker streams `Float32Array` visual telemetry frames (`<= 60 Hz` decimated from solver `dt`) directly into Three.js buffer attributes without React component re-renders:
- **Studio B (Cable / Compartmental `MODEL-010`):** Updates vertex color attribute `aVoltageColor` along soma, apical/basal dendritic segments, and axon nodes from `-80 mV` (deep navy) to `+40 mV` (cyan/amber peak).
- **Studio C (Synaptic Transmission `MODEL-013`/`016`):** Drives presynaptic $Ca^{2+}$ influx glow, vesicle fusion rate $u^+ x^-$, cleft neurotransmitter diffusion particles, and postsynaptic receptor opening fraction.
- **Studio D (Spiking & Oscillator Networks `MODEL-021`/`027`):** Updates `InstancedMesh` soma colors by membrane voltage $V_i(t)$ or phase $\theta_i(t)$ and pulses active synaptic edges on spike propagation.

---

## 5. WebGL Resource Cleanup & Context Loss Recovery

1. **Deterministic Disposal:** On Studio switch or component unmount, explicitly invoke `geometry.dispose()`, `material.dispose()`, `texture.dispose()`, and clear BVH trees to prevent GPU VRAM leaks (`< 350 MB` GPU budget).
2. **`webglcontextlost` / `webglcontextrestored` Handling:** Listen on canvas element; on context loss, pause active simulation playback, render a non-crashing recovery banner (*"3D Graphics Context Interrupted — Click to Restore or Continue in 2D Schematic Mode"*), and re-hydrate buffers upon restoration.

## 6. Acceptance Criteria & Related Documents

- **AC-VIS-001:** 3D studios sustain `>= 60 fps` on standard desktop GPUs (`>= 30 fps` integrated/mobile), complete raycast hover pickup in `< 2 ms`, and leak `0 MB` of undisposed geometries across 20 studio switches.
- **Links:** [STUDIO_SPECIFICATIONS.md](STUDIO_SPECIFICATIONS.md), [ANATOMICAL_ASSET_SPECIFICATION.md](ANATOMICAL_ASSET_SPECIFICATION.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](UNIVERSAL_EXPLANATION_SYSTEM.md).
