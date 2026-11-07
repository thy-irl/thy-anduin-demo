---
name: Preflight
description: A quiet review desk for source evidence and analyst decisions.
colors:
  primary: "#ffffff"
  primary-hover: "#edf4ff"
  primary-outline: "#3686ff"
  on-primary: "#185abd"
  canvas: "#f5f6f8"
  surface: "#ffffff"
  ink: "#222222"
  muted: "#555555"
  line: "#dcdfe4"
  control-line: "#808080"
  button-line: "#c5cad2"
  focus: "#185abd"
  navigation-active: "#edf4ff"
  selection-ink: "#174f9d"
  selection-hover: "#e5efff"
  link: "#185abd"
  brand: "#3686ff"
  info-ink: "#414650"
  info-bg: "#f1f3f6"
  positive-ink: "#087b30"
  positive-bg: "#e8f7ed"
  neutral-hover: "#edf0f4"
  neutral-selected: "#e6e9ee"
  text-selection-ink: "#222222"
  text-selection-bg: "#d8e6fa"
  navigation-count-bg: "#ffffff"
  upload-bg: "#f8f9fb"
  example-border: "#808080"
  toast-bg: "#222222"
  ready-border: "#087b30"
  overlay: "#22222270"
  support-bg: "#f1f3f6"
  source-well: "#f1f3f6"
  source-selector-bg: "#f8f9fb"
  source-selected-outline: "#174f9d"
  document-viewer-bg: "#f1f3f6"
  acknowledgement: "#fda050"
  acknowledgement-hover: "#f3913b"
  acknowledgement-disabled-bg: "#f1f3f6"
  acknowledgement-disabled-ink: "#555555"
  acknowledgement-disabled-border: "#808080"
  evidence: "#fff7ec"
  blocking: "#b51f2c"
  blocking-bg: "#fff0f1"
  review: "#8a480e"
  review-bg: "#fff0df"
  advisory: "#805b00"
  advisory-bg: "#fff4c2"
  questions-control-line: "#808080"
  questions-required-ink: "#b51f2c"
  questions-required-bg: "#fff0f1"
  questions-required-outline: "#8a480e"
  questions-invalid-outline: "#b51f2c"
  questions-required-surface: "#fff7ec"
  questions-unanswered-ink: "#8a480e"
  questions-answered-ink: "#414650"
  questions-approved-ink: "#087b30"
  questions-approved-bg: "#e8f7ed"
typography:
  metadata:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 600
  evidence:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "18px"
    lineHeight: 1.8
  preview:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "16px"
    lineHeight: 1.55
rounded:
  badge: "3px"
  control: "5px"
  panel: "7px"
  dialog: "8px"
spacing:
  compact: "8px"
  control: "12px"
  mobile-inset: "16px"
  panel: "24px"
  rail-gap: "30px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  question-required-label:
    backgroundColor: "{colors.questions-required-bg}"
    textColor: "{colors.questions-required-ink}"
    rounded: "{rounded.badge}"
  question-required-field:
    backgroundColor: "{colors.questions-required-surface}"
    textColor: "{colors.ink}"
  question-state-unanswered:
    backgroundColor: "{colors.review-bg}"
    textColor: "{colors.questions-unanswered-ink}"
    rounded: "{rounded.badge}"
  question-state-answered:
    backgroundColor: "{colors.advisory-bg}"
    textColor: "{colors.questions-answered-ink}"
    rounded: "{rounded.badge}"
  question-state-approved:
    backgroundColor: "{colors.questions-approved-bg}"
    textColor: "{colors.questions-approved-ink}"
    rounded: "{rounded.badge}"
  evidence-block:
    backgroundColor: "{colors.evidence}"
    typography: "{typography.evidence}"
    padding: "18px 20px"
---

# Design System: Preflight

## Overview

**Creative North Star: "The Review Desk"**

The review desk pairs white working surfaces and charcoal text with blue outlined actions and pale blue selections. Compact system typography carries controls and workflow states; serif passages distinguish source material from analyst actions. The visual hierarchy keeps evidence legible and decisions deliberate.

The system is primarily flat. Subtle tonal changes, thin dividers and modest corners group related work without turning each item into a floating card.

**Key Characteristics:**
- White working surfaces and charcoal ink, with a cool gray canvas.
- Compact controls with visible keyboard focus.
- Serif evidence within a system sans interface.
- Tonal grouping and restrained status color.

## Colors

### Primary

