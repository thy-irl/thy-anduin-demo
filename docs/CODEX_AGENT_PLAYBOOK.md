# Coding-agent playbook

Use this guide with [AGENTS.md](../AGENTS.md), the [current state](CURRENT_STATE.md), [implementation phases](IMPLEMENTATION_PLAN.md) and [capability review](PRD_GAP_ANALYSIS.md).

## Retained configuration

[.codex/config.toml](../.codex/config.toml) defines orchestration settings, and [.codex/agents](../.codex/agents/) contains bounded specialist roles for repository auditing, decisions, readiness, QA and historical estimation work. Check model availability and orchestration support in the local environment before reusing those settings.

Some role prompts retain pre-refactor paths and planning concepts. Use the current paths below and the constraints in AGENTS.md when assigning work. The historical `scope_builder` role is inactive: do not reintroduce estimation or closeout. Existing planning data must remain unchanged as inactive history.

## Task ownership

| Role | Responsibility | Current ownership boundary |
| --- | --- | --- |
| Lead | Define acceptance criteria, assign bounded tasks and integrate shared state/UI | `src/app/App.jsx`, shared presentation and integration |
| Repository auditor | Compare source and tests with documented behavior; report concrete gaps | Read-only inspection |
| Decision builder | Response provenance, scoped approval and conservative migration | `src/features/context/intake.js`, `decisions.js`, ReviewContext panels and decision tests |
| Readiness builder | Pure readiness evaluation, source invalidation and action explanations | `src/features/readiness/` and readiness tests, after agreeing the decision contract |
| QA reviewer | Challenge claims with reproducible cases and regression checks | Read-only by default; isolated tests/fixtures when explicitly assigned |

Each task should state intended behavior, owned files, acceptance criteria and validation commands. Avoid concurrent edits to the same file. Lead integration happens after reviewing each bounded change.

## Suggested task brief

> Read AGENTS.md and the current scope documents, then inspect the actual source and tests. Implement only the assigned acceptance criteria within the owned files. Preserve storage keys, source-version links and existing review history. Keep finding disposition, recorded response and internal approval separate. Report changed behavior, exact checks run, failures and remaining limits. Do not claim skipped checks passed.

For an audit, request prioritized findings with file paths, reproduction steps and the smallest relevant evidence. The auditor should challenge documentation against the code rather than treat it as proof.

## Integration and verification

1. Agree the data contract and shared-file ownership before implementation.
2. Add meaningful regression tests for critical gates and migrations. Include stale sources, wrong-scope approvals, missing extraction, legacy records and harmless dismissals.
3. Review the diff for source traceability, accidental approval, persistence changes and scope creep.
4. Run the checks in the [README](../README.md), including relevant browser checks when behavior changes. Report unavailable external fixtures or browser dependencies explicitly.
5. Update current documentation to match implemented behavior, without converting synthetic results into production claims.

## Demo sequence

1. Open the synthetic guided example and inspect conflicting source quotations and coverage.
2. Confirm the potential issue; show that confirmation alone does not clear readiness.
3. Prepare a question and record a clearly simulated response with provenance.
4. Separately record internal approval for the applicable scope and current sources.
5. Inspect source declarations in Documents and the response, applicability and review history in Questions; inspect remaining readiness actions.
6. Download selected questions or a review summary, replace a source and demonstrate renewed review.

Describe the demo as a browser-local prototype with deterministic checks and manually recorded, unauthenticated approval. Authentication, secure collaboration and production validation remain future work.
