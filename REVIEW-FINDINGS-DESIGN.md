# Document preflight checks — requirements

Add these rule-based checks to the app’s existing document review. Run them without a model call. Return evidence-backed findings that an operator can verify or send to counsel.

## Checks to implement first

| Check ID | Detect when | Return |
|---|---|---|
| `broken_reference` | A section, annexure subsection, table or schedule cited by name or number cannot be found in the identified document. Check numbering within the correct annexure. | **Reference target not found** — quote the reference and name the expected target. Example: “Annexure B §3 is cited; only §1 and its subsections were found.” |
| `missing_document` | A required document is absent from the package, or the text explicitly says a named document is attached, enclosed or received and it cannot be matched to an uploaded document or an embedded section. | **Document not found in package** — give the expected title and cite the clause or package checklist that calls for it. Example: “Portfolio Explanatory Appendix not found in the uploaded package.” |
| `party_name_mismatch` | The same identified party, in the same role and scope, appears under different names after approved aliases and formatting differences are accounted for. | **Party name differs across documents** — show both names, both locations, and the question “Which legal name should be used?” |
| `deadline_mismatch` | Two instructions for the same action and scope specify different dates, offsets, cutoff times or time zones. Keep submission and funding separate; preserve the anchor event and calendar/business-day basis. | **Different deadlines for [action]** — show all distinct deadlines with their sources and ask which applies. Example: funding on Closing Date versus the last Business Day before it. |

## Additional checks

| Check ID | Detect when | Return |
|---|---|---|
| `suspect_reference` | An explicit self-reference such as “this paragraph 3.21” points outside its enclosing numbered section. | **Possible wrong cross-reference** — quote the reference and show its enclosing section. |
| `typo` | A word matches a known misspelling, or a spelling rule identifies a candidate outside approved names, abbreviations and legal vocabulary. | **Possible typo** — show the original and, if available, the suggested spelling. Example: “Invetsor” → “Investor.” |
| `definition_mismatch` | The same term has materially different explicit definition text within a comparable scope, after ignoring formatting differences. Use a text-difference rule to flag changes; leave their legal effect to review. | **Different definitions for [term]** — show both definitions or the differing excerpts. Example: “Qualified Plan” includes IRAs in one clause and requires 100 employees in another. |
| `duplicate_definition` | The same term is defined more than once within the same glossary or scope. | **Duplicate definition for [term]** — link both entries. If their wording also differs, emit one definition mismatch finding instead. |
| `value_mismatch` | Comparable instructions specify different amounts, currencies, percentages, thresholds or evidence age limits. Compare like units and scope. | **Different values for [field]** — show the original values and sources. Example: proof of address must be within three months versus six months. |
| `required_field_missing` | A configured disclosure requirement applies to an identified form and no corresponding field or labeled prompt is found in the readable form. | **Required field not found** — name the field, cite the requirement, and identify the form checked. Blank fields in an unfilled template count as present. |
| `contact_or_version_mismatch` | Contact details for the same purpose differ, or a document version differs from an approved version listed for that package. | **Contact details differ** or **Unexpected document version** — show both values and sources. Different document dates alone do not trigger a finding. |

## Detect when — examples

Use these examples as acceptance cases. They combine observations from the Peregrine package with illustrative variants.

| Check ID | Flag these inputs | Leave this case unflagged |
|---|---|---|
| `broken_reference` | A form directs applicants to Annexure B §3, but Annexure B ends at §1.2. An agreement refers to Schedule 2, but the identified agreement contains only Schedule 1. | Annexure B §3 exists under the heading “3. Controlling Persons.” |
| `missing_document` | The signature clause acknowledges receipt of a Key Investor Information Document and no copy is found. The Class AA checklist requires a portfolio Explanatory Appendix, but the upload contains only the general PPM. | The required appendix appears as an identifiable section inside the PPM. |
| `party_name_mismatch` | The same portfolio manager appears as “Peregrine Capital Management IC Limited” and “Peregrine Capital Internal IC Limited.” The same administrator is identified in one form as “Example Fund Services (Guernsey) Limited” and in another as “Example Fund Services (Jersey) Limited.” | “Example Fund Services Ltd.” is an approved alias for “Example Fund Services Limited.” |
| `deadline_mismatch` | Class AA funding is due on Closing Date in one source and one Business Day before it in another. Two instructions for the same Class AA funding deadline use 5 p.m. South Africa time and 5 p.m. Bermuda time. | Individual forms are due five days before closing and entity forms are due two days before closing. The investor categories differ. |
| `suspect_reference` | An AEOI clause in §3.20 says “this paragraph 3.21.” An AML clause in §3.21 says “the representations in this paragraph 3.22.” | §3.20 explicitly refers to information requested “under §3.21,” and §3.21 exists. |
| `typo` | “Invetsor” appears in a heading. “FACTA” appears where the approved vocabulary specifies “FATCA.” | “Annexure” appears in a form and is in the approved vocabulary. |
| `definition_mismatch` | One “Qualified Plan” definition includes IRAs and another requires at least 100 employees. One “Business Day” definition uses London banking days and another uses Bermuda banking days for the same dealing calendar. | The definitions differ only in line breaks or quotation marks. |
| `duplicate_definition` | “Designated Body” appears twice in the same glossary. “Closing Date” appears as two identical definition entries in the same definitions section. | “Closing Date” appears once as a definition and again in a dealing instruction. |
| `value_mismatch` | Individual proof of address can be up to six months old in one form and three months old in the KYC checklist. The same class and subscription type show minimums of USD 100,000 and USD 150,000. | USD 100,000 and US$100,000 refer to the same minimum. |
| `required_field_missing` | The agreement requires benefit-plan investor status and the form has no corresponding question. A configured checklist requires ownership percentage for each beneficial owner and the form asks only for name and address. | The required percentage field is visible on the blank template. |
| `contact_or_version_mismatch` | Two forms give different addresses for sending the same KYC originals to the administrator. The approved package calls for the September 2025 entity form and the uploaded form is labeled August 2024. | The administrator lists separate addresses for courier deliveries and general correspondence. |

## Required output

Return one finding per issue. Reuse the app’s existing findings format, with these fields or their equivalents:

- **Check ID and title:** stable rule name plus a short description.
- **Status:** `detected` for a verified mechanical defect; `needs_review` when the evidence shows a difference or possible error that requires interpretation.
- **Evidence:** filename, PDF page, section if available, and exact excerpt. Include each side of a comparison. For an absent item, cite the reference or requirement and name what was searched for.
- **Next action:** one suggested correction or one specific question for the operator, administrator or counsel.

Group repeated evidence for the same issue. Compare only matching actions, parties and scopes; distinct investor categories, share classes or explicit exceptions can have different terms. If unreadable text or an ambiguous target prevents verification, report the check as **not verified** and give the reason. Never infer which clause controls, edit the source, or treat an unresolved comparison as a confirmed legal defect.
