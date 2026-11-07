import {
  fundIdentity,
  normalize,
  sourceSpan,
  documentTitle,
  attachmentPattern,
  attachmentName,
} from './structure.js';
import { normalizeIntakeContext, sourceState } from '../context/intake.js';

// Package metadata describes explicit source identity, not a universal legal hierarchy.
const cache = new WeakMap();
export function documentContext(doc) {
  if (cache.has(doc)) return cache.get(doc);
  const text = doc.pages.map((p) => p.text).join('\n'),
    first = text.slice(0, 1800);
  const roles = [
    ['master services agreement', /^\s*master services agreement\s*$/im],
    ['statement of work', /^\s*statement of work(?:\s+\d+)?\s*$/im],
    ['service level schedule', /^\s*service level schedule\s*$/im],
    ['side letter', /^\s*side letter(?:\s*[-–—:]|\s+to\b|\s*$)/im],
    ['memorandum', /^\s*(?:private placement|offering) memorandum\b/im],
    ['partnership agreement', /^\s*(?:limited )?partnership agreement\b/im],
    ['subscription agreement', /^\s*(?:entity |individual )?subscription agreement\b/im],
    ['subscription booklet', /^\s*subscription booklet\b/im],
    [
      'questionnaire',
      /^\s*(?:(?:Exhibit|Schedule|Annex|Appendix)\s+\S+\s*[-–—:]\s*)?(?:investor |entity )?(?:questionnaire|details|information|applicant election)\b/im,
    ],
  ];
  const role =
    roles
      .map(([role, pattern]) => ({ role, index: first.search(pattern) }))
      .filter((r) => r.index >= 0)
      .sort((a, b) => a.index - b.index)[0]?.role || 'supporting document';
  const version = first.match(/\b(?:Version|Draft)\s+([\d]+(?:\.\d+)*)\b/i)?.[1] || null;
  const closings = [
    ...text.matchAll(
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\s+closing\b/gi,
    ),
  ].map((m) => normalize(m[1]).replace(',', ''));
  const closing = [...new Set(closings)].length === 1 ? closings[0] : null;
  const fund = doc.fundScope || fundIdentity(text);
  const entity =
    "[A-Z][A-Za-z0-9&'’., -]{1,110}\\s+(?:LLC|L\\.L\\.C\\.|Inc\\.?|Ltd\\.?|Limited|L\\.?P\\.?)";
  const partyHeader = first
    .split('\n')
    .slice(0, 8)
    .map((line) => line.split('|')[0].trim())
    .find((line) => new RegExp(`^${entity}\\s*/\\s*${entity}$`, 'i').test(line));
  const context = {
    documentId: doc.id,
    role,
    fund: fund || null,
    contractParties: partyHeader ? partyHeader.split('/').map(normalize).sort().join(' / ') : null,
    declaredVersion: version,
    closing,
    incorporatedSubscription:
      /\b(?:forms? part of|accompanies|part of|accompany)\b[\s\S]{0,180}?(?:subscription agreement|agreement)/i.test(
        first,
      ),
    completeSubscriptionPackage:
      /\bthis\s+agreement\s+and\s+the\s+supplied\s+(?:schedules|attachments|documents)\s+form\s+the\s+complete\s+subscription\s+package\b/i.test(
        text,
      ),
  };
  cache.set(doc, context);
  return context;
}
export function sameIdentity(a, b) {
  return (
    Boolean(a.fund && b.fund && a.fund === b.fund) &&
    !(a.declaredVersion && b.declaredVersion && a.declaredVersion !== b.declaredVersion) &&
    !(a.closing && b.closing && a.closing !== b.closing)
  );
}
export function packageContext(documents, intakeContext) {
  const intake = normalizeIntakeContext(intakeContext),
    metadataIssues = [];
  const contexts = documents.map((doc) => {
      const derived = documentContext(doc),
        reviewer = intake.documents[doc.id];
      if (!reviewer) return { ...derived, status: 'current' };
      const state = sourceState(reviewer.source, documents),
        ownSource = reviewer.source.documentId === doc.id,
        effective = {
          ...derived,
          status: 'current',
          reviewerMetadata: reviewer,
          metadataSourceState: state,
          identityIssues: [],
        };
      const issue = (field, reason) => {
        const row = {
          documentId: doc.id,
          field,
          sourceValue: derived[field] || null,
          reviewerValue: reviewer[field],
          reason,
          sourceState: state,
        };
        metadataIssues.push(row);
        effective.identityIssues.push(row);
      };
      for (const field of ['fund', 'role', 'declaredVersion', 'closing']) {
        if (!reviewer[field]) continue;
        const supplied = normalize(reviewer[field]).replaceAll(',', ''),
          existing = derived[field] ? normalize(derived[field]).replaceAll(',', '') : null;
        if (existing === supplied) continue;
        const known = existing && !(field === 'role' && existing === 'supporting document');
        if (known && existing !== supplied) {
          issue(
            field,
            'Reviewer metadata disagrees with source-derived identity. Source identity remains in use; verify the original.',
          );
          continue;
        }
        if (known) continue;
        if (state.status !== 'current' || !ownSource) {
          issue(
            field,
            'A current citation to this document is required before using reviewer identity.',
          );
          continue;
        }
        const quote = normalize(reviewer.source.quote).replaceAll(',', '');
        const supported =
          field === 'declaredVersion'
            ? new RegExp(
                `\\bversion\\s+${supplied.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d.])`,
                'i',
              ).test(quote)
            : quote.includes(supplied);
        if (!supported) {
          issue(
            field,
            'The cited quote does not contain the supplied identity. Verify the source before using it for matching.',
          );
          continue;
        }
        effective[field] = field === 'closing' ? supplied : normalize(reviewer[field]);
      }
      if (state.status === 'current' && ownSource && !effective.identityIssues.length)
        effective.status = reviewer.status;
      else if (reviewer.status !== 'current')
        issue(
          'status',
          'A current citation to this document and consistent source identity are required before using the declared package status.',
        );
      return effective;
    }),
    relationships = [];
  for (const child of contexts) {
    if (
      !['statement of work', 'service level schedule', 'supporting document'].includes(
        child.role,
      ) ||
      child.status === 'superseded'
    )
      continue;
    const childDoc = documents.find((d) => d.id === child.documentId);
    const firstLine =
      childDoc.pages[0]?.text
        .split('\n')
        .find((line) => line.trim())
        ?.trim() || '';
    const attachment = [...firstLine.matchAll(attachmentPattern())][0];
    const title =
      attachment?.index === 0
        ? attachmentName(attachment)
        : childDoc.pages[0]?.text
            .split('\n')
            .find((line) => documentTitle(line))
            ?.trim();
    const candidates = contexts.filter(
      (parent) =>
        parent.role === 'master services agreement' &&
        parent.status !== 'superseded' &&
        parent.contractParties &&
        parent.contractParties === child.contractParties &&
        !(
          parent.declaredVersion &&
          child.declaredVersion &&
          parent.declaredVersion !== child.declaredVersion
        ) &&
        documents
          .find((d) => d.id === parent.documentId)
          .pages.some((p) =>
            /\bconstitute\s+the\s+supplied\s+contract\s+package\b/i.test(p.text),
          ) &&
        title &&
        documents
          .find((d) => d.id === parent.documentId)
          .pages.some((p) => normalize(p.text).includes(normalize(title))),
    );
    if (candidates.length === 1) {
      const parent = documents.find((d) => d.id === candidates[0].documentId);
      const page = parent.pages.find((p) =>
        /\bconstitute\s+the\s+supplied\s+contract\s+package\b/i.test(p.text),
      );
      relationships.push({
        kind: 'supplied services companion',
        from: child.documentId,
        to: parent.id,
        evidence: sourceSpan(
          parent,
          page,
          0,
          page.text.length,
          'Supplied services package declaration',
        ),
      });
    }
  }
  for (const child of contexts) {
    if (!['questionnaire', 'supporting document'].includes(child.role)) continue;
    const doc = documents.find((d) => d.id === child.documentId);
    const titleLine =
      doc.pages[0]?.text
        .split('\n')
        .find((line) => line.trim())
        ?.trim() || '';
    const label = [...titleLine.matchAll(attachmentPattern())][0];
    const companionTitle = label?.index === 0 ? attachmentName(label) : documentTitle(titleLine);
    const declaresCompanion = (parent) => {
      const text = documents
        .find((d) => d.id === parent.documentId)
        .pages.map((p) => p.text)
        .join('\n');
      return (
        parent.completeSubscriptionPackage &&
        companionTitle &&
        normalize(text).includes(normalize(companionTitle))
      );
    };
    const candidates = contexts.filter(
      (parent) =>
        parent.documentId !== child.documentId &&
        parent.status !== 'superseded' &&
        child.status !== 'superseded' &&
        ['subscription agreement', 'subscription booklet'].includes(parent.role) &&
        sameIdentity(child, parent) &&
        (child.incorporatedSubscription || declaresCompanion(parent)),
    );
    const page = doc.pages.find((p) =>
      /\b(?:forms? part of|accompanies|part of|accompany)\b[\s\S]{0,180}?(?:subscription agreement|agreement)/i.test(
        p.text,
      ),
    );
    if (candidates.length === 1 && (page || declaresCompanion(candidates[0]))) {
      const parentDoc = documents.find((d) => d.id === candidates[0].documentId);
      const declaration = parentDoc.pages.find((p) =>
        /complete\s+subscription\s+package/i.test(p.text),
      );
      relationships.push({
        kind: page
          ? 'incorporated subscription attachment'
          : 'explicitly supplied subscription companion',
        from: child.documentId,
        to: candidates[0].documentId,
        evidence: page
          ? sourceSpan(doc, page, 0, page.text.length, 'Document relationship')
          : sourceSpan(
              parentDoc,
              declaration,
              0,
              declaration.text.length,
              'Supplied package declaration',
            ),
      });
    }
  }
  for (const child of contexts) {
    const row = child.reviewerMetadata;
    if (!row?.parentDocumentId) continue;
    const parent = contexts.find((parent) => parent.documentId === row.parentDocumentId),
      doc = documents.find((doc) => doc.id === child.documentId);
    if (
      relationships.some((rel) => rel.from === child.documentId && rel.to !== row.parentDocumentId)
    ) {
      metadataIssues.push({
        documentId: child.documentId,
        field: 'parentDocumentId',
        reviewerValue: row.parentDocumentId,
        reason:
          'Reviewer parent link conflicts with the source-derived relationship. Verify the governing source.',
        sourceState: child.metadataSourceState,
      });
      continue;
    }
    const valid =
      parent &&
      child.status !== 'superseded' &&
      parent.status !== 'superseded' &&
      child.metadataSourceState.status === 'current' &&
      row.source.documentId === child.documentId &&
      !child.identityIssues.length &&
      !parent.identityIssues?.length &&
      sameIdentity(child, parent) &&
      ['subscription agreement', 'subscription booklet'].includes(parent.role);
    if (!valid) {
      metadataIssues.push({
        documentId: child.documentId,
        field: 'parentDocumentId',
        reviewerValue: row.parentDocumentId,
        reason:
          'Reviewer parent link requires a current child citation, compatible known fund/version/closing, and no identity disagreement. Verify this relationship.',
        sourceState: child.metadataSourceState,
      });
      continue;
    }
    if (relationships.some((rel) => rel.from === child.documentId && rel.to === parent.documentId))
      continue;
    const page = doc.pages.find((page) => String(page.number) === String(row.source.page)),
      start = page.text.indexOf(row.source.quote);
    relationships.push({
      kind: 'reviewer-linked subscription attachment',
      from: child.documentId,
      to: parent.documentId,
      humanContext: true,
      evidence: sourceSpan(
        doc,
        page,
        start,
        start + row.source.quote.length,
        'Reviewer document relationship',
      ),
    });
  }
  return {
    documents: contexts,
    relationships,
    metadataIssues,
    intakeContext: intake,
    applicability: intake.applicability.map((row) => ({
      ...row,
      sourceState: sourceState(row.source, documents),
      humanContext: true,
      use: 'Reviewer applicability context; does not suppress detected differences',
    })),
  };
}
export function linkedSubscriptions(context, a, b) {
  context = {
    ...context,
    relationships: context.relationships.filter((r) => r.kind !== 'supplied services companion'),
  };
  return (
    a === b ||
    context.relationships.some(
      (r) => (r.from === a && r.to === b) || (r.from === b && r.to === a),
    ) ||
    context.relationships.some(
      (r) => r.from === a && context.relationships.some((s) => s.from === b && s.to === r.to),
    )
  );
}
export function linkedServices(context, a, b) {
  if (a === b) return true;
  const relationships = context.relationships.filter(
    (r) => r.kind === 'supplied services companion',
  );
  return (
    relationships.some((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a)) ||
    relationships.some(
      (r) => r.from === a && relationships.some((s) => s.from === b && s.to === r.to),
    )
  );
}
