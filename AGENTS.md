# Codex instructions — Early Warning / Preflight

## Product goal

Focus the existing React/Vite `anduin-preflight` app on reviewing document packages, source scope, requirements, findings and clarifications. Scope & Estimate, Closeout, and the standalone Requirements & work plan screen were explicitly removed by the user on November 7, 2026. Document declarations live in Documents; clarification records live in Questions. Keep the Review tab and finding components unchanged for this screen-removal task. Do not reintroduce effort estimation, estimate baselines or closeout. Older PRD/phase plans are historical where they describe those features. This is an interview MVP, not a production legal system.

## Non-negotiable behavior

- Do NOT replace the project, change the framework, or delete tested features for a redesign.
- AI/deterministic checks produce candidates, not legal conclusions. Never select controlling legal terms, approve counsel answers, or assert regulatory compliance.
- A reviewer confirming a finding is **not** an approval of the legal interpretation. Recorded approval is **not authenticated** in this browser-local MVP.
- Every factual contract statement must link to verified source text, version and location. Coverage gaps must be visible.
- Preserve existing localStorage schema and IndexedDB original-blob lookup. New stored fields need backward-compatible normalization/migration and tests.
- Preserve legacy `package.scoping` data unchanged as inactive history. Never calculate with it, expose planning controls, export it in review reports or use it as a readiness prerequisite.
- Preserve `intakeContext.tasks` unchanged as historical data. Remove task editors and exclude tasks and standalone populations from readiness and exports. Keep the existing read-only Review components unchanged. Applicability for a clarification stays in its scoped approval.
- Any new model calls must be opt-in, approved, source-bound, schema-validated, safely redacted, and separately evaluated; do not transmit customer data without approval.
- Work in small, testable increments. Avoid editing another agent's owned files in parallel.

## Existing architecture

- `src/main.jsx`: React bootstrap
- `src/app/App.jsx`: app state, review UI, navigation, localStorage
- `src/features/analysis/engine.js`: deterministic findings, merge/reconciliation
- `src/features/documents/parser.js`, `src/features/documents/docx.js`, `src/features/documents/originals.js`: parsing and source bytes
- `src/features/context/intake.js`, `src/features/context/components/ReviewContext/ReviewContext.jsx`: document declarations and clarification records
- `src/features/review/review.js`: human report exports
- `src/features/documents/demo.js`: default synthetic sample; guided learning UI has been removed
- `src/features/review/components/RecordTrace/`: source citations and review records
- `tests/*.test.js`: Node unit tests; separate Playwright `.mjs` scripts

## Commands

- `npm ci` before first local run (use your platform's native modules)
- `npm test`
- `npm run build`
- Browser smoke checks documented in README (set `PREFLIGHT_TEST_URL` to running Vite server)

## Review contract for every ticket

Explain intended behavior and files first; write failing tests for critical gates and migrations; implement narrowly; run regression tests; report what was tested and what could not be tested. Do not claim success on skipped tests.

## Priorities

1. Provenance-rich decision-resolution record and isolated approval concepts
2. Pure readiness evaluator and a visible blocked/unblocked state
3. Source-linked document review and revision continuity without implementation task planning
4. Versioned consolidated handoff and demo regression
5. Reviewer workload and semantic candidates only when actually justified
