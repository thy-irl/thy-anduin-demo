# Questions workspace

Mode: Operate, inside Preflight's existing Review Desk visual system. This is a workflow and composition rework, with the established warm canvas, dark ink, system typography and restrained teal retained. No replacement visual identity or bitmap assets.

User priority: Record answers to questions raised in Review. The screen must make sense without prior context.

First viewport: Questions heading and short purpose; explicit instruction to choose a question and record an answer; status filters and search; real source-backed Review questions with written status and a Record answer action. No duplicate page introduction or empty response-record shell hiding the actual questions. Navigation count matches the queue.

Interaction: choosing a question opens a focused editor in place. Existing question and evidence appear beside the response on desktop, above it on mobile. Answer is the initial step. Question / Answer / Internal approval steps retain unsaved edits when switched. Save and Cancel are explicit. A written Required marker and tinted field identify requirements to save; Required for approval distinguishes later gates. Metadata, quotations, reviewer notes and history disclose progressively. Source/reconfirmation warnings remain visible.

Color: primary #234e58 on light #fffefa, body #202a2c, secondary #485451, field outlines #899590. Required labels #813626 on #f9e7e0, required fields #fffdf5 with #80571e outlines. Written statuses supplement color. Teal active step and filter use white text. Focus inherits the existing accessible outline.

Scope: Questions component/editor, Questions-specific CSS, the Questions tab count and secondary downloads. Keep Review and readiness logic, independent response/approval gates, source links, originals, localStorage schema, historical records and drafts. No new storage fields, external services or model calls. Keep exports available beneath disclosures. Removed noisy proposed/owner placeholders and manual link-provenance editing; retained stored provenance and automatic link updates.

Verification: desktop 1440 and mobile 390; blank-answer error and focus, answer save without approval, stage-switch draft retention, reload persistence, approval rejection for missing requirements, status filters/search, browser errors and horizontal overflow. Node regression tests cover approval and source-change gates.
