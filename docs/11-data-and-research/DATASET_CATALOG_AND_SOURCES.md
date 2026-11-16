# Dataset Catalog & Scientific Data Sources — CORTEXIA

**Document ID:** `DOC-DATA-002`  
**Module:** `MOD-11`, `MOD-12`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document investigates the six primary external neuroscience data ecosystems specified for CORTEXIA (**Allen Brain Atlas**, **NeuroMorpho.Org**, **OpenNeuro**, **EBRAINS**, **DANDI Archive**, and **ModelDB**) and defines CORTEXIA's curated Dataset Catalog (`registries/datasets/datasets.json`).

---

## 2. Authoritative External Data Ecosystem Investigation

| Resource | Primary Content | Access Methods & Formats | Licensing & Restrictions | Mandatory Attribution Rule | Suitability for CORTEXIA |
|---|---|---|---|---|---|
| **Allen Brain Atlas** (`brain-map.org`, `REF-HAWRYLYCZ-2012`) | Human & Mouse brain atlases, gene expression, cell types electrophysiology (`NWB`), 3D CCF meshes | REST API (`api.brain-map.org`), `allensdk` (Python), NRRD/OBJ/SWC/NWB downloads | **Allen Institute Terms of Use:** Free for academic & **non-commercial** research/education; commercial redistribution requires written license (`terms@alleninstitute.org`). BICCN subsets often `CC BY 4.0`. | Clear citation of primary paper + link to source dataset **must appear on the same UI page** where content is displayed. | High for non-commercial educational reference coordinates, cell electrophysiology benchmarks, and CCF ontology. |
| **NeuroMorpho.Org** (`neuromorpho.org`, `REF-NEUROMORPHO-2007`) | >200,000 digitally reconstructed 3D neuronal & glial morphologies across species and cell types | REST API (`neuromorpho.org/api`), standardized **7-column ASCII `SWC`** files (`index, type, x, y, z, radius, parent`) | Open public repository for research & educational reuse subject to source attribution. | Must explicitly acknowledge **NeuroMorpho.Org** AND cite the **original contributing laboratory's peer-reviewed publication**. | Ideal for Studio B (`MOD-03`) 3D cellular morphology rendering and `MODEL-010` compartmental cable geometry. |
| **OpenNeuro** (`openneuro.org`, `REF-MARKIEWICZ-2021`) | Human MRI, fMRI, MEG, EEG, and iEEG neuroimaging datasets | Web portal, OpenNeuro CLI / DataLad / AWS S3; strictly structured in **BIDS** (`REF-GORGOLEWSKI-2016`) | Default **Creative Commons CC0 1.0 Public Domain Dedication** (after any embargo). | Cite dataset authors, dataset title, OpenNeuro accession (`ds00XXXX`), and DOI + `Markiewicz et al. (2021)`. | Ideal source for downsampled browser-safe EEG (`EDF/TSV/CSV`) and structural connectome ROI benchmarks. |
| **EBRAINS** (`ebrains.eu`, `kg.ebrains.eu`) | Human Brain Project atlases (`Julich-Brain`, `REF-AMUNTS-2020`), multi-scale models, electrophysiology | EBRAINS Knowledge Graph API, siibra-explorer / `siibra-python`, NIfTI/Gifti/NWB | Dataset-specific (predominantly **CC BY 4.0** or **CC BY-NC-SA 4.0**); human datasets governed by EBRAINS Data Use Agreement & GDPR. | Cite specific dataset DOI + Julich-Brain (`Amunts et al., 2020`) + EBRAINS infrastructure. | High for cytoarchitectonic probabilistic region metadata and neural mass reference parameters. |
| **DANDI Archive** (`dandiarchive.org`) | Cellular & systems neurophysiology (extracellular Neuropixels, intracellular patch, optical imaging) | DANDI REST API / CLI / S3 streaming; formatted in **NWB (`HDF5`/`Zarr`)** (`REF-RUBEL-2022`, `REF-TEETERS-2015`) | Openly licensed per Dandiset, predominantly **CC-BY 4.0** or **CC0 1.0**. | Cite Dandiset authors, `DANDI:XXXXXX` identifier, version, access date, and NWB (`Rübel et al., 2022`). | High for curated downsampled single-unit spike trains and intracellular trace examples (`MOD-11`). |
| **ModelDB / SenseLab** (`modeldb.science`, `REF-MCDOUGAL-2017`) | >1,800 published computational neuroscience model source codes (NEURON, Brian2, MATLAB, Python, NeuroML) | Web portal & REST API (`modeldb.science/api/v1`) indexed by accession number | Open academic/educational reuse; individual model code governed by author license + citation policy. | Cite **both** ModelDB (`McDougal et al., 2017`) with accession number AND the **original model publication**. | Authoritative reference oracle for verifying equations, parameter sets, and spike waveforms in `MOD-08`. |

