# Neuroanatomy Specification (Module 02) — CORTEXIA

**Document ID:** `DOC-ANAT-001`  
**Module:** `MOD-02` (Neuroanatomy Atlas)  
**Biological Scales:** `L6` Mesoscopic, `L7` Brain Regions  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Document Purpose and Scope

This document defines the scientific coverage, nomenclature standards, 3D inspection capabilities, atlas coordinate support, and Knowledge Graph integration for **Module 02 — Neuroanatomy Atlas**.

## 2. Anatomical Domain Coverage

CORTEXIA's anatomical atlas (`registries/anatomical-entities/anatomical-entities.json`) organizes the human central and peripheral nervous system using **Terminologia Neuroanatomica (TNA, FIPAT)** into sixteen major divisions:

1. **Cerebral Hemispheres:** Left & right hemispheres, longitudinal fissure, corpus callosum (rostrum, genu, body, splenium), anterior/posterior commissures.
2. **Cerebral Lobes:** Frontal, parietal, temporal, occipital, insular, and limbic lobes.
3. **Gyri and Sulci:** Precentral, postcentral, superior/middle/inferior frontal, superior/middle/inferior temporal, angular, supramarginal, fusiform, parahippocampal, cingulate gyri; central, lateral (Sylvian), parieto-occipital, calcarine sulci.
4. **Cerebral Cortex:** Six-layered neocortex (layers I–VI), allocortex (archicortex & paleocortex), laminar cytoarchitecture, and Brodmann/HCP-MMP1.0 reference annotations (`REF-GLASSER-2016`).
5. **Basal Ganglia:** Caudate nucleus, putamen, nucleus accumbens, globus pallidus externus (`GPe`), globus pallidus internus (`GPi`), subthalamic nucleus (`STN`), substantia nigra pars compacta (`SNc`) and pars reticulata (`SNr`).
6. **Thalamus and Hypothalamus:** Anterior, mediodorsal, ventral posterolateral/posteromedial (`VPL/VPM`), ventral lateral/anterior (`VL/VA`), lateral/medial geniculate nuclei (`LGN/MGN`), pulvinar, thalamic reticular nucleus (`TRN`); suprachiasmatic (`SCN`), paraventricular (`PVN`), arcuate, ventromedial, and lateral hypothalamic nuclei, mammillary bodies, pituitary stalk.
7. **Hippocampal Formation:** Dentate gyrus (`DG`), cornu ammonis subfields (`CA3`, `CA2`, `CA1`), subiculum, presubiculum, parasubiculum, entorhinal cortex (`EC`), fimbria-fornix.
8. **Amygdala:** Basolateral complex (`BLA`), central nucleus (`CeA`), medial nucleus, cortical nucleus, stria terminalis.
9. **Limbic Structures:** Cingulate cortex (anterior `ACC`, midcingulate, posterior `PCC`), septal nuclei, orbitofrontal cortex, mammillothalamic tract.
10. **Cerebellum:** Cerebellar hemispheres, vermis, flocculonodular lobe, three-layered cerebellar cortex (molecular, Purkinje, granule), deep cerebellar nuclei (dentate, interposed/emboliform+globose, fastigial), superior/middle/inferior peduncles.
11. **Brainstem:** Midbrain (tectum/superior & inferior colliculi, tegmentum, cerebral peduncles, periaqueductal gray `PAG`, red nucleus, VTA), Pons (pontine nuclei, locus coeruleus, raphe nuclei, parabrachial complex), Medulla Oblongata (pyramids, inferior olive, nucleus tractus solitarius `NTS`, area postrema, medullary reticular formation).
12. **Ventricular System & Meninges:** Lateral ventricles, interventricular foramina (of Monro), third ventricle, cerebral aqueduct (of Sylvius), fourth ventricle, choroid plexus, dura/arachnoid/pia mater, subarachnoid cisterns.
13. **Spinal Cord:** Cervical, thoracic, lumbar, sacral segments; dorsal/ventral/lateral gray horns, dorsal columns, spinothalamic and corticospinal tracts, central canal.
14. **Peripheral Nervous System (PNS):** Dorsal root ganglia (`DRG`), spinal nerve roots, brachial/lumbosacral plexuses, sympathetic chain ganglia, parasympathetic ganglia, enteric nervous system overview.
15. **Cranial Nerves (CN I – CN XII):** Olfactory (`I`), Optic (`II`), Oculomotor (`III`), Trochlear (`IV`), Trigeminal (`V`), Abducens (`VI`), Facial (`VII`), Vestibulocochlear (`VIII`), Glossopharyngeal (`IX`), Vagus (`X`), Accessory (`XI`), Hypoglossal (`XII`) with brainstem nuclei & modality tags (sensory/motor/mixed/parasympathetic).
16. **Major White Matter Tracts:** Internal capsule, corona radiata, arcuate fasciculus, uncinate fasciculus, cingulum bundle, superior/inferior longitudinal fasciculi.

