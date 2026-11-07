# Anduin Preflight

- A browser-based workbench for spotting document inconsistencies, resolving review questions and preparing packages for digitization.

- Built with React and Vite.
[Live demo](https://thy-anduin-demo.vercel.app/)

## Design philosophy

**Start with the inconsistencies. Build the workflow around resolving them.**

I first defined what counts as an inconsistency, how it appears in documents, and what the expected finding should be. I compared results against those answers to build checks with useful coverage, without claiming to catch everything.

Then I designed the components around the reviewer’s next steps: verify the evidence, prepare questions for counsel, record responses and check what remains before handoff. **Finding an issue is the starting point. Getting the package ready is the goal.**

## AI usage

I used Codex throughout development: translating review requirements into [deterministic document checks](REVIEW-FINDINGS-DESIGN.md), implementing the interface, auditing UI/UX, and helping build test scenarios, backtests and regression checks. I defined expected findings and acceptance criteria, then used evaluation results and source evidence to direct fixes and refine the workflow.

My workflow was to define the problem, delegate bounded work to AI, evaluate the output and iterate. The app itself runs locally without model calls; AI supported building and evaluating it.

## Evaluation

I evaluated the app using public-source documents and synthetic scenarios with expected findings. Backtests and operational audits helped identify missed issues, false positives and workflow gaps, then guide fixes and regression checks.

These development evaluations do not establish production accuracy, legal correctness or measured time savings.

---
## The boring stuff
### Run locally

Requires Node.js 22.13+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the URL printed in the terminal. No API keys, database or backend setup required.

### Use the app

Start with a demo package or upload PDF, DOCX or TXT files.

1. **Documents:** inspect files, extraction coverage and package requirements.
2. **Review:** check findings against source evidence; confirm or dismiss issues.
3. **Questions:** prepare questions, record responses and record scoped internal approvals.
4. **Readiness:** review remaining actions and acknowledge the current package for handoff.

Download questions as Markdown or JSON, or export a PDF review summary.

### Know the limits

- Documents and review records stay in your browser. Clearing browser data removes them; report exports are not full backups.
- Checks use deterministic rules, with no AI calls or document uploads to external services.
- No OCR, shared storage or authentication. Scanned documents need manual inspection.
- Findings need human review. Internal readiness is not legal approval, and recorded approval names are unauthenticated.

### Check and build

```sh
npm run format:check
npm test
npm run build
```

Deploy the generated `dist/` folder to a static host. No environment variables required.

### Project files

- [src/](src/) — React interface, document parsing and deterministic checks
- [public/samples/](public/samples/) — synthetic demo documents
- [tests/](tests/) — unit tests and browser verification scripts
- [PRODUCT.md](PRODUCT.md) — product scope and constraints
- [DESIGN.md](DESIGN.md) — UI/UX design rationale
- [REVIEW-FINDINGS-DESIGN.md](REVIEW-FINDINGS-DESIGN.md) — document check requirements and expected findings
