import { demoSourceDocuments } from './demo-data.js';
import { requirementsDemoRows } from './requirements-demo.js';
import { normalizeIntakeContext } from '../context/intake.js';
import { saveDecisionResolution } from '../context/decisions.js';
import { recordReadinessAcknowledgement } from '../readiness/readiness.js';
import { analyze, analyzePackage } from '../analysis/engine.js';
export const demoDocuments = [
  {
    id: 'subscription',
    name: 'Subscription Agreement.pdf',
    type: 'PDF',
    size: 248300,
    version: 1,
    pages: [
      {
        number: 1,
        text: 'NORTHSTAR CAPITAL\nNorthstar Fund III, L.P.\nSUBSCRIPTION AGREEMENT\nConfidential · Synthetic demonstration document\n1. Subscription\nThe undersigned subscriber agrees to subscribe for a limited partnership interest in Northstar Fund III, L.P.\n1.1 Minimum commitment\nThe minimum investment is $250,000. The General Partner may waive this minimum at its discretion.\n1.2 Acceptance\nThe General Partner may accept or reject a subscription in whole or in part.',
      },
      {
        number: 2,
        text: '2. Investor representations\n2.1 Eligibility\nEach subscriber represents that it is an accredited investor and has reviewed the private placement memorandum.\n2.2 Additional requirements\nAn entity investor must complete the verification requirements set out in Section 14.3 before acceptance.\n3. Execution\nAn authorized signatory must execute this subscription agreement on behalf of an entity investor.\n4. Governing law\nThis agreement is governed by the laws of the State of Delaware.',
      },
    ],
  },
  {
    id: 'questionnaire',
    name: 'Investor Questionnaire.pdf',
    type: 'PDF',
    size: 182600,
    version: 1,
    pages: [
      {
        number: 1,
        text: 'NORTHSTAR CAPITAL\nNorthstar Fund III, L.P.\nINVESTOR QUESTIONNAIRE\nConfidential · Synthetic demonstration document\n1. Investor information\nProvide the full legal name, registered address, and tax identification number of the subscriber.\n2. Investor type\nIndicate whether the subscriber is an individual, trust, corporation, or partnership.',
      },
      {
        number: 2,
        text: '6. Tax information\nEach investor must provide the applicable tax certification and tax residency information.\n7. Entity investors\nIf the subscriber is an entity, complete Exhibit D and provide the beneficial ownership information requested therein.\n8. Ownership requirements\nEach “Qualified Entity” must also provide a current ownership chart and the names of its controlling persons.\n9. Declaration\nThe undersigned certifies that the information provided in this questionnaire is complete and accurate.',
      },
    ],
  },
  {
    id: 'ppm',
    name: 'Private Placement Memorandum.pdf',
    type: 'PDF',
    size: 496100,
    version: 1,
    pages: [
      {
        number: 1,
        text: 'NORTHSTAR CAPITAL\nNorthstar Fund III, L.P.\nPRIVATE PLACEMENT MEMORANDUM\nConfidential · Synthetic demonstration document\n1. Fund overview\nNorthstar Fund III, L.P. is a fictional private investment fund used solely to demonstrate document review workflows.\n2. Offering terms\nThe minimum investment is $500,000. Subscriptions are subject to acceptance by the General Partner.\n3. Investor eligibility\nInterests are offered solely to eligible investors in accordance with applicable exemptions.',
      },
    ],
  },
  {
    id: 'exhibit-a',
    name: 'Exhibit A — Investor details.pdf',
    type: 'PDF',
    size: 86400,
    version: 1,
    pages: [
      {
        number: 1,
        text: 'Exhibit A — Investor details\nNorthstar Fund III, L.P.\n1. Subscriber details\nFull legal name: ____________________\nRegistered address: ____________________\nTax identification number: ____________________\n2. Contact details\nPrimary contact name and email: ____________________',
      },
    ],
  },
];
export function makeDemo() {
  return {
    id: 'northstar-demo',
    name: 'Northstar Fund III',
    description: 'Subscription & onboarding package',
    createdAt: new Date().toISOString(),
    demo: true,
    documents: demoDocuments,
    findings: analyze(demoDocuments),
    activity: [
      {
        id: 'initial',
        text: 'Preflight completed · 4 potential issues identified',
        time: new Date().toISOString(),
      },
    ],
    lastRun: new Date().toISOString(),
  };
}

