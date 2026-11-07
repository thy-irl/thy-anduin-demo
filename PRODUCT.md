# Preflight

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Analysts preparing document packages for digitization, as specified in the redesign brief.

## Product Purpose

Inspect source evidence, review candidate findings, ask questions, record responses and assess internal readiness.

## Operating Context

React/Vite browser-local workbench with Documents, Review, Questions and Readiness. Evidence → finding → question → response is one connected workflow.

## Capabilities and Constraints

Preserve source-linked quotations, versions, revision history, original-file lookup, localStorage and IndexedDB schemas. Finding disposition, question selection, response recording and explicit internal approval are independent. Dismissal requires a reason; responses cannot be blank. Preserve context and unsaved response drafts. Candidates are not legal conclusions; internal readiness is not legal or customer approval. No estimation, closeout or implementation-planning editors. No external services, model calls or document transmission.

## Accessibility & Inclusion

Keyboard operation, focus management, visible errors and deliberate mobile layouts without nested scrolling.

## Evidence on Hand

Existing deterministic checks and regression tests; synthetic sample packages in src/features/documents/demo.js and public/samples. No invented customer claims.

## Product Principles

Evidence precedes judgment. Current tasks outrank metadata. Reveal advanced details progressively. Make missing coverage and remaining actions explicit.
