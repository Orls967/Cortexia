# 3D Asset & Provenance Specification — CORTEXIA

**Document ID:** `DOC-VIS-003`  
**Module:** `MOD-02`–`MOD-06`, `MOD-08`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the metadata contract, scientific accuracy classifications, simplification disclosures, coordinate/scale rules, and entity-mapping invariants for all 3D asset groups (`ASSET-*`) in `registries/assets-3d/assets-3d.json` and `schemas/assets/asset-3d.schema.json`.

> [!WARNING]
> **Mandatory Geometric Honesty Rule:** Procedural, schematic, or artist-modeled 3D geometry MUST never be presented as experimental microscopy, cryo-EM atomic coordinates, or clinical MRI reconstructions. Every 3D viewport displays an explicit **Asset Provenance Badge**.

---

## 2. Scientific Accuracy Classifications for 3D Assets

| Accuracy Classification Enum | Meaning & Generation Method | Required Viewport Disclosure Badge |
|---|---|---|
| `PROCEDURAL_EDUCATIONAL_APPROXIMATION` | Parametric Three.js geometry generated in-browser and anchored on registry MNI centroids or topological layouts (used in Phase 1 standalone static build where external `.glb`/`.swc` files are not bundled) | `Procedural 3D Educational Approximation (Non-Clinical)` |
| `ATLAS_REFERENCE_MESH` | Surface mesh derived from open population stereotaxic atlases (`MNI152 / fsaverage / Julich-Brain / Allen CCF`) and decimated for WebGL | `Atlas Reference Geometry (Population Template, Simplified)` |
| `RECONSTRUCTED_MORPHOLOGY_SWC` | 3D tubular arbor generated directly from experimentally traced `SWC` morphology coordinates (`NeuroMorpho.Org` / `Allen Cell Types`) | `Reconstructed Cellular Morphology (SWC Trace)` |
| `BIOPHYSICAL_SCHEMATIC_3D` | Proportionally guided 3D structural schematic of organelles, synaptic clefts, or channel states | `Illustrative Biophysical 3D Schematic (Non-Atomistic)` |
| `PROCEDURAL_NETWORK_GRAPH` | Algorithmically positioned 3D node-edge graph driven by MNI centroids or force-directed layout | `Computational Network Graph Visualization` |

---

## 3. Mandatory Asset Metadata Contract (`schemas/assets/asset-3d.schema.json`)

Every 3D asset record in `assets-3d.json` MUST define:
- `id`: Immutable `^ASSET-[A-Z0-9-]+$` identifier.
- `name`: Human-readable asset group title.
- `studio`: Target studio (`STUDIO_A_WHOLE_BRAIN`, `STUDIO_B_CELLULAR`, `STUDIO_C_SYNAPTIC_MOLECULAR`, `STUDIO_D_NETWORK`).
- `format`: `GLB_DRACO`, `SWC_TUBE_GEOMETRY`, `PROCEDURAL_INSTANCED_MESH`, or `PROCEDURAL_PARAMETRIC_MESH`.
- `sourceMethod`: Provenance source or procedural generator module.
- `license`: License identifier (`CC0-1.0`, `CC-BY-4.0`, `ALLEN_NONCOMMERCIAL`, `MIT_PROCEDURAL`).
- `mappedEntityIds`: Non-empty array of scientific entity IDs (`ANAT-*`, `CELL-*`, `MOL-*`, `MECH-*`, `CIRC-*`) bound to sub-meshes or instances.
- `accuracyClassification`: One of the 5 enums in Section 2.
- `simplificationDisclosure`: Explicit sentence explaining geometric simplifications (e.g., vertex decimation ratio, uniform spine proxy, schematic channel cylinders).
- `spatialScaleUnit`: `mm`, `um`, `nm`, or `topological`.
- `lodTriangleBudgets`: `{ "lod0": number, "lod1": number, "lod2": number }`.
- `version`: Semantic version (`1.0.0`).
- `references`: Verified `REF-*` IDs.

---

## 4. Sub-Mesh Naming & Entity Resolution Invariant

In multi-part `.glb` scenes (such as Studio A Whole Brain), every selectable `THREE.Mesh` node name in the glTF hierarchy MUST equal its canonical `mappedEntityId` (e.g., `mesh.name = "ANAT-HIPPOCAMPUS-CA1"` or `mesh.userData.entityId = "ANAT-HIPPOCAMPUS-CA1"`). Unmapped decorative background meshes must set `mesh.userData.inspectable = false`.

## 5. Acceptance Criteria & Related Documents

- **AC-VIS-003:** `tools/documentation-audit/run_audit.py` verifies that 100% of `ASSET-*` entries in `assets-3d.json` map to valid existing entities, include simplification disclosures, and link to valid `REF-*` citations.
- **Links:** [3D_ENGINE_SPECIFICATION.md](3D_ENGINE_SPECIFICATION.md), [STUDIO_SPECIFICATIONS.md](STUDIO_SPECIFICATIONS.md), [UNIVERSAL_EXPLANATION_SYSTEM.md](UNIVERSAL_EXPLANATION_SYSTEM.md).