// These examples use the supplied fictional PDFs/DOCX, with illustrative review records.
// The original Northstar factory remains available for older fixtures and saved packages.
export const DEMO_PACKAGE_IDS = [
  'cedar-harbor-open-demo',
  'willow-quay-ready-demo',
  'alder-point-requirements-demo',
];
export function makeDemoPackages() {
  const now = new Date().toISOString();
  const makePackage = (kind, id, name, description) => {
    const documents = structuredClone(demoSourceDocuments[kind]);
    return {
      id,
      name,
      description,
      demo: true,
      createdAt: now,
      lastRun: now,
      documents,
      findings: analyze(documents),
      intakeContext: normalizeIntakeContext(),
      activity: [
        { id: `${id}-created`, text: 'Synthetic demo loaded from supplied documents', time: now },
      ],
    };
  };
  const open = makePackage(
    'open-findings',
    DEMO_PACKAGE_IDS[0],
    'Cedar Harbor — Open findings',
    'Supplied defective package · eight findings awaiting review',
  );
  const ready = makePackage(
    'ready-handoff',
    DEMO_PACKAGE_IDS[1],
    'Willow Quay — Ready to hand off',
    'Supplied clean package · illustrative internal review completed',
  );
  const doc = ready.documents[0];
  const quote = doc.pages[0].text.match(
    /The applicant must complete Schedule A[\s\S]*?October 30, 2026\./,
  )[0];
  const documentVersions = Object.fromEntries(ready.documents.map((d) => [d.id, d.version]));
  ready.intakeContext.decisions = [
    saveDecisionResolution(
      null,
      {
        id: 'willow-quay-demo-confirmation',
        title: 'Demo: confirm the source package for handoff',
        issueType: 'internal',
        status: 'confirmed',
        owner: 'Alex Morgan (demo reviewer)',
        findingIds: [],
        question: 'Which supplied source versions are included in this internal review handoff?',
        assignedTo: 'Alex Morgan (demo reviewer)',
        askedAt: now,
        source: {
          documentId: doc.id,
          documentVersion: doc.version,
          page: doc.pages[0].number,
          quote,
        },
        documentVersions,
        answer:
          'The supplied Subscription Agreement, Private Placement Memorandum and Investor Details are included at version 1.',
        response: {
          text: 'Illustrative demo response: include the three supplied Willow Quay documents at version 1. Retain their source citations and extraction limitations with the internal handoff.',
          author: 'Alex Morgan (demo reviewer)',
          channel: 'Synthetic demo review',
          receivedAt: now,
          reference: 'DEMO-WQ-001 — illustrative record, no external correspondence',
          recordedBy: 'Alex Morgan (demo reviewer)',
        },
        approval: {
          recordedBy: 'Jordan Lee (demo lead)',
          approvedAt: now,
          rationale:
            'Illustrative internal approval of the listed source inventory for this demo handoff.',
          applicability: {
            vehicle: 'Willow Quay Private Credit Fund I, L.P.',
            investorRoute: 'Class A initial subscription',
            documentIds: ready.documents.map((d) => d.id),
            documentVersions,
            conditions:
              'Synthetic internal review example only; applies to the listed supplied versions.',
          },
        },
      },
      { documents: ready.documents, findings: ready.findings },
      { recordApproval: true, recordedAt: now },
    ),
  ];
  const analysis = analyzePackage(ready.documents, ready.intakeContext);
  ready.readinessReview = recordReadinessAcknowledgement(ready, analysis, {
    recordedBy: 'Jordan Lee (demo lead)',
    rationale:
      'Illustrative completed review of the supplied clean package for internal digitization handoff.',
    coverageReview:
      'Demo review covers all supplied PDF pages and DOCX paragraphs. DOCX pagination is not reconstructed. Deterministic checks do not establish legal correctness, authenticity or comprehensive defect detection; those limitations are retained for handoff.',
    acknowledged: true,
    now,
  });
  ready.activity.push({
    id: 'willow-quay-demo-handoff',
    text: 'Illustrative response, scoped internal approval and readiness acknowledgement recorded',
    time: now,
  });
  const requirements = makePackage(
    'package-requirements',
    DEMO_PACKAGE_IDS[2],
    'Alder Point — Package requirements',
    'Synthetic entity investor package · missing Exhibit D and supplied ownership chart',
  );
  requirements.intakeContext = normalizeIntakeContext({
    requirements: structuredClone(requirementsDemoRows),
  });
  requirements.findings = analyzePackage(
    requirements.documents,
    requirements.intakeContext,
  ).findings;
  requirements.activity[0].text =
    'Synthetic requirement demo loaded with two source-backed inventory checks';
  return [open, ready, requirements];
}

export function addDemoPackages(state) {
  const missing = DEMO_PACKAGE_IDS.filter((id) => !state.packages.some((p) => p.id === id));
  if (!missing.length) return state;
  return {
    ...state,
    packages: [...state.packages, ...makeDemoPackages().filter((p) => missing.includes(p.id))],
  };
}
