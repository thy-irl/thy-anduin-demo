# Implementation phases and maintenance contract

This document retains the phase references used by the coding-agent configuration. Phases 1 and 2 have implemented functionality; they are maintenance boundaries, not instructions to rebuild the application. [AGENTS.md](../AGENTS.md) and the [current state](CURRENT_STATE.md) define the active review-only scope. Verify implementation claims against source and tests.

## Phase 0 — Baseline

Inspect the existing React/Vite application and persistence before making changes. Agree acceptance criteria and owned files. Use the [README](../README.md) validation commands and record actual outcomes, including missing fixture or browser dependencies. Preserve localStorage and IndexedDB keys and original-file revision lookup.

## Phase 1 — Decision records

**Ownership:** `src/features/context/intake.js`, `src/features/context/decisions.js`, ReviewContext panels and decision tests. The Lead integrates shared application state/UI.

Maintain distinct finding disposition, question routing, response provenance, scoped internal approval and source currency. A legacy `confirmed` interpretation is not approved. Normal saves cannot refresh approval; approval requires an explicit action with current evidence and applicability. Changed sources or material decision edits require reconfirmation while retaining history.

All actor names are self-entered and unauthenticated. Question exports are manual downloads; no message is sent. Clarification links do not automatically change finding dispositions. Implementation task links are inactive history.

**Acceptance:** legacy records normalize conservatively; missing provenance or applicability prevents approval; stale or wrong-scope evidence invalidates approval; review history and edited questions persist. See `tests/review-scope.test.js` and `tests/review-scope-browser.mjs`.

## Phase 2 — Explainable internal readiness

**Ownership:** `src/features/readiness/` and readiness tests, consuming the agreed decision contract. The Lead integrates shared UI.

Keep `evaluateReadiness(pkg, analysis)` pure. Its states are `NOT_EVALUATED`, `BLOCKED`, `NEEDS_REVIEW` and `READY`. Explain blockers with evidence, source versions and next actions.

Unresolved substantive findings, required-source/extraction gaps and stale approvals prevent handoff. A recorded response or manual resolved label alone cannot clear a substantive question. Current correction evidence and justified harmless dismissals remain separate review paths. Mandatory checks precede a human acknowledgement bound to the current inputs; changes invalidate it.

Readiness is an internal workflow state, not legal approval. Estimates, baselines and closeout are not prerequisites. Preserve legacy acknowledgement history while requiring renewed review under the current policy.

**Acceptance:** unresolved issues block; a response alone remains insufficient; current applicable approval clears only its relevant blocker; source changes re-block; missing evidence cannot be waived; inactive planning data is unchanged and omitted from review exports. See `tests/review-scope.test.js`, `tests/preflight-rules.test.js` and `tests/review-scope-browser.mjs`.

## Phase 3 — Historical estimation work, inactive

The retained `scope_builder` configuration refers to a former estimation phase. Effort ranges, issue-impact forecasts, estimate baselines, actuals and closeout are outside the current scope. Do not implement or restore this phase. Preserve existing `package.scoping` data unchanged as inactive history.

## Future work requiring a separate task

A consolidated versioned readiness handoff, complete backup, authenticated collaboration and broader validated detection are not part of the current maintenance phases. Keep question and review-summary exports working. The standalone Requirements & work plan screen and implementation task editors are retired. Preserve stored tasks without using them as readiness gates. New model calls require the explicit data-handling and approval conditions in AGENTS.md.

Any future change needs bounded acceptance criteria and relevant regression evidence. Do not infer a feature request from a historical role definition or product idea.
