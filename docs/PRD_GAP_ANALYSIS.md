# Capabilities and remaining gaps

This review replaces the historical comparison against the broader Early Warning concept. It reflects the review-only scope as of November 7, 2026. “Implemented” describes a prototype capability, not production validation. Coding agents should verify these claims against actual source and tests.

| Area | Implemented capability | Remaining limit or gap |
| --- | --- | --- |
| Document intake | PDF/DOCX/TXT parsing, extraction coverage, source versions and original-file views in `src/features/documents/` | No OCR; incomplete and image-only content requires manual inspection |
| Findings | Deterministic checks, evidence spans and reviewer-facing wording in `src/features/analysis/` | Bounded patterns rather than general legal reasoning or complete requirements detection |
| Review queue | Human dispositions, notes, edited questions and independent download selection | Confirmation and selection do not establish legal approval |
| Source context | Source identities, parent links and review requirements in Documents; investor scope on clarification approvals in `src/features/context/intake.js` | Human declarations require verification; conflicting identities remain visible |
| Clarifications | Question routing, response provenance, scoped internal approval and stale-source invalidation in `src/features/context/decisions.js` | Manually entered identity; no authenticated counsel portal or message delivery |
| Review focus | Document declarations in Documents and clarification records in Questions; implementation task editors removed | Existing task/population history is preserved; Review tab components remain unchanged |
| Readiness | Pure evaluator and explicit source/decision-bound acknowledgement in `src/features/readiness/` | Internal prototype state; no authenticated customer or legal sign-off |
| Revisions | Source comparison, finding reconciliation and retained review history in `src/features/review/` | Text comparison does not determine legal effect |
| Handoff | Selected question exports and an all-findings review summary with source statuses and recorded resolutions in `src/features/review/review.js` | No complete backup of original file bytes or authenticated sign-off |
| Learning and evaluation | Synthetic guided example, unit regressions and Playwright checks | Visible development fixtures; no blind production benchmark or measured analyst time savings |
| Storage | Browser-local localStorage and IndexedDB | No server, shared team records or cross-device synchronization |

## Scope constraints

Effort estimation, estimate baselines, actuals and closeout are excluded. Their historical agent role remains as development context, not an active requirement. Preserve legacy planning data unchanged without displaying, calculating or exporting it.

Prioritize evidence integrity, conservative migration, approval separation and useful review actions when maintaining the prototype. Broader detection, authentication, collaboration and consolidated handoff need separately scoped work and validation. See the [implementation contract](IMPLEMENTATION_PLAN.md) and [README](../README.md) for current boundaries and checks.
