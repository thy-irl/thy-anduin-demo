# Current state

As of November 7, 2026, Preflight is a browser-local React/Vite prototype for reviewing document packages before digitization.

## Active capabilities

- PDF, DOCX and TXT intake, extraction coverage and original-file evidence views.
- Deterministic findings, manual issues, editable questions and independent report selection.
- Source identities, versions, parent relationships and source-linked review requirements in Documents.
- Question routing, response provenance and scoped recorded internal approval in Questions.
- Revision comparisons, stale-source invalidation and retained review history.
- Markdown/JSON question downloads and a Markdown review summary with all findings and recorded resolutions.
- Explainable internal readiness and a guided synthetic exercise.

Readiness checks current evidence, findings, approvals and linked requirements before an explicit human acknowledgement. Changed inputs invalidate that acknowledgement. A finding confirmation or recorded response alone cannot approve applicability.

## Persistence and boundaries

Package state uses localStorage; original files use IndexedDB. Preserve storage keys, original-file lookup and backward-compatible migration. Actor attribution is manually entered and unauthenticated.

The Requirements & work plan screen, implementation task editors, standalone population management, effort estimation and closeout are outside the current product scope. Existing task and population records remain in local storage as history; they do not gate readiness or appear in review exports. The Review tab and finding components were preserved during the screen removal. Existing `package.scoping` objects remain unchanged as inactive history; they are not calculated, displayed, exported or used as readiness prerequisites. Earlier estimate-based acknowledgements require a fresh review under the current policy.

There is no server, shared team storage, OCR, model inference or general legal reasoning. Findings require human review, and extraction gaps remain visible even with no detected findings.

## Development references

See the [README](../README.md) for setup, validation commands and external fixture requirements; the [agent playbook](CODEX_AGENT_PLAYBOOK.md) for task ownership; the [implementation plan](IMPLEMENTATION_PLAN.md) for phase contracts; and the [capability review](PRD_GAP_ANALYSIS.md) for remaining limits. These documents describe current scope rather than promising production readiness.
