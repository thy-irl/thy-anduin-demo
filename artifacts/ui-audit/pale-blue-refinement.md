# Pale-blue color refinement

Implemented November 7, 2026 from the single-agent color critique. User direction: pale blue, colors only. This updates the selection, secondary-action and unavailable-acknowledgement treatments in palette-application.md.

- Selected navigation, question filters, editor steps and source choices use #edf4ff with #174f9d text; selected hover is #e5efff. Unselected hover remains neutral #edf0f4.
- Primary task actions retain white surfaces, blue outlines and dark-blue labels. Secondary in-app text actions use charcoal. Links and explanatory links retain readable blue.
- Global New package uses neutral ink and a quiet #c5cad2 boundary. Secondary buttons use that quieter boundary; input boundaries remain #808080 and focus remains #185abd.
- Package coverage and supporting information share #f1f3f6, removing the warm-gray coverage strip. Evidence retains its warm paper tint.
- Unavailable acknowledgement uses gray with the existing lock and explanation. Enabled acknowledgement remains orange. Status labels retain semantic colors and written meaning.

Only color declarations changed in application code (src/app/palette.css). Layout, spacing, typography, workflow logic, source data and storage are unchanged. DESIGN.md records the updated roles. The pre-existing design sidecar remains stale and was not refreshed as a side effect.

Verification:

- npm test: all 35 tests passed.
- npm run build: passed with the existing large-chunk advisory.
- tests/color-roles-browser.mjs: passed desktop/mobile routes, dialogs and hover/focus; updated assertions cover pale selection, neutral question actions, quiet global action and supporting strip.
- tests/typography-browser.mjs: four main screens at 1440, 720, 390 and 320px passed functional-text size, 4.5:1 contrast and overflow checks.
- tests/readiness-hierarchy-browser.mjs: desktop/mobile source selection, neutral unavailable action, orange enabled action, consent gate and acknowledgement passed.
- Desktop/mobile screenshots visually inspected; captures are in .impeccable/review/colors/ and .impeccable/review/readiness-hierarchy/.
- Impeccable edit hook reported no deterministic findings for palette.css. No claim of a full accessibility certification.
