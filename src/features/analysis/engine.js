import {
  blocksOf,
  inventoryOf,
  attachmentPattern,
  attachmentName,
  filingLabelAt,
  normalize,
  stableId,
  sourceSpan,
  contextSpan,
  sectionNumber,
} from './structure.js';
import { factsOf, compatible } from './facts.js';
import { coverageOf, packageCoverage } from './coverage.js';
import { mechanicalChecks } from './mechanical.js';
import { findingDetails } from './finding.js';
import { provisionChecks } from './provisions.js';
import { obligationChecks } from './obligations.js';
import { servicesChecks } from './services.js';
import { packageContext, sameIdentity, linkedSubscriptions, linkedServices } from './context.js';
import { correctionEvidence } from './resolution.js';
import { reconcileManualIssue } from '../review/manual.js';
import { preflightChecks, integratePreflight, definitionKey } from './preflight.js';
export { blocksOf };
export function analyzePackage(documents, intakeContext) {
  const context = packageContext(documents, intakeContext),
    identities = new Map(context.documents.map((doc) => [doc.documentId, doc])),
    activeDocuments = documents.filter((doc) => identities.get(doc.id).status !== 'superseded'),
    activeIds = new Set(activeDocuments.map((doc) => doc.id));
  const packageGaps = activeDocuments.some((d) => d.rejected || coverageOf(d).gaps.length > 0);
  const inventory = documents.flatMap((doc) =>
      inventoryOf(doc).map((item) => ({
        ...item,
        fund: identities.get(doc.id).fund,
        status: identities.get(doc.id).status,
      })),
    ),
    references = [],
    facts = documents.map((d) => ({
      documentId: d.id,
      status: identities.get(d.id).status,
      ...factsOf(d, identities.get(d.id)),
    })),
    findings = [];
  const add = (type, title, severity, evidence, description, question, identity, extra = {}) => {
    const id = stableId(`${type}:${identity}`),
      prior = findings.find((f) => f.id === id);
    if (prior) {
      for (const e of evidence)
        if (
          !prior.evidence.some(
            (p) => p.documentId === e.documentId && p.page === e.page && p.text === e.text,
          )
        )
          prior.evidence.push(e);
      if (extra.referenceId)
        prior.referenceIds = [
          ...new Set(
            [...(prior.referenceIds || [prior.referenceId]), extra.referenceId].filter(Boolean),
          ),
        ];
      return;
    }
    const finding = {
      id,
      type,
      title,
      severity,
      evidence,
      evidenceVersion: 2,
      description,
      question,
      rule: 'Deterministic text and scope rule; accuracy is not calibrated',
      uncertainty: extra.classification || 'Applicability requires reviewer confirmation',
      status: 'open',
      note: '',
      ...(evidence.some((e) =>
        ['master services agreement', 'statement of work', 'service level schedule'].includes(
          identities.get(e.documentId)?.role,
        ),
      )
        ? { domain: 'services' }
        : {}),
      ...extra,
    };
    findings.push({ ...finding, ...findingDetails(finding) });
  };
  const referenceIdentity = (documentId, scope, target) => {
    // Only explicitly linked companions share one missing-attachment question.
    // Independent agreements, unknown identities and embedded scopes stay separate.
    const parent = context.relationships.find((r) => r.from === documentId)?.to;
    const root =
      parent || (context.relationships.some((r) => r.to === documentId) ? documentId : null);
    return root && (!scope || scope === documentId)
      ? `${root}:${root}:${target}`
      : `${documentId}:${scope || ''}:${target}`;
  };
  for (const d of activeDocuments) {
    const coverage = coverageOf(d),
      coverageGap = coverage.gaps.length > 0 || d.rejected || d.pages.some((p) => p.visualGap),
      blocks = blocksOf(d),
      fund = identities.get(d.id).fund;
    const headings = blocks
      .filter((b) => b.kind === 'heading')
      .flatMap((b) => {
        const target = sectionNumber(b.text);
        return target ? [{ target, evidence: b }] : [];
      });
    for (const p of d.pages) {
      const text = p.text;
      for (const m of text.matchAll(attachmentPattern())) {
        if (filingLabelAt(d, p, m)) continue;
        if (
          m[1].toLowerCase() === 'schedule' &&
          /^\s*-\d/.test(text.slice(m.index + m[0].trimEnd().length))
        ) {
          references.push({
            kind: 'legislative/tax form',
            target: m[0],
            classification: 'external document not supplied',
            evidence: sourceSpan(d, p, m.index, Math.min(text.length, m.index + 150)),
            targets: [],
          });
          continue;
        }
        const target = attachmentName(m),
          start = Math.max(0, text.lastIndexOf('\n', m.index) + 1),
          evidence = contextSpan(d, p, m.index, m.index + m[0].length, 'Attachment reference');
        const self = inventory.find(
          (x) =>
            x.evidence.documentId === d.id &&
            x.page === p.number &&
            x.title === target &&
            x.kind === 'attachment body',
        );
        const ownHeading = inventory.find(
          (x) =>
            x.evidence.documentId === d.id &&
            x.page === p.number &&
            x.title === target &&
            x.evidence.span.start === start,
        );
        if (ownHeading) continue;
        const toc = inventory.find(
          (x) =>
            x.evidence.documentId === d.id &&
            x.page === p.number &&
            x.title === target &&
            x.kind === 'table of contents' &&
            x.evidence.span.start === start,
        );
        if (toc) continue;
        // Same-document attachment scopes follow governing agreement boundaries. Cross-file resolution needs an explicit matching fund identity.
        const localScope = blocks.find(
          (b) => b.page === p.number && m.index >= b.span.start && m.index < b.span.end,
        )?.governing;
        const candidates = inventory.filter(
          (x) =>
            activeIds.has(x.evidence.documentId) &&
            x.title === target &&
            x.substantive &&
            ((x.evidence.documentId === d.id && (!localScope || x.scope === localScope)) ||
              (x.evidence.documentId !== d.id &&
                ((linkedServices(context, d.id, x.evidence.documentId) &&
                  x.scope === x.evidence.documentId) ||
                  (fund &&
                    x.fund === fund &&
                    sameIdentity(identities.get(d.id), identities.get(x.evidence.documentId)) &&
                    (x.scope === x.evidence.documentId ||
                      localScope?.replace(/:\d+$/, '') === x.scope.replace(/:\d+$/, '') ||
                      linkedSubscriptions(context, d.id, x.evidence.documentId)))))),
        );
        const uncertainCandidates = inventory.filter(
          (x) =>
            activeIds.has(x.evidence.documentId) &&
            x.title === target &&
            x.substantive &&
            x.evidence.documentId !== d.id &&
            !(fund && x.fund && fund !== x.fund),
        );
        const classification =
          self || candidates.length === 1
            ? 'resolved'
            : candidates.length > 1 || uncertainCandidates.length
              ? 'ambiguous target'
              : coverageGap || packageGaps
                ? 'insufficient extraction coverage'
                : 'internal target missing';
        const mismatchedCandidates = inventory.filter(
          (x) =>
            activeIds.has(x.evidence.documentId) &&
            x.title === target &&
            x.substantive &&
            x.evidence.documentId !== d.id &&
            fund &&
            x.fund &&
            fund !== x.fund,
        );
        const ref = {
          id: stableId(`${d.id}:${localScope || d.id}:${target}`),
          kind: 'attachment',
          target,
          classification,
          evidence,
          targets: self ? [self] : candidates,
          candidateTargets: classification === 'ambiguous target' ? uncertainCandidates : [],
          mismatchedCandidates,
          scope: localScope || d.id,
        };
        references.push(ref);
        if (classification === 'resolved') continue;
        add(
          'Missing attachment',
          classification === 'internal target missing' ? `Missing ${target}` : `Verify ${target}`,
          classification === 'internal target missing' ? 'blocking' : 'review',
          [evidence, ...mismatchedCandidates.map((x) => x.evidence)],
          `${target}: ${classification}. No substantive target has been established in the applicable supplied scope. ${mismatchedCandidates.length ? 'A supplied attachment identifies a different fund and cannot establish the required target. ' : ''}This is an input-completeness question.`,
          classification === 'insufficient extraction coverage'
            ? `Inspect the ${target} reference and unreadable/image pages to verify presence. OCR was not performed; do not conclude that material is missing before checking the original.`
            : classification === 'ambiguous target'
              ? `Which supplied ${target} candidate governs this reference? Confirm agreement, fund and version identity.`
              : mismatchedCandidates.length
                ? `The supplied ${target} identifies ${mismatchedCandidates.map((x) => x.fund).join(', ')}, while this reference belongs to ${fund}. Please supply the correct fund/closing version or confirm its applicability.`
                : `Please supply the substantive ${target} or confirm its applicability and governing scope.`,
          referenceIdentity(d.id, localScope, target),
          {
            classification,
            target,
            referenceId: ref.id,
            referenceIds: [ref.id],
            scope: localScope || d.id,
          },
        );
      }
      const sectionReferences = [
        'master services agreement',
        'statement of work',
        'service level schedule',
      ].includes(identities.get(d.id).role)
        ? /\bsection\s+(\d+(?:\.\d+)*|[A-Z]\.?\d+(?:\.\d+)*)\b/gi
        : /\bsection\s+(\d+(?:\.\d+)+)\b/gi;
      for (const m of text.matchAll(sectionReferences)) {
        // Compound attachment references and explicit self-references are
        // checked with their enclosing scope by the preflight rules.
        if (
          /(?:\bthis\s+|\b(?:Annexure|Annex|Schedule|Appendix|Exhibit)\s+[A-Z0-9]+\s*[,;:]?\s*)$/i.test(
            text.slice(Math.max(0, m.index - 100), m.index),
          )
        )
          continue;
        if (
          blocks.some(
            (b) =>
              b.page === p.number &&
              b.kind === 'heading' &&
              b.span.start <= m.index &&
              b.span.end > m.index &&
              new RegExp(`^\\s*section\\s+${m[1].replaceAll('.', '\\.')}[.)]?\\s+`, 'i').test(
                b.text,
              ),
          )
        )
          continue;
        const legislative = /(?:Treasury\s+Regulations?|Regulations|U\.S\.C\.|C\.F\.R\.)\s*$/i.test(
          text.slice(Math.max(0, m.index - 80), m.index),
        );
        const following = text.slice(m.index + m[0].length, m.index + m[0].length + 190),
          explicitLocal =
            /^\s*(?:(?:of|in|under)\s+(?:(?:this|the\s+present)\s+(?:Agreement|Booklet|Questionnaire)|the\s+Agreement)|hereof|herein)\b/i.test(
              following,
            );
        const external = explicitLocal
          ? null
          : following.match(
              /^\s*(?:-\d+)?(?:\([^)]*\))*\s+(?:of|in|under)\s+(?:the\s+)?([^.;]{0,120}?(?:Agreement|Memorandum|Code|Act|ERISA|Regulation|Schedule|Work))/i,
            );
        const supplied = external
          ? inventory.filter(
              (x) =>
                activeIds.has(x.evidence.documentId) &&
                x.kind === 'agreement' &&
                (x.fund === fund || linkedServices(context, d.id, x.evidence.documentId)) &&
                normalize(x.title).endsWith(normalize(external[1])),
            )
          : [];
        const serviceCandidates = supplied.filter(
          (x) =>
            x.evidence.documentId !== d.id && linkedServices(context, d.id, x.evidence.documentId),
        );
        const serviceTargets = serviceCandidates.flatMap((x) =>
          blocksOf(documents.find((doc) => doc.id === x.evidence.documentId))
            .filter((b) => b.kind === 'heading' && sectionNumber(b.text) === m[1])
            .map((evidence) => ({ target: m[1], evidence })),
        );
        const localBlock = blocks.find(
            (b) => b.page === p.number && b.span.start <= m.index && b.span.end > m.index,
          ),
          localScope = localBlock?.sectionScope || localBlock?.governing;
        const local =
          external || legislative
            ? []
            : headings.filter(
                (h) =>
                  h.target === m[1] &&
                  (!localScope || (h.evidence.sectionScope || h.evidence.governing) === localScope),
              );
        const classification =
          serviceCandidates.length === 1
            ? serviceTargets.length === 1
              ? 'resolved'
              : packageGaps
                ? 'insufficient extraction coverage'
                : 'internal target missing'
            : external
              ? supplied.length
                ? 'ambiguous target'
                : 'external document not supplied'
              : legislative
                ? 'external document not supplied'
                : local.length
                  ? 'resolved'
                  : coverageGap
                    ? 'insufficient extraction coverage'
                    : 'internal target missing';
        const b =
          blocks.find(
            (b) => b.page === p.number && m.index >= b.span.start && m.index < b.span.end,
          ) || sourceSpan(d, p, m.index, Math.min(text.length, m.index + 200));
        references.push({
          id: stableId(`${d.id}:${localScope || ''}:section:${m[1]}`),
          kind: 'section',
          target: `Section ${m[1]}`,
          externalDocument: external?.[1]?.replace(/\s+/g, ' '),
          classification,
          evidence: b,
          candidateAgreements: supplied,
          targets: serviceTargets.length ? serviceTargets : local,
        });
        if (
          (external && serviceCandidates.length !== 1) ||
          legislative ||
          local.length ||
          serviceTargets.length === 1
        )
          continue;
        add(
          'Broken reference',
          classification === 'internal target missing'
            ? `Section ${m[1]} not found`
            : `Verify Section ${m[1]}`,
          'review',
          [b],
          `Section ${m[1]}: ${classification}. Verify the original and governing scope before treating this as a missing internal provision.`,
          `Which provision should Section ${m[1]} identify? Confirm the internal target or supply the governing companion.`,
          `${d.id}:${localScope || ''}:${m[1]}`,
          {
            classification,
            target: `Section ${m[1]}`,
            scope: localScope || d.id,
            referenceId: stableId(`${d.id}:${localScope || ''}:section:${m[1]}`),
          },
        );
      }
    }
    for (const check of mechanicalChecks(d)) {
      const { type, title, severity, evidence, description, question, identity, ...extra } = check;
      add(type, title, severity, evidence, description, question, identity, extra);
    }
  }
  for (const check of [
    ...provisionChecks(activeDocuments, context),
    ...obligationChecks(activeDocuments, context),
    ...servicesChecks(activeDocuments, context, facts),
  ]) {
    const { type, title, severity, evidence, description, question, identity, ...extra } = check;
    add(type, title, severity, evidence, description, question, identity, extra);
  }
  const defs = facts.filter((f) => activeIds.has(f.documentId)).flatMap((f) => f.definitions),
    mins = facts.filter((f) => activeIds.has(f.documentId)).flatMap((f) => f.minimums);
  for (let i = 0; i < defs.length; i++)
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i],
        b = defs[j];
      if (
        a.term !== b.term ||
        a.kind === 'inline designation' ||
        b.kind === 'inline designation' ||
        definitionKey(a.meaning) === definitionKey(b.meaning) ||
        !compatible(a, b)
      )
        continue;
      if (a.agreement && b.agreement && a.agreement !== b.agreement) continue;
      // Distinct named agreements keep local meanings; duplicated source text supports a comparison question.
      const da = documents.find((d) => d.id === a.evidence.documentId),
        db = documents.find((d) => d.id === b.evidence.documentId);
      const overlap =
        normalize(da.pages.map((p) => p.text).join(' ')).includes(
          normalize(b.evidence.text).slice(0, 50),
        ) ||
        (a.fund && a.fund === b.fund);
      if (da.id !== db.id && !overlap) continue;
      add(
        'Defined term',
        `Inconsistent definition of “${a.display}”`,
        'review',
        [a.evidence, b.evidence],
        `The cited definitions differ within a potentially overlapping scope. Confirm which applies; different governing agreements may legitimately define the term differently.`,
        `Which definition of “${a.display}” governs the identified investor and provision?`,
        `${a.term}:${[da.id, db.id].sort().join(':')}`,
        { facts: [a, b] },
      );
    }
  for (const d of activeDocuments)
    for (const b of blocksOf(d))
      for (const m of [
        ...b.text.matchAll(/\b(?:The|Each|Any|An?)\s+[“"]\s*([A-Z][^”"\n]{2,50}?)\s*[”"]/g),
        ...b.text.matchAll(/\bclaiming\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+status\b/g),
        ...b.text.matchAll(
          /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:as\s+defined\s+in|has\s+the\s+meaning\s+given\s+in)\b/g,
        ),
      ]) {
        const df = facts.find((f) => f.documentId === d.id);
        if (
          defs.some(
            (f) =>
              f.term === normalize(m[1]) &&
              (f.evidence.documentId === d.id ||
                linkedServices(context, d.id, f.evidence.documentId) ||
                (sameIdentity(identities.get(d.id), identities.get(f.evidence.documentId)) &&
                  (linkedSubscriptions(context, d.id, f.evidence.documentId) ||
                    (f.fund && f.fund === identities.get(d.id).fund)))),
          ) ||
          df.incorporations.length ||
          /\b(?:means|shall mean|includes)\b/.test(b.text)
        )
          continue;
        add(
          'Defined term',
          `“${m[1]}” is not defined`,
          'advisory',
          [b],
          `No explicit definition was established in this supplied governing scope; an external definition or descriptive usage remains possible.`,
          /^claiming\s/.test(m[0])
            ? `Please identify what qualifies an investor for “${m[1]}”, its governing definition and applicability, and which supplemental verification fields are required.`
            : `Please identify the governing definition of “${m[1]}” and its applicability.`,
          `${d.id}:${normalize(m[1])}`,
        );
      }
  for (let i = 0; i < mins.length; i++)
    for (let j = i + 1; j < mins.length; j++) {
      const a = mins[i],
        b = mins[j];
      if (
        a.amount === b.amount ||
        a.currency !== b.currency ||
        a.aggregate ||
        b.aggregate ||
        a.contribution !== b.contribution ||
        !compatible(a, b)
      )
        continue;
      const evidence = [
        a.evidence,
        b.evidence,
        ...[
          a.qualificationEvidence,
          b.qualificationEvidence,
          a.scopeEvidence,
          b.scopeEvidence,
        ].filter(Boolean),
      ];
      add(
        'Cross-document',
        'Minimum investment discrepancy',
        'review',
        evidence,
        `The cited ${a.contribution === 'unspecified' ? 'unqualified' : a.contribution} investor minimums are ${a.currency} ${a.amount.toLocaleString('en-US')} and ${b.currency} ${b.amount.toLocaleString('en-US')}. ${a.exceptionContext || b.exceptionContext ? 'Discretion or exception context is present; the amounts may be intentional. General discretion does not establish an exercised investor waiver.' : 'Applicability to the same investor and closing remains to be confirmed.'}`,
        `Which minimum applies to this investor, class and closing? Confirm both provisions and whether an exception was exercised.`,
        [a.evidence.documentId, b.evidence.documentId].sort().join(':'),
        { facts: [a, b] },
      );
    }
  const preflight = preflightChecks(activeDocuments, context);
  const combined = integratePreflight(findings, preflight.checks);
  // A compound subsection reference is one issue, even when its attachment is absent.
  const scopedFindings = combined.filter(
    (f) =>
      !(
        f.type === 'Missing attachment' &&
        preflight.checks.some(
          (c) =>
            c.checkId === 'broken_reference' &&
            c.target?.startsWith(`${f.target} §`) &&
            c.evidence.some((e) =>
              f.evidence.some((x) => x.documentId === e.documentId && x.page === e.page),
            ),
        )
      ),
  );
  return {
    checkResults: preflight.checkResults,
    findings: scopedFindings.sort(
      (a, b) =>
        ({ blocking: 0, review: 1, advisory: 2 })[a.severity] -
        { blocking: 0, review: 1, advisory: 2 }[b.severity],
    ),
    inventory,
    references,
    facts,
    context,
    coverage: packageCoverage(documents),
  };
}
export function analyze(documents, intakeContext) {
  const result = analyzePackage(documents, intakeContext);
  Object.defineProperties(result.findings, {
    analysis: { value: result, enumerable: false },
    sourceDocuments: { value: documents, enumerable: false },
  });
  return result.findings;
}
export function mergeFindings(previous, current) {
  const old = new Map(previous.map((f) => [f.id, f])),
    matched = new Set();
  const signature = (f) =>
    JSON.stringify([
      f.classification || null,
      f.evidence.map((e) => [e.documentId, e.page, e.text]).sort(),
    ]);
  const history = (f, event) => [
    ...(f.history || []),
    {
      event,
      time: new Date().toISOString(),
      previousStatus: f.status,
      evidence: f.evidence,
      note: f.note,
      question: f.question,
    },
  ];
  const legacyScopedReference = (f) => {
    if (
      f.type !== 'Broken reference' ||
      current.filter((n) => n.type === f.type && n.title === f.title).length !== 1
    )
      return null;
    const candidates = previous.filter(
      (p) =>
        (!p.scope ||
          (f.domain === 'services' &&
            p.evidence.every(
              (e) => p.scope === e.documentId && f.scope?.startsWith(`${e.documentId}:document:`),
            ))) &&
        !matched.has(p.id) &&
        p.type === f.type &&
        p.title === f.title &&
        p.target === f.target &&
        p.evidence.every((e) => {
          const d = current.sourceDocuments?.find((d) => d.id === e.documentId),
            page = d?.pages.find((p) => p.number === e.page);
          return (
            page &&
            e.span &&
            page.text.slice(e.span.start, e.span.end) === e.text &&
            f.evidence.some(
              (n) =>
                n.documentId === e.documentId &&
                n.page === e.page &&
                n.span?.start <= e.span.end &&
                n.span?.end >= e.span.start,
            )
          );
        }),
    );
    return candidates.length === 1 ? candidates[0] : null;
  };
  const presentationOnly = (prior, f) => {
    if (
      prior.evidenceVersion === f.evidenceVersion ||
      (prior.classification || null) !== (f.classification || null) ||
      !current.sourceDocuments
    )
      return false;
    const sources = (items) =>
      JSON.stringify([...new Set(items.map((e) => `${e.documentId}:${e.page}`))].sort());
    return (
      sources(prior.evidence) === sources(f.evidence) &&
      prior.evidence.every((e) => {
        const d = current.sourceDocuments.find((d) => d.id === e.documentId),
          p = d?.pages.find((p) => p.number === e.page);
        return (
          p &&
          e.span &&
          e.documentVersion === d.version &&
          p.text.slice(e.span.start, e.span.end) === e.text
        );
      })
    );
  };
  const merged = current.map((f) => {
    const groupedPriors =
      f.type === 'Missing attachment'
        ? previous.filter(
            (p) =>
              p.type === f.type &&
              p.target === f.target &&
              !matched.has(p.id) &&
              (f.referenceIds || [f.referenceId]).includes(p.referenceId),
          )
        : [];
    const prior =
      old.get(f.id) ||
      groupedPriors.slice().sort((a, b) => a.id.localeCompare(b.id))[0] ||
      legacyScopedReference(f) ||
      previous.find(
        (p) =>
          !p.rule &&
          !matched.has(p.id) &&
          p.type === f.type &&
          p.title === f.title &&
          current.filter((n) => n.type === f.type && n.title === f.title).length === 1 &&
          p.evidence.some((e) => f.evidence.some((n) => n.documentId === e.documentId)),
      );
    if (!prior) return f;
    matched.add(prior.id);
    const siblings = groupedPriors.filter((p) => p.id !== prior.id);
    for (const sibling of siblings) matched.add(sibling.id);
    const changed = signature(prior) !== signature(f) && !presentationOnly(prior, f),
      versionChanged =
        JSON.stringify(prior.evidence.map((e) => [e.originalKey, e.documentVersion])) !==
        JSON.stringify(f.evidence.map((e) => [e.originalKey, e.documentVersion]));
    return {
      ...f,
      id: prior.id,
      status:
        prior.status === 'resolved' || prior.status === 'needs-verification' || changed
          ? 'open'
          : prior.status,
      note: prior.note,
      question: prior.question,
      includeInReport: prior.includeInReport,
      history: changed
        ? history(prior, 'Evidence changed; review reopened')
        : versionChanged
          ? history(prior, 'Source version updated; cited wording unchanged')
          : prior.history,
      ...(siblings.length || prior.groupedReviews
        ? {
            // Preserve former questions, dispositions and IDs as history; a larger
            // evidence group always requires fresh review. Callers remap task links.
            legacyFindingIds: [
              ...new Set([
                ...(prior.legacyFindingIds || []),
                ...siblings.flatMap((p) => [p.id, ...(p.legacyFindingIds || [])]),
              ]),
            ],
            groupedReviews: [...(prior.groupedReviews || []), ...siblings],
            ...(siblings.length
              ? {
                  status: 'open',
                  note: [...new Set([prior, ...siblings].map((p) => p.note).filter(Boolean))].join(
                    '\n\n',
                  ),
                  includeInReport: [prior, ...siblings].some((p) => p.includeInReport === true),
                  history: [
                    ...history(prior, 'Repeated attachment references grouped; review reopened'),
                    {
                      event: 'Former independent reviews retained in groupedReviews',
                      findingIds: siblings.map((p) => p.id),
                      time: new Date().toISOString(),
                    },
                  ],
                }
              : {}),
          }
        : {}),
    };
  });
  for (const f of previous)
    if (!matched.has(f.id)) {
      if (f.manual) {
        merged.push(reconcileManualIssue(f, current.sourceDocuments));
        continue;
      }
      const analysis = current.analysis,
        referenceIds = f.referenceIds || [f.referenceId],
        refs = analysis?.references.filter((r) => referenceIds.includes(r.id)),
        targetSupported =
          refs?.length &&
          referenceIds.every((id) => refs.some((r) => r.id === id)) &&
          refs.every((r) => r.classification === 'resolved' && r.targets.length) &&
          refs.every((r) =>
            r.targets.every(
              (t) =>
                !analysis.coverage.files.find((d) => d.id === t.evidence.documentId)?.gaps.length,
            ),
          );
      const resolutionEvidence = targetSupported
          ? refs.flatMap((r) =>
              r.targets.flatMap((t) => [t.evidence, ...(t.contentEvidence || [])]),
            )
          : correctionEvidence(f, analysis, current.sourceDocuments),
        supported = resolutionEvidence.length > 0;
      merged.push({
        ...f,
        status: supported
          ? 'resolved'
          : f.status === 'dismissed'
            ? 'dismissed'
            : 'needs-verification',
        resolutionEvidence,
        history: history(
          f,
          supported
            ? targetSupported
              ? 'Resolved with substantive target evidence'
              : 'Resolved with explicit corrected source evidence'
            : 'Detector absent; resolution requires verification',
        ),
      });
    }
  return merged;
}
export const activeFindings = (findings) =>
  findings.filter((f) => !['resolved', 'dismissed'].includes(f.status));
