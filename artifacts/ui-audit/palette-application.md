# Supplied palette application

> Selection, secondary actions and unavailable acknowledgement were subsequently refined. See [pale-blue-refinement.md](pale-blue-refinement.md) for the current treatment.

Applied November 7, 2026 using Impeccable's colorize guidance. This supersedes the earlier neutral-only color policy; those audits remain historical evidence.

The Operate interface retains its review-desk layout, outlined primary actions and quiet evidence surfaces. Color now distinguishes action, selection and final acknowledgement. Purple and gradients are deliberately omitted.

| Supplied color | Application |
| --- | --- |
| Dodger Blue `#3686ff` | Brand mark and primary-action outlines. Darker `#185abd` supports readable action labels, links and keyboard focus. |
| Tropical Blue `#d8e6fa` | Selected navigation, filters, editor steps, source selectors and browser text selection; dark blue labels and existing border/state cues remain. |
| Energy Orange `#fda050` | Enabled final internal readiness acknowledgement, paired with charcoal text; unavailable actions use pale peach and a lock icon. |
| Black Out `#222222`, White `#ffffff` | Main ink and working surfaces, with cool gray canvas and supporting panels. |
| Grey `#808080` | Input boundaries and scrollbars. Metadata retains darker gray for text contrast. |
| Green and red | Darker inks and pale backgrounds carry successful checks and blockers; written status labels remain. |

Questions' required fields and errors now use shared semantic tokens. Saved-answer headings remain ordinary content ink. Source evidence retains a subtle warm tint, distinct from blue interaction states. Workflow evaluators, storage and export logic were not changed.

## Contrast

Ratios use the semantic foreground/background values. Body text requires 4.5:1; control boundaries and icons require 3:1.

| Pair | Contrast |
| --- | --- |
| Action text / white | 6.49:1 |
| Action text / hover | 5.87:1 |
| Selected text / Tropical Blue | 6.29:1 |
| Selected text / hover | 5.70:1 |
| Dodger Blue boundary / white | 3.49:1 |
| Gray boundary / white | 3.95:1 |
| Positive status | 4.88:1 |
| Review status | 6.23:1 |
| Blocking status | 5.94:1 |
| Charcoal / orange final action | 7.82:1 |
| Charcoal / orange hover | 6.76:1 |
| Unavailable final action | 6.12:1 |

## Verification

- `npm test`: all 35 tests passed.
- `npm run build`: passed; existing large JavaScript/PDF/font chunk advisory remains.
- `tests/color-roles-browser.mjs`: passed at 1440 and 390px across Documents, Review, Questions, Readiness, answer/approval/question editors, finding review, Help, uploads, source document, declarations and Packages. Checked computed action/selection roles, focus, filter hierarchy, touch targets, browser errors and overflow. Reduced motion and pointer placement stabilize selected-state assertions independently of hover.
- `tests/typography-browser.mjs`: passed on all four main screens at 1440, 720, 390 and 320px; rendered functional text is at least 14px, meets 4.5:1 contrast and has no horizontal overflow.
- `tests/readiness-hierarchy-browser.mjs`: passed at 1440 and 390px; source selection, blocked/enabled final action, consent requirement and successful acknowledgement remain correct.
- Protanopia, deuteranopia and tritanopia browser simulations captured for Questions; written states and selection outlines remain. These are simulations, not user testing.
- Impeccable detector ran once on the three changed stylesheets. It identified a legacy 3px readiness side-border declaration, since removed, and advisory legacy typography/radius/color declarations. The detector report predates that cleanup; no claim of a clean detector rerun. Existing layout overrides and rendered browser checks remain the visual authority.

Screenshots and detector evidence are local ignored files in `.impeccable/review/colors/` and `.impeccable/review/readiness-hierarchy/`. This is a scoped palette check, not a full accessibility certification. The pre-existing Impeccable sidecar is stale; refreshing it is separate from this palette application.
