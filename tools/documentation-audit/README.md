# CORTEXIA Automated Documentation & Schema Audit Suite

**Document ID:** `DOC-TOOL-001`  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

`tools/documentation-audit/run_audit.py` is CORTEXIA's zero-dependency Python 3 verification engine enforcing all **17 mandatory Phase 0 audit checks** (Master Prompt Section 22 & Section 27) across `docs/`, `schemas/`, and `registries/`.

## 2. How to Run the Audit

From the repository root (`/Users/orl123456/Documents/Cortexia`):

```bash
python3 tools/documentation-audit/run_audit.py
```

- **Exit Code `0`:** All 17 checks passed with zero errors; machine-readable and Markdown reports are written to `reports/`.
- **Exit Code `1`:** One or more contract violations detected; exact error codes and paths are printed to `stdout` and recorded in `reports/documentation-audit/audit-report.json`.

## 3. Seventeen Automated Checks Performed

1. **Markdown File Inventory:** Counts files, lines, and words across `README.md`, `docs/`, and `tools/`.
2. **Empty-Document Detection (`[EMPTY_DOC]`):** Rejects any Markdown file with `< 15` lines or `< 200` characters.
3. **Broken Relative Links (`[BROKEN_LINK]`):** Resolves every relative Markdown link target on disk.
4. **Broken Heading Anchors (`[BROKEN_ANCHOR]`):** Verifies `#anchor` fragments against GitHub-slugified target headings.
5. **Duplicate ID Detection (`[DUPLICATE_DOC_ID]`, `[DUPLICATE_ENTITY_ID]`):** Enforces global uniqueness of `DOC-*` and entity IDs.
6. **Required Metadata & Sections (`[MISSING_METADATA]`, `[MISSING_SECTION]`):** Verifies `Document ID`, `Status`, `Last Updated`, `Purpose`, and `Scope`.
7. **JSON Syntax Validation (`[JSON_SYNTAX_ERROR]`):** Parses every `.json` file in `schemas/` and `registries/`.
8. **JSON Schema Draft 2020-12 Validation:** Validates all 17 registries, verifies that all `schemas/examples/valid/*.json` pass, and verifies that all `schemas/examples/invalid/*.json` are rejected.
9. **Registry Foreign-Key Consistency:** Verifies all cross-registry pointers (`parentId`, `connectedStructureIds`, `associatedSystemIds`, `associatedModelIds`, `assetId`, `governingEquationIds`, `parameterIds`, `validationCaseIds`).
10. **Scientific Reference Integrity (`[UNKNOWN_REF]`):** Verifies that every entity cites existing `REF-*` entries in `scientific-references.json`.
11. **Model Documentation Coverage:** Verifies all 28 `MODEL-*` entries define equations, state variables, parameters, initial conditions, solvers, compute envelopes, and validation cases.
12. **Universal Contextual Explanation System (UCES) Coverage:** Verifies all 17 UI entity classes and all 616 `ScientificEntityDocumentation` records have `COMPLETE` status, valid `/knowledge/...` routes, definitions, mechanisms, and citations.
13. **3D Asset-to-Entity Mapping Coverage:** Verifies all 34 `ASSET-*` entries resolve to valid Knowledge Graph entities and include accuracy classifications and simplification disclosures.
14. **Requirements Traceability Coverage:** Verifies all 28 `REQ-*` entries and 19 `VAL-*` cases resolve to existing documents and schemas/registries.
15. **Knowledge Graph Anti-Orphan Invariant:** Verifies all 774 KG nodes have degree `>= 1` and all 3,451 edges connect valid node IDs.
16. **Acceptance Criteria Verification:** Confirms acceptance criteria definitions across specification documents.
17. **Model Validation Specification Check:** Confirms every model links to a verified `VAL-*` benchmark case.

## 4. Related Documents

- [README.md](../../README.md)
- [TEST_STRATEGY.md](../../docs/14-quality-and-validation/TEST_STRATEGY.md)
- [audit-report.md](../../reports/documentation-audit/audit-report.md)