---

## 3. Browser Size Constraints & Pre-Curated Subset Strategy

Raw neuroimaging (`NIfTI` volumes `>100 MB`) and raw `NWB` HDF5 files (`1–100 GB`) cannot be streamed naively into a static GitHub Pages client tab. CORTEXIA implements a **Three-Tier Dataset Delivery Strategy**:
1. **Bundled Curated Micro-Subsets (`<= 500 KB` per JSON/CSV/SWC file, lazy-loaded):** Pre-extracted, license-verified single-cell traces, SWC morphologies (`<= 3,000` vertices), 8–16 channel EEG epochs (`10–30 s` at `128–256 Hz`), and `68×68` parcellated connectivity matrices with full provenance manifests.
2. **Explicitly Labeled Synthetic Reference Datasets (`SYNTHETIC_BENCHMARK`):** Deterministic signals generated with known ground-truth frequencies, noise levels, or spike correlations for verifying `MOD-11` algorithms (e.g., `DSET-SYNTH-ALPHA-EEG`, `DSET-SYNTH-POISSON-SPIKES`).
3. **User Local File Import (`<= 50 MB` CSV/JSON/SWC):** Client-side `FileReader` / Web Worker parser with schema and unit validation; zero server upload.

## 4. Four Dataset Categories in `datasets.json`

1. **Anatomical Datasets (`DSET-ANAT-*`):** Desikan–Killiany 68-region parcellation metadata, Destrieux 148-region index, Julich-Brain cytoarchitectonic summary, MNI152 stereotaxic region centroids.
2. **Microscopic & Morphological Datasets (`DSET-MORPH-*`):** Curated SWC reconstructions (CA1 pyramidal, L5 pyramidal, cerebellar Purkinje, cortical PV+ basket interneuron, protoplasmic astrocyte).
3. **Electrophysiology Datasets (`DSET-EPHYS-*`):** Squid giant axon action potential reference trace, Allen Cell Types human L2/3 & L5 patch-clamp step responses, hippocampal CA1 LTP field EPSP summary, multi-unit spike train recordings.
4. **Functional & Network Recordings (`DSET-FUNC-*`):** Eyes-closed vs. eyes-open occipital alpha EEG epoch, visual evoked potential (`VEP`) trial average, 68-region structural & functional connectome matrices, synthetic ground-truth spectral/spike/graph benchmarks.

## 5. Acceptance Criteria & Related Documents

- **AC-DATA-002:** Every dataset in `registries/datasets/datasets.json` specifies `sourceRepository`, `license`, `attributionText`, `provenanceType` (`EMPIRICAL_CURATED` vs `SYNTHETIC_BENCHMARK`), `samplingRateHz` (where temporal), `units`, and `REF-*` citations.
- **Links:** [DATA_PROVENANCE_AND_LICENSES.md](DATA_PROVENANCE_AND_LICENSES.md), [SIGNAL_ANALYTICS.md](../08-neural-data-and-analytics/SIGNAL_ANALYTICS.md).

## 6. References

- `REF-HAWRYLYCZ-2012`: DOI `10.1038/nature11405`
- `REF-NEUROMORPHO-2007`: Ascoli et al. (2007), *J. Neurosci.*, DOI `10.1523/JNEUROSCI.2055-07.2007`
- `REF-MARKIEWICZ-2021`: DOI `10.7554/eLife.71774`
- `REF-GORGOLEWSKI-2016`: DOI `10.1038/sdata.2016.44`
- `REF-RUBEL-2022`: DOI `10.7554/eLife.78362`
- `REF-TEETERS-2015`: DOI `10.1016/j.neuron.2015.10.025`
- `REF-MCDOUGAL-2017`: DOI `10.1007/s10827-016-0623-7`
