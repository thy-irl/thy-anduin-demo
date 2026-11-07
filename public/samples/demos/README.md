# Supplied synthetic demo documents

- `package-requirements/`: purpose-written Alder Point TXT sources with two prefilled, source-backed requirements: missing Exhibit D — Beneficial Ownership and a supplied Ownership Chart. Open **Packages → Add demo packages** if needed, choose **Alder Point — Package requirements → Documents**, then edit either row under **Package requirements and rule configuration** to see the populated form. Exhibit D is intentionally absent.

- `open-findings/`: the three original Cedar Harbor PDFs from `backtest/scenarios/2026-11-07-defective-package/`, copied without modification. The current engine identifies eight open findings.
- `ready-handoff/`: the original Willow Quay PDF/DOCX files from `backtest/scenarios/2026-11-04-realistic-pack/01-clean-package/`, copied without modification. The current engine identifies no findings. The DOCX paragraph-locator limitation remains visible.

`src/features/documents/demo-data.js` contains browser-parser extraction of the supplied PDF/DOCX files and includes the purpose-written TXT sources from `requirements-demo.js`. The normal IndexedDB original-file lookup caches these bundled originals on demand. `demo.js` constructs the illustrative review records through the normal approval and readiness APIs. Names, responses and approvals in those records are explicitly synthetic; the supplied PDF/DOCX sources have not been edited to establish readiness.