Primary actions retain white surfaces with a 2px Dodger Blue (#3686ff) outline and readable dark blue (#185abd) text. Hover uses pale blue. Pale blue (#edf4ff) identifies selected navigation, filters, editor steps and source choices, paired with dark blue ink (#174f9d). The supplied blue owns the brand mark and action outlines; darker blue supports links and keyboard focus. Orange (#fda050) is reserved for the final internal readiness acknowledgement, with charcoal text. Green, orange and red status treatments use darker inks and pale backgrounds derived from the supplied palette. Purple and gradients are omitted. `src/app/palette.css` is the shared semantic layer; its legacy `--green` alias exists only for compatibility.

### Neutral

Cool gray canvas surrounds white working surfaces. Dark ink carries the main reading hierarchy; muted text supports metadata. Light dividers define rows, panels and controls. The pale evidence tone separates cited passages from surrounding commentary. Source wells use `source-well`; supporting records use `support-bg`; upload areas use `upload-bg`. Text selection uses `text-selection-ink` on `text-selection-bg`; selected navigation counts use `navigation-count-bg`. Ready summaries use `ready-border`, toasts use `toast-bg`, and neutral backdrops use `overlay`.

Blocking uses restrained red ink on pale red. Note uses dark yellow ink (#805b00) on pale yellow (#fff4c2), with the same badge shape and weight as Blocking. Marked resolved uses selection ink (#174f9d) on light blue (#edf4ff); dismissed findings remain neutral and current internal approval remains green. These are semantic signals rather than additional brand accents.

Questions uses the same shared control, status and surface tokens. Required markers use blocking ink and a pale red background; required fields use the evidence tint and warning outline. Answer saved uses neutral information styling; internal approval uses the positive pair.

**The Written State Rule.** Pair every status color with an explicit text label.

## Typography

System sans is the UI family. Georgia, with Times New Roman fallback, marks source evidence. There is no separate display or marketing typeface.

Headlines use a compact, slightly tightened semibold treatment. Section titles are smaller than page headings; finding titles use a readable 16px treatment with 1.5 line height. Metadata and controls occupy the smaller end of the scale. Badge counts and small metadata use tabular numerals. Source previews use the preview role, remain within 68ch and are clamped to two lines; full evidence uses the more generous evidence role.

**The Evidence Voice Rule.** Serif type distinguishes source passages from workflow instructions and analyst controls.

## Layout

The desktop workspace is centered with a maximum width of 1540px and insets of 32px vertically and 36px horizontally. The review workflow has a sticky 196px rail and a 30px gap to the main content. At 761–1100px the rail becomes 180px with a 22px gap and reduced workspace insets. At 760px and below it becomes a four-column top navigation, with 16px horizontal workspace insets.

Queue controls and rows share a contiguous bordered container. Rows align finding content, metadata and written state, with a short source preview beneath the title. Desktop evidence review uses a 1.15:1 split between source and editor. Mobile evidence review fills the viewport, keeps its header and action footer around a single scrolling body, and lets source content and editor flow together.

Questions prioritizes recording answers to questions raised in Review. Its heading and short instruction lead into status filters, search and a contiguous question queue. Selecting a question replaces the queue with one focused editor. The desktop editor pairs evidence with the answer in a 0.85:1.15 split, collapsing to one column at 800px and below. At 560px and below filters use two columns, editor steps stack and actions expand to the available width. Downloads remain secondary disclosures. This is the current Questions composition; it is not a requirement for every future screen.

## Elevation & Depth

Routine surfaces use tonal grouping and thin borders. Overlays retain the existing dialog shadows: the evidence review uses `0 12px 60px #182d3d35`, and standard modals use `0 14px 50px #112c3430`. Original-page canvases retain a small paper shadow. The evidence action footer has no shadow. This is a mostly flat system with depth reserved for overlays and original pages.

## Shapes

Controls have modest corners, panels slightly softer corners and dialogs the largest radius. Badges are compact rectangles rather than pills. The finding queue has square interior rows and rounded outer bottom corners; adjacent rows read as one collection. Borders remain thin and quiet.

## Components

### Buttons

Primary buttons use white surfaces, a 2px Dodger Blue outline and bold dark blue text. Hover adds a pale blue tint and an underline. Their minimum height is 44px. Secondary buttons use the working surface with a thin control border and a pale hover fill. Text actions use neutral ink and underline on hover. Disabled buttons retain the incumbent half-opacity treatment. Keyboard focus uses a three-pixel outline with three-pixel offset. Background transitions last 150ms with ease-out only when reduced motion is not requested.

### Inputs / Fields

Inputs and textareas use light surfaces, thin borders, modest corners and the shared focus outline. Textareas resize vertically. Standard text fields have a minimum height of 42px; visible field labels and help text remain separate from their values.

### Questions

The queue combines stored question/response records with non-dismissed Review questions that have no linked record. Linked findings do not create duplicate rows. Navigation count matches this full queue; filters and search narrow its visible rows. Rows lead with the question, a written state and Record answer or Edit answer. Saved answers stay readable before metadata and history disclosures.

Opening an existing question starts on Answer. Question, Answer and Internal approval steps retain edits while switching. Save commits changes; Cancel or Back to questions explicitly discards unsaved edits. A written Required marker identifies save requirements; Required for approval identifies the later approval gate. Draft saving, answer recording, finding review and explicit internal approval remain independent actions. Internal approval is a browser-local record, not authenticated legal or customer approval.

Search, step controls and editor fields use the Questions control boundary token. Required labels use the required ink on the scoped required background; required fields use the required surface and scoped required outline. Invalid fields receive the scoped invalid outline and a visible explanation. Active steps use Tropical Blue with dark blue ink. Filters use smaller 14px text, a Tropical Blue selected fill with dark blue ink and a 2px selection underline, with a 36px desktop height and 44px mobile touch target. Filters never use a filled primary-action treatment. Primary answer/save actions retain 15px text, a 2px Dodger Blue outline, bold dark blue text and at least 44px height. All retain visible keyboard focus. Written state labels distinguish Needs an answer, Answer saved and Internally approved; Approval needs recheck remains explicit when source changes invalidate approval.

Disclose supporting metadata, quotations, reviewer notes, history and exports progressively. Keep source-coverage and reconfirmation warnings visible outside disclosures, including in the editor, so an analyst can assess limitations before saving or approving. Source links, original files and existing provenance remain accessible. Avoid duplicate introductions, placeholder metadata and manual link-provenance controls that compete with the answer task. See `.impeccable/questions-direction.md` for the surface brief.

### Navigation

The workflow rail uses full-width, compact buttons, icons and count badges. Active entries use a Tropical Blue fill, dark blue ink and a white count badge. This selection treatment is distinct from blue outlined actions. On mobile, icons disappear and four equal columns preserve the written labels and counts.

### Chips

Severity badges use small text, compact padding and matching semantic foreground/background pairs. Do not use them as a replacement for detailed finding disposition or question status.

### Cards / Containers

Document and coverage panels use near-white surfaces, thin dividers and 24px padding, reduced to 18px by 16px on mobile. Finding rows have flat surfaces, short source previews and a pale hover state. Readiness blocks use the same quiet border language.

### Evidence review

Source selectors retain written labels and selected borders. The Review source pane uses cool gray, with a near-white source selector strip and a Tropical Blue selected-source button distinguished by a 2px dark blue outline. Purple selection fills are excluded from finding Review. The original/text toggle preserves access to both evidence forms. Highlighted passages use the evidence typography and pale paper tint. The action footer remains structurally separated by a divider; on mobile it accounts for the safe area.

## Do's and Don'ts

### Do:
- Do reserve Georgia for quoted evidence and source text.
- Do use thin dividers and tonal surfaces to group work.
- Do keep keyboard focus clearly visible.
- Do preserve readable source passages on small screens.

### Don't:
- Don't apply serif styling to controls or navigation.
- Don't use status color without a written label.
- Don't create separate nested scrolling panes in the mobile evidence review.

## Package status and actions

Run preflight again is directly available beside Add / replace files; More retains package history. Package cards and the header show the same calculated internal readiness state. The header counts document references that need attention; explicit source-backed exclusions remain in Documents as reference notes. Ready packages do not promote harmless external mentions as outstanding work. Coverage details remain accessible in Documents. Source changes still invalidate acknowledgement under the existing readiness evaluator.

## Finding language and disclosure

The finding editor uses neutral ink for its status heading and explanations, with one state-specific next step. Closed findings label their severity as the original priority and disclose the original explanation under “Why this was flagged.” Keep the editable question and reviewer note ahead of supporting records. Linked responses, per-citation quotations, technical check details and finding history expand independently. Section names distinguish source passages from the same document. Exact duplicate citations may be deduplicated for display; stored evidence, user writing, original-file links and history remain intact. Response recording, finding review and internal approval stay independent.

Supporting records use a compact review/download definition list and filename-first citation rows; full section names appear inside the citation. “About this check” shows Check, Basis and Why it matters. Detection method, original wording and review limits are separate disclosures. Avoid repeating the main explanation, review status or source quotation in this panel. Preserve qualifiers next to the check context.

## Reading scale

Use rem-based role tokens: metadata 0.875rem (14px), labels/actions 0.9375rem (15px), body 1rem (16px), subtitles 1.125rem (18px), section headings 1.25rem (20px), titles 1.5rem (24px), page headings 1.875rem (30px). The root honors the browser font preference. Primary ink is #222222; secondary text is #555555. Essential explanations use primary ink. Mobile navigation stacks counts below labels; controls, source metadata and status labels wrap to accommodate larger type. The desktop rail is 196px, or 180px at intermediate widths.

Readiness action cards show one state-specific next step. “Sources & requirements” separates Needed and Responsible facts from a list of document/version/location disclosures. Each quotation opens independently; the full evaluator assessment stays available in its own disclosure. Readiness calculations and approval gates remain independent of these presentation changes.


## Readiness hierarchy and final action

Readiness checks are always visible immediately after the Internal handoff heading, ahead of downloads and blockers. Show the evaluator’s pass count, native progress bar and all five named checks. Completed checks use a green check icon; remaining checks use an outlined circle and written Action required state. Use five columns on wide screens, two below 1100px and one below 600px. The panel is a section, not a collapsed disclosure.

Reserve Energy Orange (#fda050) for Acknowledge internal readiness as an explicit exception to blue outlined primary buttons. Use bold charcoal text, a shield-check icon and directional arrow on the enabled 48px action; hover darkens the orange. The unavailable state uses pale peach, dark brown text and a lock icon, preserving readable contrast without suggesting the action is available. Explanatory text describes what remains. Required fields and explicit consent still gate submission, independently of readiness prerequisites; successful submission updates the calculated progress and retained record.


## Text, action and selection policy

The supplied palette supersedes the previous neutral-only policy. Use #222222 for headings, body text and ordinary labels, and #555555 for secondary metadata. Use #185abd for primary action text, links and focus; secondary in-app text actions use #222222. Selected controls use #174f9d on #edf4ff with #e5efff selected hover; unselected navigation hover stays neutral. Neutral information uses #414650 on #f1f3f6. Keep ordinary explanations neutral, including saved-answer headings. Preserve underlines, border weight, explicit state, icons and spacing as interaction cues. Raw bright blue, green and red are unsuitable for small white text; use the semantic contrast variants above. #808080 is a control-boundary and scrollbar color, not small metadata text. The final orange readiness action uses charcoal text. Status colors retain written labels.

### Color refinement — November 7, 2026

Pale-blue selection and neutral secondary actions preserve the outlined review-desk identity. Global New package uses neutral ink and a quiet #c5cad2 boundary. Secondary button borders use the same quiet boundary; inputs retain #808080 boundaries and keyboard focus retains #185abd. Supporting information and the package coverage strip share #f1f3f6. Warm tint is reserved for source evidence and semantic warnings. Unavailable final acknowledgement uses neutral gray with its existing lock and explanation; enabled acknowledgement stays orange. Layout, spacing, typography and workflow behavior are unchanged.

## Compact finding status and learning removal

Review rows show priority and current workflow state as adjacent badges. Use concise labels such as Response recorded, Internally approved and Approval needs recheck. Response recorded uses neutral styling; green is reserved for current internal approval. A manually resolved finding retains the explicit Marked resolved label. Source correction and dismissal remain distinct. Remove secondary status sentences and download-selection text from the queue; download selection stays in the finding editor and question exports. Badges wrap as a group within narrow viewports without clipping.

Guided examples, screen introductions and explanatory popovers have been removed at the user's request. Retain the default synthetic sample, existing saved packages, source citations, review records and explicit approval controls. Sources & review record belongs to Review, independently of onboarding.

## Document reference review

Documents leads with missing or uncertain references and a direct path to their review findings. Each expanded entry retains the literal source quotation and source link. Source-backed future tax-form exclusions appear under Other referenced documents, with a clear Not required for this package label; external mentions without an explicit exclusion still need review. Matched references remain collapsed. Identity, detected headings and extracted terms sit under Supporting document details. A visible Export document analysis row leads Documents, ahead of coverage, with a Download JSON action and a concise description of the source references, headings, terms and text coverage included. The action sits beside the description on desktop and stacks beneath it on mobile. Deduplicate repeated headings within a document scope and omit a line-wrapped tax-form mention from the displayed heading list; the raw analysis stays in the download. This presentation does not change stored findings, source data, approvals or readiness gates.
