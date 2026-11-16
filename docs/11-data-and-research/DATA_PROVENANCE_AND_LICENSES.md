# Data Provenance, Formats & Licensing Specification — CORTEXIA

**Document ID:** `DOC-DATA-003`  
**Module:** `MOD-11`, `MOD-12`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the legal licensing rules, attribution display requirements, de-identification/privacy safeguards, and standard neuroinformatics file formats (`SWC`, `BIDS`, `NWB`-derived JSON/CSV) enforced across CORTEXIA.

## 2. License Compliance Matrix

| License Code | Permitted in CORTEXIA Static Bundle? | Commercial Reuse Permitted? | Required UI Attribution Behavior |
|---|---|---|---|
| `CC0-1.0` | Yes (OpenNeuro / DANDI CC0 subsets) | Yes | Display source dataset title, authors, accession ID & DOI in Dataset Inspector |
| `CC-BY-4.0` | Yes (EBRAINS / BICCN / DANDI CC-BY subsets) | Yes (with attribution) | Display creator names, license link (`CC BY 4.0`), DOI, and modification notice ("Downsampled for browser visualization") |
| `ALLEN_NONCOMMERCIAL` | Reference metadata/citations or strictly non-commercial educational deployments | **No** (Requires explicit commercial license from Allen Institute) | Display official Allen Institute citation string **on the same screen** where any Allen-derived data/coordinate appears |
| `SYNTHETIC_INTERNAL` | Yes (CORTEXIA deterministic benchmark generators) | Yes (`MIT` / project license) | Display prominent **`SYNTHETIC BENCHMARK`** badge so users never mistake generated data for empirical recordings |

---

## 3. Supported Neuroinformatics Format Specifications

### 3.1 Standardized SWC Neuronal Morphology Format (`MOD-03`, Studio B)
ASCII whitespace-delimited lines (comments prefixed with `#`) where each node row contains 7 fields (`REF-NEUROMORPHO-2007`):
```text
# n  type  x(µm)   y(µm)   z(µm)   radius(µm)  parent_n
  1  1     0.00    0.00    0.00    8.50        -1
  2  3     1.20    4.50    0.30    1.40         1
  3  4     0.00   15.00    0.00    2.10         1
```
- `type` codes: `1 = soma`, `2 = axon`, `3 = basal dendrite`, `4 = apical dendrite`, `5+ = custom/glia`.
- Validation rule: Root node has `parent_n = -1`; all other nodes must reference an existing `parent_n < n` (acyclic tree invariant).

### 3.2 BIDS-Compatible Electrophysiology Metadata (`MOD-11`, `REF-GORGOLEWSKI-2016`)
Every multi-channel signal dataset in CORTEXIA includes sidecar metadata equivalent to BIDS `*_eeg.json` and `*_channels.tsv`:
- `SamplingFrequency` ($\text{Hz}$), `PowerLineFrequency` ($50$ or $60\text{ Hz}$), `EEGReference` (e.g., `average` or `Cz`), `SoftwareFilters`.
- Channel table: `name`, `type` (`EEG`, `EOG`, `EMG`, `LFP`, `SEEG`), `units` (`µV`, `mV`), `status` (`good` / `bad`).

### 3.3 Client-Side CSV / JSON Import Contract (`MOD-11`)
User-imported CSV files are parsed inside a Web Worker with strict validation:
1. File size cap `<= 50 MB`; row cap `<= 500,000` samples.
2. Header row or user-mapped columns identifying `time_ms` / `samplingRateHz` and physical channel units.
3. Formula-injection sanitization (strip leading `=`, `+`, `-`, `@` on string cells) and `NaN`/missing-value interpolation or rejection report.

## 4. Human-Subject Data & Privacy Safeguards

- All bundled empirical datasets derive exclusively from publicly consented, fully de-identified open scientific repositories (`OpenNeuro`, `Allen Brain Atlas`, `DANDI`, `EBRAINS`).
- User-imported local files are processed **100% locally in browser memory** and are never transmitted to any remote server.

## 5. Acceptance Criteria & Related Documents

- **AC-DATA-003:** Zero dataset records in `datasets.json` omit license, attribution text, unit definitions, or synthetic-vs-empirical classification.
- **Links:** [DATASET_CATALOG_AND_SOURCES.md](DATASET_CATALOG_AND_SOURCES.md), [SECURITY_AND_PRIVACY.md](../12-software-architecture/SECURITY_AND_PRIVACY.md).
