# Neutral color and text audit

> Historical audit: the supplied palette application supersedes the neutral-only color policy. See [palette-application.md](palette-application.md) for the current roles and verification.

November 7, 2026. This supersedes the selection/text palette described in the earlier color-hierarchy audit.

## Findings applied

| Finding | Change |
| --- | --- |
| Purple was still present beyond Review: logo, navigation, filters, editor steps, focus outlines, checkboxes and text selection. | Shared tokens now use warm-gray selection surfaces and charcoal ink. The brand mark, keyboard outline and checkbox accent are neutral. Lavender-tinted supporting surfaces were replaced too. |
| Ordinary black text competed with blue action labels, instructional copy and information panels. | Headings, body copy, control labels and text actions share #262626 ink. Secondary metadata uses #555555. Informational text uses neutral #41413d on #efefeb. |
| Hidden/less-common components retained blue-gray text literals. | Replaced readiness fallback text and legacy advisory styling with semantic neutral tokens. Source documents, declaration editors, uploads and all three question-editor steps were inspected in rendered form. |
| Color was carrying selection/interaction emphasis. | Retained selected-filter underlines, pressed/current states, stronger primary-action borders, source-selection outlines and keyboard focus. Purple and blue are not required to distinguish these states. |

The bronze final acknowledgement action remains intentional. Green completed checks, amber review states and red blocking/error states retain written labels and established meanings. Data, source citations, storage, approval gates and exports were not changed.

## Coverage and evidence

- Rendered color audit at 1440px and 390px: Documents, Review, Questions, Readiness, answer editor, question editor, internal approval editor, finding dialog, Help, upload dialog, source document viewer, document declaration editor and Packages.
- The browser audit inspects computed text, background, border, visible focus and checkbox accent colors. It rejects purple hues and blue direct text, and confirms that filters/actions retain distinct treatments with neutral text.
- Keyboard focus is charcoal and visible. Mobile filter targets remain 44px; desktop filters remain smaller than primary actions.
- Main-screen typography/reflow audit at 1440, 720, 390 and 320px: visible functional text at least 14px, at least 4.5:1 contrast and no horizontal overflow.
- 35 unit tests passed. Production build passed; existing PDF/font chunk-size advisory remains.
- Design documentation and sidecar examples now specify the neutral text/selection policy.

Tests: `tests/color-roles-browser.mjs`, `tests/typography-browser.mjs`. Captures: `.impeccable/review/colors/`. Mechanical scan: `.impeccable/review/colors/neutral-detector.json`.

## Limits

This is a color, contrast and presentation audit, not a screen-reader or complete WCAG certification. Computed-style detection uses explicit hue/saturation thresholds; the documented neutral policy and visual inspection complement it. Existing legacy CSS warnings include overridden colors, small-size declarations and an inactive thick-border declaration; those were inspected in the rendered cascade rather than treated as new visible failures. No new dark theme was introduced.
