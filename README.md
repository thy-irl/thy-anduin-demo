# Anduin Preflight

A browser-based tool for reviewing document packages before digitization. Built with React and Vite.

[Live demo](https://anduin-preflight-workbench.frankbride1.chatgpt.site)

## Design philosophy

**Start with the inconsistencies. Build the workflow around resolving them.**

I first defined what counts as an inconsistency, how it appears in documents, and what the expected finding should be. I compared results against those answers to build checks with useful coverage, without claiming to catch everything.

Then I designed the components around the reviewer’s next steps: verify the evidence, prepare questions for counsel, record responses and check what remains before handoff. **Finding an issue is the starting point. Getting the package ready is the goal.**

## Run locally

Requires Node.js 22.13+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the URL printed in the terminal. No API keys, database or backend setup required.

## Use the app

Start with a demo package or upload PDF, DOCX or TXT files.

1. **Documents:** inspect files, extraction coverage and package requirements.
2. **Review:** check findings against source evidence; confirm or dismiss issues.
3. **Questions:** prepare questions, record responses and record scoped internal approvals.
4. **Readiness:** review remaining actions and acknowledge the current package for handoff.

Download questions as Markdown or JSON, or export a PDF review summary.

## Know the limits

- Documents and review records stay in your browser. Clearing browser data removes them; report exports are not full backups.
- Checks use deterministic rules, with no AI calls or document uploads to external services.
- No OCR, shared storage or authentication. Scanned documents need manual inspection.
- Findings need human review. Internal readiness is not legal approval, and recorded approval names are unauthenticated.

## Check and build

```sh
npm run format:check
npm test
npm run build
```

Deploy the generated `dist/` folder to a static host. No environment variables required.

## Project files

- `src/` — application and document checks
- `public/samples/` — synthetic demo documents
- `tests/` — unit and browser checks
- [PRODUCT.md](PRODUCT.md) — product scope
- [DESIGN.md](DESIGN.md) — design rationale

# thy-anduin-demo
