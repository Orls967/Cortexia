# Documentation Standard — CORTEXIA

**Document ID:** `DOC-GOV-002`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This standard defines structural, stylistic, identifier, unit, citation, and cross-referencing rules for all CORTEXIA Phase 0 documentation, JSON Schemas, scientific registries, and audit tooling.

## 2. Canonical Identifier Grammar

Every artifact in CORTEXIA MUST use a unique, immutable, uppercase-prefix identifier validated by `tools/documentation-audit/run_audit.py`:

| Prefix | Domain | Pattern | Example |
|---|---|---|---|
| `DOC-` | Specification document | `^DOC-[A-Z]{2,5}-[0-9]{3}$` | `DOC-GOV-002` |
| `MOD-` | Primary product module (`M01`–`M12`) | `^MOD-(0[1-9]|1[0-2])$` | `MOD-08` |
| `ENV-` | Work environment (`01`–`05`) | `^ENV-0[1-5]$` | `ENV-02` |
| `SCALE-` | Biological scale (`L1`–`L9`) | `^L[1-9]$` | `L4` |
| `ANAT-` | Anatomical structure | `^ANAT-[A-Z0-9-]+$` | `ANAT-HIPPOCAMPUS` |
| `CELL-` | Cell type or subtype | `^CELL-[A-Z0-9-]+$` | `CELL-PYRAMIDAL-CA1` |
| `MOL-` | Molecular / neurochemical entity | `^MOL-[A-Z0-9-]+$` | `MOL-NAV1-1` |
| `MECH-` | Physiological / synaptic mechanism | `^MECH-[A-Z0-9-]+$` | `MECH-ACTION-POTENTIAL` |
| `CIRC-` | Neural circuit or white-matter pathway | `^CIRC-[A-Z0-9-]+$` | `CIRC-HIPP-TRISYNAPTIC` |
| `SYS-` | Functional brain system | `^SYS-[A-Z0-9-]+$` | `SYS-VISUAL` |
| `COG-` | Cognitive domain / construct | `^COG-[A-Z0-9-]+$` | `COG-WORKING-MEMORY` |
| `MODEL-` | Computational model implementation | `^MODEL-[A-Z0-9-]+$` | `MODEL-HODGKIN-HUXLEY` |
| `EQ-` | Mathematical equation | `^EQ-[A-Z0-9-]+$` | `EQ-HH-MEMBRANE` |
| `PARAM-` | Model / physiological parameter | `^PARAM-[A-Z0-9-]+$` | `PARAM-HH-GNA-MAX` |
| `EXP-` | Interactive computational experiment | `^EXP-[A-Z0-9-]+$` | `EXP-HH-EXCITABILITY` |
| `ANALYTIC-` | Analysis method | `^ANALYTIC-[A-Z0-9-]+$` | `ANALYTIC-WELCH-PSD` |
| `DSET-` | Dataset catalog record | `^DSET-[A-Z0-9-]+$` | `DSET-OPENNEURO-DS003020` |
| `REF-` | Verified scientific reference | `^REF-[A-Z0-9-]+$` | `REF-HH-1952` |
| `ASSET-` | 3D visualization asset specification | `^ASSET-[A-Z0-9-]+$` | `ASSET-BRAIN-WHOLE` |
| `REQ-` | Product / engineering requirement | `^REQ-[A-Z0-9-]+$` | `REQ-UCES-001` |
| `VAL-` | Validation case / test oracle | `^VAL-[A-Z0-9-]+$` | `VAL-HH-AP-THRESHOLD` |
| `ADR-` | Architecture decision record | `^ADR-[0-9]{3}$` | `ADR-001` |

## 3. Mandatory Document Structure

Substantial Markdown specifications under `docs/` MUST include:
1. Header metadata block (`Document ID`, `Status`, `Last Updated`, plus `Module`/`Related Scales` where applicable).
2. `Purpose` and `Scope`.
3. `Terminology` (or explicit cross-link to [GLOSSARY.md](GLOSSARY.md) plus document-local terms).
4. `Background` (scientific or engineering context).
5. `Detailed Specification` (interfaces, behavioral rules, equations, or schemas).
6. `Assumptions` and `Limitations`.
7. `Dependencies`.
8. `Validation Requirements` and `Acceptance Criteria`.
9. `Related Documents` (relative Markdown links verified by link checker).
10. `References` (mapping to verified `REF-*` keys in `registries/scientific-references/scientific-references.json`).

## 4. Mathematical & Unit Conventions

- Equations MUST use explicit LaTeX notation (`$$...$$` for numbered/key equations and `$...$` for inline symbols).
- Every variable and parameter appearing in an equation MUST be defined with physical units (`mV`, `ms`, `µA/cm²`, `mS/cm²`, `µF/cm²`, `nS`, `pA`, `pF`, `Hz`, `mM`, or `dimensionless`) matching [MATHEMATICAL_CONVENTIONS.md](../06-computational-models/MATHEMATICAL_CONVENTIONS.md).
- Sign conventions (e.g., inward sodium current as negative ionic current subtracted in $C_m \frac{dV}{dt} = I_{\text{ext}} - I_{\text{Na}} - I_{\text{K}} - I_{\text{L}}$) MUST remain invariant across all docs and registries.

## 5. Scientific Integrity & Citation Rules

1. **No Fabricated Citations:** Every `REF-*` entry in the Reference Registry must cite a verified peer-reviewed publication (with verified DOI or ISBN), authoritative textbook, or official dataset repository portal.
2. **Epistemic Tagging:** Claims must distinguish between:
   - `ESTABLISHED` — widely replicated empirical/textbook fact.
   - `ACTIVE_RESEARCH` — empirically supported hypothesis with ongoing scientific debate.
   - `THEORETICAL_MODEL` — mathematical idealization or conceptual framework.
   - `SYNTHETIC_ILLUSTRATIVE` — simplified example data or procedural visual representation.
3. **Unresolved Topics:** Any scientific value lacking authoritative verification must be explicitly marked `UNRESOLVED` with rationale rather than invented.

## 6. Schema & Registry Rules

- All JSON Schemas follow **JSON Schema Draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`).
- Registries are UTF-8 JSON files validated against their corresponding schemas and cross-checked for referential integrity (zero broken `REF-*`, `EQ-*`, `MODEL-*`, `ANAT-*`, or `ASSET-*` pointers).

## 7. Validation & Acceptance Criteria

- **VAL-GOV-002:** Automated auditor confirms zero empty files, zero broken relative Markdown links, zero duplicate IDs, and 100% valid JSON/schema conformance.

## 8. Related Documents

- [PROJECT_CHARTER.md](PROJECT_CHARTER.md)
- [GLOSSARY.md](GLOSSARY.md)
- [MATHEMATICAL_CONVENTIONS.md](../06-computational-models/MATHEMATICAL_CONVENTIONS.md)
- [TRACEABILITY_MATRIX.md](../14-quality-and-validation/TRACEABILITY_MATRIX.md)
