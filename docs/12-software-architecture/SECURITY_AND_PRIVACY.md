# Security, Privacy & Scientific Safety Specification — CORTEXIA

**Document ID:** `DOC-ARCH-006`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This specification defines CORTEXIA's scientific safety boundaries, non-clinical posture, human-subject data privacy controls, local file-handling security, content integrity protections, and dependency/licensing safeguards.

---

## 2. Scientific & Non-Clinical Safety Boundaries

CORTEXIA is strictly an **educational and computational neuroscience exploration platform**. Across the application shell, footer, dataset importer, EEG analytics workbench (`MOD-11`), and Computational Psychiatry pages (`DOM-CP`), the following boundaries are enforced:

1. **No Clinical Diagnosis or Triage:** User-imported EEG/signal files (`CSV`/`EDF`-converted) are analyzed purely for mathematical signal properties (PSD, filtering, coherence). CORTEXIA never outputs diagnostic labels (e.g., epilepsy, depression, schizophrenia, Alzheimer's detection) or clinical alerts.
2. **No Pharmacological or Medical Advice:** Receptor and neurotransmitter explanations (`MOD-04`) describe biophysical mechanisms only.
3. **No Mind-Reading or Individual Profiling Claims:** Cognitive and neural decoding explanations explicitly document low signal-to-noise ratios, non-stationarity, and ethical boundaries.
4. **Mandatory Synthetic vs. Empirical Labelling:** Every chart, export file, and 3D scene displays a machine- and human-readable badge distinguishing **Simulated / Synthetic Data** from **Curated Empirical Research Data**.

---

## 3. Data Privacy & Human-Subject Considerations

1. **Zero Server-Side Data Transmission:** CORTEXIA runs as a 100% static client-side application on GitHub Pages. When a user imports a local CSV, SWC, or `.cortexia.json` file, the file is read exclusively via browser `File` / `ArrayBuffer` APIs inside local memory/workers and is **never uploaded, logged, or transmitted over the network**.
2. **De-Identified Open Datasets Only:** Curated empirical reference datasets bundled or referenced by CORTEXIA (`OpenNeuro`, `Allen Brain Atlas`, `DANDI`, `EBRAINS`) are restricted to publicly released, IRB/ethics-approved, fully de-identified datasets (defaced MRI / anonymized neurophysiology IDs).
3. **User Local Storage Hygiene:** Saved Research Notebooks and custom parameter presets in `IndexedDB` / `localStorage` store only model configurations and numerical traces, with a one-click **"Clear All Local Workspace Data"** control.

---

## 4. Application Security Controls

| Threat Vector | Mitigation Specification |
|---|---|
| **XSS via Imported Files / Notebook Markdown** | Render user notes and imported metadata exclusively through React escaped text nodes or `DOMPurify`-sanitized Markdown; forbid raw `dangerouslySetInnerHTML` on untrusted strings. |
| **CSV Formula Injection on Export/Import** | Prefix any exported or imported string cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a safe single quote or strip control characters. |
| **Zip-Bomb / Memory Exhaustion on Import** | Enforce strict `<= 50 MB` byte size check before `FileReader.readAsText/ArrayBuffer` and cap parsed array dimensions (`<= 32` channels × `500,000` samples). |
| **Prototype Pollution in JSON Manifests** | Parse `.cortexia.json` imports through `Zod` strict schemas rejecting `__proto__`, `constructor`, and `prototype` keys. |
| **Content Security Policy (`CSP`)** | Configure `<meta http-equiv="Content-Security-Policy">` restricting `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self' blob:`, `object-src 'none'`, and `base-uri 'self'`. |
| **Dependency Supply Chain** | Lock exact versions in `package-lock.json`, minimize third-party runtime dependencies, and run `npm audit` in CI. |

## 5. Acceptance Criteria & Related Documents

- **AC-ARCH-006:** Zero outbound network requests occur when importing or analyzing user data files; non-clinical & synthetic provenance disclaimers appear on all required modules and exports.
- **Links:** [PROJECT_CHARTER.md](../00-governance/PROJECT_CHARTER.md), [DATA_PROVENANCE_AND_LICENSES.md](../11-data-and-research/DATA_PROVENANCE_AND_LICENSES.md), [ERROR_HANDLING.md](ERROR_HANDLING.md).
