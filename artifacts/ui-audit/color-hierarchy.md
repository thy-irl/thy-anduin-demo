# App color and control hierarchy audit

> Historical audit: the supplied palette application supersedes the neutral-only color policy. See [palette-application.md](palette-application.md) for the current roles and verification.

Reviewed November 7, 2026. Updated after feedback to remove colored primary-button fills; emphasis now comes from border weight, bold text and a neutral hover with an underline. Scope: app-wide color, control emphasis, contrast and responsive presentation. This is not a full assistive-technology, security or performance certification.

## Findings and changes

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Selected Questions filters shared a dark fill, size and emphasis with Record answer. Selection and action competed. | Filters now have 14px text, a 2px selection underline and pale violet selection. Desktop filters are 36px high; primary actions use bold 15px text, a 2px charcoal outline and at least 44px height. Mobile filters retain 44px touch targets. |
| P2 | Dark teal was reused for actions, navigation, editor steps, links, explanatory icons and incidental UI. | Introduced shared semantic colors in `src/app/palette.css`: neutral outlined actions, violet selection, blue links and slate neutrals. Green is reserved for successful source checks and readiness; amber and red retain review and blocking meaning. |
| P2 | Hard-coded component colors could defeat a global palette update. | Questions uses shared roles. A final shared palette layer covers navigation, source choices, editor steps, finding priority, readiness state, document declarations, packages, help, uploads, supporting panels and toasts. Legacy `--green` remains an action compatibility alias. |
| P2 | Pale input outlines and similar control treatments weakened hierarchy. | Slate input/secondary-control outlines remain distinct; violet focus is independent of action color. Selection also uses written labels, current/pressed state and an underline. |

## Audit health within this scope

| Dimension | Score | Evidence and limitation |
| --- | --- | --- |
| Accessibility | 3/4 | Rendered functional text passes 4.5:1 in all four main screens. New action, selection, status and field-boundary pairs checked. Existing keyboard focus and semantic states retained. No screen-reader session. |
| Performance | 3/4 | CSS-only visual change and one stylesheet import; no new runtime dependencies or network services. Build passes; existing large PDF/font chunks remain. No runtime profiling. |
| Responsive design | 3/4 | Main screens fit 1440, 720, 390 and 320px. New filter/action hierarchy verified at desktop and mobile; mobile filter target remains 44px. No exhaustive touch-target audit of legacy controls. |
| Theming | 3/4 | Shared semantic color roles override legacy styling consistently. Legacy literal declarations still exist; there is no dark-mode product requirement or dark-mode implementation. |
| Implementation integrity | 3/4 | Roles verified in computed styles and desktop/mobile captures. Detector returned advisory color/radius drift only; no blocking findings. Remaining old radius/color declarations are outside this color correction. |
| Total | 15/20 | Good within the audited scope; limitations above remain. |

## Verification

- `tests/color-roles-browser.mjs`: computed filter/action/navigation/editor-step distinction; desktop sizing; mobile touch targets; hover; Documents, Review, Questions, Readiness, answer editor, finding dialog, Help and Packages; screenshots; no horizontal overflow or browser errors.
- `tests/typography-browser.mjs`: four main screens at 1440, 720, 390 and 320px; functional text at least 14px and at least 4.5:1 contrast; no horizontal overflow.
- `npm test`: 35 regression tests passed.
- `npm run build`: passed, with the existing large-chunk advisory.
- Mechanical detector output: `.impeccable/review/colors/detector.json`. All findings were advisory; new helper tones are intentional, old desk color/radius warnings include overridden declarations.

Screenshots: `.impeccable/review/colors/`, named by surface and viewport width. Browser content is the built-in synthetic sample package.

## Measured palette pairs

| Role | Contrast |
| --- | --- |
| Slate label / paper action surface | 14.59:1 |
| Plum selected label / pale violet | 6.99:1 |
| Blue link / paper | 6.86:1 |
| Slate secondary text / canvas | 6.45:1 |
| Slate input outline / white | 3.18:1 |
| Violet focus / paper | 5.76:1 |
| Positive status | 6.26:1 |
| Review status | 5.86:1 |
| Blocking status | 6.11:1 |

## Practical limits

Disabled controls retain reduced emphasis. Evidence quotations keep their paper treatment. Workflow evaluators, approval gates, source records, storage and exports were not changed. Status meaning always has a written label. Future UI changes should use semantic roles rather than adding more dark primary-color controls.
