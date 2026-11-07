// Fictional, source-backed examples for the package requirement editor.
export const requirementsDemoDocuments = [
  {
    id: 'alder-point-instructions',
    name: 'Entity Investor Instructions.txt',
    type: 'TXT',
    version: 1,
    originalKey: 'alder-point-instructions-v1',
    samplePath: 'samples/demos/package-requirements/Entity_Investor_Instructions.txt',
    pages: [
      {
        number: 1,
        text: `ALDER POINT FUND I, L.P.
Entity Investor Instructions
Version 1 — 7 November 2026
FICTIONAL TRAINING DOCUMENT — Synthetic demo only.

This example package is for an entity investor.

Required documents
Entity investors must supply Exhibit D — Beneficial Ownership with this package.
Entity investors must supply an Ownership Chart with this package.

The fund operations team supplies Exhibit D. The investor supplies the Ownership Chart.
These instructions establish the expected inventory for this synthetic review example.
`,
      },
    ],
  },
  {
    id: 'alder-point-ownership-chart',
    name: 'Ownership Chart.txt',
    type: 'TXT',
    version: 1,
    originalKey: 'alder-point-ownership-chart-v1',
    samplePath: 'samples/demos/package-requirements/Ownership_Chart.txt',
    pages: [
      {
        number: 1,
        text: `ALDER POINT FUND I, L.P.
Ownership Chart
Version 1 — 7 November 2026
FICTIONAL TRAINING DOCUMENT — Synthetic demo only.

Investor: Alder Example Holdings LLC
Owner: Taylor Example — 100% ownership
Prepared by: Investor onboarding team (demo)
`,
      },
    ],
  },
].map((doc) => ({ ...doc, size: new TextEncoder().encode(doc.pages[0].text).length }));

export const requirementsDemoRows = [
  {
    id: 'alder-point-exhibit-d',
    label: 'Exhibit D — Beneficial Ownership',
    check: 'document',
    relationship: 'attached',
    owner: 'Fund operations team (demo)',
    documentId: '',
    source: {
      documentId: 'alder-point-instructions',
      documentVersion: 1,
      page: 1,
      quote: 'Entity investors must supply Exhibit D — Beneficial Ownership with this package.',
    },
  },
  {
    id: 'alder-point-ownership-chart-required',
    label: 'Ownership Chart',
    check: 'document',
    relationship: 'attached',
    owner: 'Investor onboarding team (demo)',
    documentId: 'alder-point-ownership-chart',
    source: {
      documentId: 'alder-point-instructions',
      documentVersion: 1,
      page: 1,
      quote: 'Entity investors must supply an Ownership Chart with this package.',
    },
  },
];