---

## 3. Advanced Anatomical Inspection Features

| Capability | Behavior Specification | UCES Integration |
|---|---|---|
| **3D Inspection** | 360° orbit, pan, zoom, smooth camera fly-to selected structure (`Studio A`) | Hover highlights + tooltip; click opens `ANAT-*` inspector |
| **Hierarchical Tree** | Expandable/searchable TNA parent–child tree synchronized bidirectionally with 3D selection | Tree hover previews mesh outline; click selects & focuses |
| **Orthogonal Views** | Instant camera/slice presets for Sagittal (`X`), Coronal (`Y`), and Axial (`Z`) planes | Axis orientation gizmo always visible (`L/R/A/P/S/I`) |
| **Section Clipping** | Interactive WebGL clipping plane slider along sagittal, coronal, or axial axes | Preserves cross-sectional cap shading without leaking hidden meshes |
| **Region Isolation** | Isolate selected structure (`100%` opacity) while ghosting siblings (`12%` translucent wireframe) | Shows immediate anatomical neighbors & white-matter links |
| **Relationship Highlighting** | Highlight structural white-matter connections (`ANATOMICAL_CONNECTION`) vs functional systems (`ASSOCIATED_WITH`) | Distinct line styles (solid vs dashed) + legend |
| **Atlas Coordinate Support** | Where licensed/valid (e.g., MNI152 stereotaxic centroid mm `[x, y, z]`), display approximate reference coordinates with explicit population-average disclaimer | Never claim exact coordinate match for schematic/procedural subparts |

---

## 4. Scientific Integrity & Localization Guardrails

- **Consistent Nomenclature:** All structures map canonical TNA English/Latin terms alongside common aliases (e.g., *Hippocampus proper* / *Ammon's horn*).
- **Non-Localization Policy:** Anatomical inspector fields explicitly differentiate **Structural Connectivity** from **Distributed Functional Involvement**, never attributing complex cognitive functions exclusively to a single isolated nucleus.

## 5. Assumptions, Dependencies & Acceptance Criteria

- **Assumptions:** Adult human macroanatomy serves as the canonical reference; developmental and comparative variants are annotated via `DOM-DEV` and `DOM-COMP`.
- **Dependencies:** [ANATOMICAL_HIERARCHY_AND_ATLAS_PROVENANCE.md](ANATOMICAL_HIERARCHY_AND_ATLAS_PROVENANCE.md), [STUDIO_SPECIFICATIONS.md](../09-visualization/STUDIO_SPECIFICATIONS.md).
- **AC-ANAT-001:** Every anatomical entity in `anatomical-entities.json` has an immutable `ANAT-*` ID, parent linkage, TNA name, atlas provenance, and UCES explanation record.

## 6. References

- `REF-TNA-FIPAT`: FIPAT *Terminologia Neuroanatomica* (IFAA).
- `REF-DESIKAN-2006`: Desikan et al. (2006), DOI: `10.1016/j.neuroimage.2006.01.021`.
- `REF-DESTRIEUX-2010`: Destrieux et al. (2010), DOI: `10.1016/j.neuroimage.2010.06.010`.
- `REF-AMUNTS-2020`: Amunts et al. (2020), *Julich-Brain*, DOI: `10.1126/science.abb4588`.
- `REF-GLASSER-2016`: Glasser et al. (2016), *HCP-MMP1.0*, DOI: `10.1038/nature18933`.
- `REF-HAWRYLYCZ-2012`: Hawrylycz et al. (2012), *Allen Human Brain Atlas*, DOI: `10.1038/nature11405`.
