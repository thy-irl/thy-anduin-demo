import { blocksOf, sourceSpan, normalize, sectionNumber, stableId } from './structure.js';
import { factsOf, scopeOf, disjoint } from './facts.js';
import { sameIdentity, linkedSubscriptions, linkedServices } from './context.js';
import { coverageOf } from './coverage.js';
import { writtenAmount } from './mechanical.js';
import { sourceState } from '../context/intake.js';

export const checkNames = {
  broken_reference: 'Reference target not found',
  missing_document: 'Document not found in package',
  party_name_mismatch: 'Party name differs across documents',
  deadline_mismatch: 'Different deadlines',
  suspect_reference: 'Possible wrong cross-reference',
  typo: 'Possible typo',
  definition_mismatch: 'Different definitions',
  duplicate_definition: 'Duplicate definition',
  value_mismatch: 'Different values',
  required_field_missing: 'Required field not found',
  contact_or_version_mismatch: 'Contact details differ',
};
export const definitionKey = (text) =>
  normalize(text)
    .replace(/[“”"‘’]/g, '')
    .replace(/[.!;]+$/g, '')
    .trim();
const key = (text) => definitionKey(text).replace(/[.,:]/g, '').replace(/\s+/g, ' ').trim();
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasGap = (doc) =>
  doc.rejected ||
  !doc.pages.length ||
  coverageOf(doc).gaps.length > 0 ||
  (doc.limitations || []).some(
    (l) =>
      l !==
      'DOCX citations are XML paragraphs/segments, not original pages; page layout is not reconstructed.',
  );
const uniqueEvidence = (evidence) => [
  ...new Map(
    evidence.map((e) => [`${e.documentId}:${e.page}:${e.span.start}:${e.span.end}`, e]),
  ).values(),
];
const n = (text) => (/^\d+$/.test(text) ? Number(text) : writtenAmount(text));
const exceptions =
  /\b(?:notwithstanding|except|unless|waived|supersedes?|replaces?|prevails?|extension (?:is|has been) (?:granted|approved))\b/i;
const clockPattern = () =>
  /\b(\d{1,2})(?::(\d{2}))?\s*([aApP]\.?[mM]\.?)\s*((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+time)|(?:UTC|GMT)(?:[+-]\d{1,2}(?::\d{2})?)?|[A-Z]{2,5})?|\b(\d{1,2}):(\d{2})\s*((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+time)|(?:UTC|GMT)(?:[+-]\d{1,2}(?::\d{2})?)?|[A-Z]{2,5})?/g;

// Check status is independent of the existing human review disposition.
export function preflightMetadata(f) {
  const checkId =
    f.checkId ||
    (f.type === 'Broken reference'
      ? 'broken_reference'
      : f.type === 'Missing attachment'
        ? /^Schedule\b/.test(f.target || '')
          ? 'broken_reference'
          : 'missing_document'
        : f.type === 'Cross-document'
          ? 'value_mismatch'
          : f.type === 'Defined term' && /^Inconsistent definition/.test(f.title)
            ? 'definition_mismatch'
            : f.subtype === 'Funding deadline'
              ? 'deadline_mismatch'
              : f.subtype === 'Party name variation'
                ? 'party_name_mismatch'
                : f.subtype === 'Spelling'
                  ? 'typo'
                  : null);
  if (!checkId) return f;
  const unverified = ['ambiguous target', 'insufficient extraction coverage'].includes(
    f.classification,
  );
  const detectionStatus =
    f.detectionStatus ||
    (unverified
      ? 'not_verified'
      : [
            'broken_reference',
            'missing_document',
            'required_field_missing',
            'duplicate_definition',
          ].includes(checkId)
        ? 'detected'
        : 'needs_review');
  return {
    ...f,
    checkId,
    checkTitle: f.checkTitle || checkNames[checkId],
    detectionStatus,
    ...(unverified ? { verificationReason: f.verificationReason || f.classification } : {}),
  };
}

function recordsOf(doc) {
  const records = [],
    blocks = blocksOf(doc);
  let inherited = {};
  let governing;
  for (const page of doc.pages) {
    if (/OCR required|extraction error|unreadable/i.test(page.status || '')) continue;
    for (const m of page.text.matchAll(/[^\n]+/g)) {
      const text = m[0],
        block = blocks.find(
          (b) => b.page === page.number && b.span.start <= m.index && b.span.end > m.index,
        );
      if (block?.kind === 'table of contents') continue;
      if (block?.sectionScope !== governing) {
        inherited = {};
        governing = block?.sectionScope;
      }
      if (
        /^\s*(?:For\s+(?:Class\s+\w+|individual|entity).*\bonly\b|(?:Individual|Entity)\s+(?:Form|Questionnaire))/i.test(
          text,
        )
      )
        inherited = localScope(text);
      records.push({
        doc,
        text,
        page,
        start: m.index,
        block,
        scope: {
          ...inherited,
          ...Object.fromEntries(
            Object.entries(localScope(text)).filter(([, v]) => v != null && v !== false),
          ),
        },
        evidence: sourceSpan(
          doc,
          page,
          block?.span.start ?? m.index,
          block?.span.end ?? m.index + text.length,
          block?.section,
        ),
      });
    }
  }
  return records;
}
function localScope(text) {
  const result = scopeOf(text),
    classes = [...text.matchAll(/\bClass\s+(\w+)\b/gi)];
  if (classes.length === 1) result.class = classes[0][1].toUpperCase();
  result.investor ||=
    text
      .match(/\b(individual|entity)\s+(?:forms?|questionnaires?|investors?|applicants?)\b/i)?.[1]
      ?.toLowerCase() || null;
  return result;
}

export function preflightChecks(documents, context) {
  const checks = [],
    checkResults = [],
    identities = new Map(context.documents.map((d) => [d.documentId, d]));
  const records = documents.flatMap(recordsOf),
    rules = context.intakeContext.requirements;
  const usable = rules.filter(
    (r) => r.relationship === 'attached' && sourceState(r.source, documents).status === 'current',
  );
  const shared = (a, b) => {
    if (disjoint(a.scope || {}, b.scope || {})) return false;
    if (a.doc.id === b.doc.id)
      return (a.block?.sectionScope || a.doc.id) === (b.block?.sectionScope || b.doc.id);
    return (
      sameIdentity(identities.get(a.doc.id), identities.get(b.doc.id)) ||
      linkedSubscriptions(context, a.doc.id, b.doc.id) ||
      linkedServices(context, a.doc.id, b.doc.id)
    );
  };
  const add = (checkId, subject, evidence, description, question, identity, extra = {}) => {
    const detectionStatus =
      extra.detectionStatus ||
      ([
        'broken_reference',
        'missing_document',
        'required_field_missing',
        'duplicate_definition',
      ].includes(checkId)
        ? 'detected'
        : 'needs_review');
    checks.push({
      type: 'Preflight',
      category: ['broken_reference', 'missing_document', 'required_field_missing'].includes(checkId)
        ? 'Missing reference'
        : ['typo', 'suspect_reference', 'duplicate_definition'].includes(checkId)
          ? 'Drafting'
          : 'Contradiction',
      subtype: checkNames[checkId],
      checkId,
      checkTitle: `${checkNames[checkId]}${subject ? ` — ${subject}` : ''}`,
      title: `${checkNames[checkId]}${subject ? ` — ${subject}` : ''}`,
      severity:
        detectionStatus === 'detected' && checkId === 'missing_document'
          ? 'blocking'
          : checkId === 'typo'
            ? 'advisory'
            : 'review',
      detectionStatus,
      evidence: uniqueEvidence(evidence),
      description,
      question,
      identity: `${checkId}:${identity}`,
      impact: question,
      certainty:
        detectionStatus === 'not_verified'
          ? 'Not verified'
          : 'Deterministic text rule; review applicability',
      ...extra,
    });
  };
  const cite = (rule) => {
    const d = documents.find((d) => d.id === rule.source.documentId),
      p = d?.pages.find((p) => String(p.number) === String(rule.source.page));
    if (!p || !rule.source.quote || !p.text.includes(rule.source.quote)) return null;
    const start = p.text.indexOf(rule.source.quote);
    return sourceSpan(d, p, start, start + rule.source.quote.length, 'Configured requirement');
  };
  const unverified = (rule, checkId, reason) =>
    checkResults.push({
      checkId,
      requirementId: rule.id,
      status: 'not_verified',
      reason,
      target: rule.label,
      evidence: [cite(rule)].filter(Boolean),
      nextAction:
        'Verify the current requirement citation and inspect the identified original form.',
    });
  for (const rule of rules.filter(
    (r) =>
      r.relationship === 'attached' &&
      ['alias', 'vocabulary'].includes(r.check) &&
      !usable.includes(r),
  ))
    unverified(
      rule,
      rule.check === 'alias' ? 'party_name_mismatch' : 'typo',
      `Approval configuration is not in use: ${sourceState(rule.source, documents).reason}`,
    );

  // Comparisons form complete-link groups: an unspecified scope cannot bridge two
  // explicit classes or investor categories into the same issue.
  const compare = (items, checkId, title, question, match = () => true) => {
    const groups = [];
    for (const item of [...items].sort((a, b) =>
      `${a.doc.id}:${a.evidence.page}:${a.evidence.span.start}`.localeCompare(
        `${b.doc.id}:${b.evidence.page}:${b.evidence.span.start}`,
      ),
    )) {
      const group = groups.find((g) =>
        g.every((other) => other.field === item.field && shared(other, item) && match(other, item)),
      );
      if (group) group.push(item);
      else groups.push([item]);
    }
    for (const group of groups) {
      if (new Set(group.map((i) => i.value)).size < 2) continue;
      const first = group[0],
        values = [...new Set(group.map((i) => i.display || i.value))];
      add(
        checkId,
        title(first),
        group.map((i) => i.evidence),
        `${values.join(' versus ')}. The cited text differs within a comparable scope; legal effect and applicability require review.`,
        question(first, values),
        `${first.field}:${group
          .map((i) => `${i.doc.id}:${i.block?.governing || ''}:${JSON.stringify(i.scope)}`)
          .sort()
          .join('|')}`,
        { comparisonValues: values },
      );
    }
  };

  // Numbered targets are indexed with their containing attachment. Number 3 in
  // Annexure A cannot satisfy a reference to Annexure B §3.
  for (const doc of documents) {
    const blocks = blocksOf(doc),
      headings = blocks.filter((b) => b.kind === 'heading');
    const local = records.filter((r) => r.doc === doc);
    for (const r of local) {
      const compound =
        /\b(Annexure|Annex|Schedule|Appendix|Exhibit)\s+([A-Z0-9]+)\s*(?:(?:[,;:]\s*)?(?:§|sections?|subsections?|paragraphs?)\s*)(\d+(?:\.\d+)*)/gi;
      for (const m of r.text.matchAll(compound)) {
        const name = `${m[1]} ${m[2]}`,
          target = `${name} §${m[3]}`;
        const named = (b) => new RegExp(`^${esc(name)}(?:\\s|[—–:-]|$)`, 'i').test(b.section);
        let targetDocuments = [doc];
        if (!blocks.some(named))
          targetDocuments = documents.filter(
            (d) => d.id !== doc.id && shared(r, { doc: d, scope: {} }) && blocksOf(d).some(named),
          );
        const targets = targetDocuments.flatMap((d) => {
          const body = blocksOf(d),
            scopes = new Set(body.filter(named).map((b) => b.sectionScope));
          return body.filter((b) => scopes.has(b.sectionScope)).map((b) => ({ doc: d, block: b }));
        });
        const scopes = new Set(targets.map((t) => `${t.doc.id}:${t.block.sectionScope}`));
        const targetHeadings = targets
          .filter((t) => t.block.kind === 'heading')
          .map((t) => t.block);
        const found = targetHeadings.filter((b) => sectionNumber(b.text) === m[3]);
        if (found.length === 1 && scopes.size === 1) continue;
        const reason =
          hasGap(doc) || targetDocuments.some(hasGap)
            ? 'Incomplete text coverage; inspect unreadable content.'
            : scopes.size > 1 || found.length > 1
              ? 'The named attachment target is ambiguous.'
              : null;
        const available = targetHeadings.map((b) => sectionNumber(b.text)).filter(Boolean);
        add(
          'broken_reference',
          target,
          [r.evidence, ...targetHeadings],
          `“${m[0]}” is cited; ${name} has ${available.length ? `only §${available.join(', §')} in the checked text` : 'no established subsection headings'}.`,
          `Which provision should ${target} identify? Supply the target or correct the reference.`,
          `${doc.id}:${r.block?.governing}:${target}`,
          {
            target,
            ...(reason ? { detectionStatus: 'not_verified', verificationReason: reason } : {}),
          },
        );
      }
      for (const m of r.text.matchAll(
        /\bthis\s+(?:paragraph|section|clause)\s+(\d+(?:\.\d+)*)/gi,
      )) {
        const enclosing = sectionNumber(r.block?.section || '');
        if (!enclosing || m[1] === enclosing || enclosing.startsWith(`${m[1]}.`)) continue;
        add(
          'suspect_reference',
          `§${m[1]}`,
          [r.evidence],
          `“${m[0]}” appears inside §${enclosing} (${r.block.section}).`,
          `Should “${m[0]}” refer to the enclosing §${enclosing}?`,
          `${doc.id}:${r.block?.sectionScope}:${enclosing}:${m[1]}`,
        );
      }
      // Dotted Section references continue through the existing reference mapper.
      for (const m of r.text.matchAll(
        /(?:\b(Section|Table)\s+(\d+(?:\.\d+)*)|§\s*(\d+(?:\.\d+)*))/gi,
      )) {
        const kind = m[1] || 'Section',
          number = m[2] || m[3];
        if (m[1]?.toLowerCase() === 'section' && number.includes('.')) continue;
        const before = r.text.slice(0, m.index),
          after = r.text.slice(m.index + m[0].length);
        if (
          /(?:Annexure|Annex|Schedule|Exhibit|Appendix)\s+[A-Z0-9]+\s*[,;:]?\s*$/i.test(before) ||
          /this\s+(?:paragraph|section|clause)\s*$/i.test(before)
        )
          continue;
        if (
          /\b(?:Treasury|Regulations?|Code|U\.S\.C\.)\s*$/i.test(before) ||
          /^\s+(?:of|under|in)\s+(?:the\s+)?(?!this\b)/i.test(after)
        )
          continue;
        if (
          m.index === 0 &&
          (r.block?.kind === 'heading' || new RegExp(`^${esc(m[0])}\\s*[-–—:]`).test(r.text))
        )
          continue;
        const target = `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} ${number}`;
        const found = /^table$/i.test(kind)
          ? local.some((x) =>
              new RegExp(`^\\s*Table\\s+${esc(number)}\\b(?:\\s*[-–—:]|\\s+[A-Z])`).test(x.text),
            )
          : headings.some(
              (b) => sectionNumber(b.text) === number && b.sectionScope === r.block?.sectionScope,
            );
        if (found) continue;
        add(
          'broken_reference',
          target,
          [r.evidence],
          `“${m[0]}” has no matching target in the identified document scope.`,
          `Which provision should ${target} identify?`,
          `${doc.id}:${r.block?.sectionScope}:${target}`,
          {
            target,
            ...(hasGap(doc)
              ? {
                  detectionStatus: 'not_verified',
                  verificationReason: 'Incomplete text coverage; inspect unreadable content.',
                }
              : {}),
          },
        );
      }
    }
  }

  const titleKey = (text) => key(text).replace(/\.(?:pdf|txt|docx)$/i, '');
  const titleMatches = (title, r) =>
    titleKey(
      r.text.replace(/^\s*(?:\d+(?:\.\d+)*[.)]?\s+|(?:Annexure|Appendix)\s+\w+\s*[-—–:]\s*)/i, ''),
    ) === titleKey(title);
  const findDocument = (title, origin, rule) =>
    documents.filter((d) => {
      if (origin && d.id !== origin.doc.id) {
        const a = identities.get(origin.doc.id),
          b = identities.get(d.id);
        if (
          (a.fund && b.fund && a.fund !== b.fund) ||
          disjoint(origin.scope, localScope(d.pages.map((p) => p.text).join('\n')))
        )
          return false;
      }
      if (rule?.documentId && d.id !== rule.documentId) return false;
      const names = [title, ...(rule?.aliases || [])];
      return names.some((name) => {
        const headings = records.filter((r) => r.doc === d && titleMatches(name, r));
        const filename = titleKey(d.name) === titleKey(name);
        return (
          (filename || headings.length) &&
          records.some(
            (r) =>
              r.doc === d &&
              !titleMatches(name, r) &&
              r.text.trim().length > 20 &&
              !/^\s*(?:table of )?contents\b|\.{3,}/i.test(r.text),
          )
        );
      });
    });
  const missingDoc = (title, evidence, origin, identity, rule) => {
    const matches = findDocument(title, origin, rule);
    if (matches.length === 1) return;
    const uncertain = documents.some(hasGap) || matches.length > 1;
    add(
      'missing_document',
      title,
      evidence,
      matches.length > 1
        ? `Multiple supplied documents match ${title}; its applicable version is not verified.`
        : `${title} not found in the uploaded package as a document or identifiable embedded section. Searched current uploaded filenames and substantive section headings.`,
      matches.length > 1
        ? `Which supplied ${title} version applies to this requirement?`
        : `Please provide ${title} or identify its embedded section.`,
      identity,
      {
        target: title,
        searchedFor: title,
        ...(rule ? { requirementIds: [rule.id] } : {}),
        ...(uncertain
          ? {
              detectionStatus: 'not_verified',
              verificationReason:
                matches.length > 1
                  ? 'Multiple supplied documents match the named target; identify the applicable version.'
                  : 'Incomplete package coverage; an unreadable page may contain the required document.',
            }
          : {}),
      },
    );
  };
  const namedIdentity = (r, title) => {
    const identity = identities.get(r.doc.id);
    return `${identity.fund ? `${identity.fund}:${identity.declaredVersion || ''}:${identity.closing || ''}` : r.doc.id}:${JSON.stringify(r.scope)}:${key(title)}`;
  };
  for (const r of records) {
    for (const m of r.text.matchAll(
      /\b(?:receipt\s+of|received|attached|enclosed)\s+(?:a\s+copy\s+of\s+)?(?:the\s+|an?\s+)?([A-Z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*){0,9}\s+(?:Document|Appendix|Memorandum|Certificate|Agreement|Form|Checklist))\b/g,
    )) {
      if (/^(?:Schedule|Exhibit|Annexure|Annex|Appendix)\s+[A-Z0-9]+\b/i.test(m[1])) continue;
      missingDoc(m[1], [r.evidence], r, namedIdentity(r, m[1]));
    }
    for (const m of r.text.matchAll(
      /\b([A-Z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*){0,8}\s+(?:Document|Appendix|Memorandum|Certificate|Agreement|Form))\s+(?:is\s+)?(?:attached|enclosed|has\s+been\s+received)\b/g,
    ))
      missingDoc(m[1], [r.evidence], r, namedIdentity(r, m[1]));
    for (const m of r.text.matchAll(
      /\b(?:requires?|must\s+(?:include|provide|supply))\s+(?:a\s+|the\s+)?((?:[Pp]ortfolio\s+)?(?:Explanatory Appendix|Key Investor Information Document|[A-Z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*){0,7}\s+(?:Document|Appendix|Certificate|Form)))\b/g,
    ))
      missingDoc(m[1], [r.evidence], r, namedIdentity(r, m[1]));
  }

  const approvedWords = new Set(
    usable.filter((r) => r.check === 'vocabulary').map((r) => key(r.label)),
  );
  const aliases = usable.filter((r) => r.check === 'alias');
  const partyKey = (name, role) => {
    const approved = aliases.find(
      (r) => (!r.partyRole || key(r.partyRole) === role) && key(r.label) === key(name),
    );
    return key(approved?.canonicalName || name);
  };
  const parties = [],
    deadlines = [],
    values = [],
    contacts = [];
  for (const r of records) {
    for (const [wrong, right] of [
      ['Invetsor', 'Investor'],
      ['FACTA', 'FATCA'],
      ['recieve', 'receive'],
      ['subscrption', 'subscription'],
    ]) {
      if (approvedWords.has(key(wrong)) || aliases.some((a) => key(a.label) === key(wrong)))
        continue;
      for (const m of r.text.matchAll(new RegExp(`\\b${wrong}\\b`, 'gi')))
        add(
          'typo',
          `“${m[0]}” → “${right}”`,
          [r.evidence],
          `The known misspelling “${m[0]}” may mean “${right}”.`,
          `Should “${m[0]}” be corrected to “${right}”?`,
          `${r.doc.id}:${key(wrong)}`,
          { suggestion: right },
        );
    }
    // Explicit role assignments only; string similarity alone never establishes a party.
    const rolePattern =
      /\b(Portfolio Manager|Investment Manager|Administrator|Custodian|General Partner)\s*(?::|is\s+|shall\s+be\s+|[-–—]\s*)([^;\n]+?(?:Limited|Ltd\.?|LLC|L\.L\.C\.|Inc\.?|L\.?P\.?))(?=\s*\(?[“"]|[.;,]|\s*$)/gi;
    for (const m of r.text.matchAll(rolePattern))
      parties.push({ ...r, field: key(m[1]), value: partyKey(m[2], key(m[1])), display: m[2] });
    for (const m of r.text.matchAll(
      /\b([A-Z][A-Za-z&()'’., -]{2,130}?(?:Limited|Ltd\.?|LLC|Inc\.?|L\.?P\.?))\s*(?:\(\s*(?:the\s+)?[“"]?(Portfolio Manager|Investment Manager|Administrator|Custodian|General Partner)[”"]?\s*\)|(?:acts|serves)\s+as\s+(?:the\s+)?(Portfolio Manager|Investment Manager|Administrator|Custodian|General Partner))/g,
    )) {
      const role = key(m[2] || m[3]);
      parties.push({ ...r, field: role, value: partyKey(m[1], role), display: m[1] });
    }
    const age = r.text.match(
      /\b(?:within|no\s+older\s+than|up\s+to|not\s+more\s+than)\s+(\d+|one|two|three|four|five|six|twelve)\s+(months?|days?|years?)\b/i,
    );
    if (age && /proof\s+of\s+address|address\s+(?:evidence|verification)/i.test(r.text)) {
      const unit = age[2].toLowerCase().replace(/s$/, '');
      values.push({
        ...r,
        field: 'proof of address age',
        value: `${unit === 'year' ? n(age[1]) * 12 : n(age[1])} ${unit === 'year' ? 'month' : unit}`,
        display: age[0],
      });
    }
    for (const m of r.text.matchAll(
      /\b(ownership\s+(?:percentage|threshold)|(?:minimum|maximum)\s+(?:subscription|investment|commitment|holding)|management\s+fee|performance\s+fee)\s*(?:amount\s*)?(?:(?:is|of|shall\s+be)\s*)?:?\s*(USD\s*\$?|US\$|\$|EUR\s*€?|€|GBP\s*£?|£)?\s*(\d[\d,]*(?:\.\d+)?)\s*(%|percent)?/gi,
    )) {
      const currency = m[2]
        ? /EUR|€/.test(m[2])
          ? 'EUR'
          : /GBP|£/.test(m[2])
            ? 'GBP'
            : 'USD'
        : null;
      if (!currency && !m[4]) continue;
      values.push({
        ...r,
        field: key(m[1]),
        value: `${currency || '%'} ${Number(m[3].replaceAll(',', ''))}`,
        display: m[0],
      });
    }
    const contact = r.text.match(
      /\b(send\s+KYC\s+originals\s+to\s+(?:the\s+)?administrator|courier\s+(?:delivery\s+)?address|general\s+correspondence\s+address)\s*(?:at\s*)?:?\s*(.+)/i,
    );
    if (contact)
      contacts.push({ ...r, field: key(contact[1]), value: key(contact[2]), display: contact[2] });
    for (const m of r.text.matchAll(
      /\b((?:KYC|subscription|funding)\s+(?:contact|email))\s*:\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/gi,
    ))
      contacts.push({ ...r, field: key(m[1]), value: key(m[2]), display: m[2] });
  }
  // A PDF line break is not a clause boundary. Match full source blocks and
  // split sentences while preserving dotted clock times; quotations stay exact.
  for (const doc of documents)
    for (const block of blocksOf(doc)) {
      if (block.kind === 'table of contents') continue;
      const record = records.find(
        (r) =>
          r.doc === doc &&
          r.page.number === block.page &&
          r.start >= block.span.start &&
          r.start < block.span.end,
      );
      if (!record) continue;
      const sentences = block.text
        .replace(/\b[ap]\.m\./gi, (m) => m.replaceAll('.', '·'))
        .split(/(?<=[.!?;])\s+(?=[A-Z])/);
      for (const raw of sentences) {
        const text = raw.replaceAll('·', '.').replace(/\s+/g, ' ');
        if (exceptions.test(block.text)) continue;
        const action = /\b(?:funding|funds|fund|pay|remit)\b/i.test(text)
          ? 'funding'
          : /\b(?:applications?|forms?|submit|submission)\b/i.test(text)
            ? 'submission'
            : null;
        if (!action || !/\b(?:due|must|shall|by|deadline)\b/i.test(text)) continue;
        const temporal =
          text.match(
            /\b(?:within|by|on|no\s+later\s+than)\s+(?:the\s+)?(?:last\s+Business\s+Day\s+before\s+(?:the\s+)?Closing\s+Date|Closing\s+Date|[^;\n]{1,130}?(?:Closing\s+Date|closing|acceptance(?:\s+notice)?|capital\s+call\s+notice))\b/i,
          ) ||
          text.match(
            /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:Business|calendar)\s+)?days?\s+(?:before|after)\s+(?:the\s+)?(?:Closing\s+Date|closing)\b/i,
          ) ||
          text.match(
            /\b(?:by|on)\s+(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
          );
        const clock = [...text.matchAll(clockPattern())][0];
        if (!temporal && !clock) continue;
        let timing = temporal?.[0] || '';
        if (clock) timing = timing.replace(clock[0], '');
        let value = normalize(timing)
          .replace(/\b(?:the|on|by|no later than)\b/g, '')
          .replace(/\bclosing date\b/g, 'closing')
          .replace(/\s+/g, ' ')
          .trim();
        value = value.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (w) =>
          String(n(w)),
        );
        value = value
          .replace(/\blast business day before\b/g, '1 business day before')
          .replace(/\bdays\b/g, 'day');
        if (clock) {
          let hour = Number(clock[1] || clock[5]),
            minute = Number(clock[2] || clock[6] || 0);
          if (clock[3]) hour = (hour % 12) + (/^p/i.test(clock[3]) ? 12 : 0);
          value += ` at ${hour}:${String(minute).padStart(2, '0')} ${key(clock[4] || clock[7] || 'zone unspecified')}`;
        }
        const anchor = /capital call/i.test(value)
          ? 'capital call'
          : /acceptance/i.test(value)
            ? 'acceptance'
            : /closing/i.test(value)
              ? 'closing'
              : 'date';
        const object = text.match(/\b(?:fund|pay|remit)\s+(.+?)\s+(?:within|by|on)\b/i)?.[1];
        deadlines.push({
          ...record,
          block,
          scope: {
            ...record.scope,
            ...Object.fromEntries(
              Object.entries(localScope(text)).filter(([, v]) => v != null && v !== false),
            ),
          },
          evidence: block,
          field: action,
          value,
          display: [temporal?.[0], clock && !temporal?.[0].includes(clock[0]) ? clock[0] : null]
            .filter(Boolean)
            .join('; '),
          anchor,
          object: object ? key(object) : null,
        });
      }
    }
  compare(
    parties,
    'party_name_mismatch',
    (r) => r.field,
    () => 'Which legal name should be used?',
  );
  compare(
    deadlines,
    'deadline_mismatch',
    (r) => r.field,
    (r, v) =>
      `Which deadline applies for ${r.field}: ${v.join(' or ')}? Confirm the anchor event, day basis and time zone.`,
    (a, b) => a.anchor === b.anchor && (!a.object || !b.object || a.object === b.object),
  );
  compare(
    values.filter((r) => !exceptions.test(r.text)),
    'value_mismatch',
    (r) => r.field,
    (r, v) => `Which value applies for ${r.field}: ${v.join(' or ')}?`,
  );
  compare(
    contacts,
    'contact_or_version_mismatch',
    (r) => r.field,
    (r, v) => `Which contact details should be used for ${r.field}: ${v.join(' or ')}?`,
  );

  const definitions = documents.flatMap((doc) =>
    factsOf(doc, identities.get(doc.id))
      .definitions.filter((f) => f.kind !== 'inline designation')
      .map((f) => {
        const r = records.find(
          (r) =>
            r.doc === doc &&
            r.page.number === f.evidence.page &&
            r.start <= f.evidence.span.start &&
            r.start + r.text.length >= f.evidence.span.start,
        ) || { doc, scope: f.scope };
        return {
          ...r,
          field: f.term,
          display: f.display,
          value: definitionKey(f.meaning),
          evidence: f.evidence,
          meaning: f.meaning,
          agreement: f.agreement,
        };
      }),
  );
  compare(
    definitions,
    'definition_mismatch',
    (r) => r.display,
    (r) => `Which definition of “${r.display}” applies to this scope?`,
    (a, b) => !(a.agreement && b.agreement && a.agreement !== b.agreement),
  );
  const glossaryGroups = new Map();
  for (const d of definitions) {
    const id = `${d.doc.id}:${d.block?.sectionScope || d.doc.id}:${d.block?.headingPath?.[0] || ''}:${d.field}`;
    const group = glossaryGroups.get(id) || [];
    group.push(d);
    glossaryGroups.set(id, group);
  }
  for (const [id, group] of glossaryGroups)
    if (
      group.length > 1 &&
      new Set(group.map((d) => d.value)).size === 1 &&
      !checks.some(
        (c) =>
          c.checkId === 'definition_mismatch' &&
          c.evidence.some((e) =>
            group.some(
              (d) =>
                e.documentId === d.evidence.documentId &&
                e.page === d.evidence.page &&
                e.span.start === d.evidence.span.start,
            ),
          ),
      )
    )
      add(
        'duplicate_definition',
        group[0].display,
        group.map((d) => d.evidence),
        `“${group[0].display}” has repeated identical explicit definition entries in the same glossary scope.`,
        `Should the duplicate definition of “${group[0].display}” be removed?`,
        id,
      );

  for (const rule of rules.filter(
    (r) => r.relationship === 'attached' && !['alias', 'vocabulary'].includes(r.check),
  )) {
    const checkId =
      rule.check === 'field'
        ? 'required_field_missing'
        : rule.check === 'version'
          ? 'contact_or_version_mismatch'
          : 'missing_document';
    if (!usable.includes(rule)) {
      unverified(rule, checkId, sourceState(rule.source, documents).reason);
      continue;
    }
    const evidence = [cite(rule)];
    if (rule.check === 'document') {
      missingDoc(rule.label, evidence, null, `requirement:${rule.id}`, rule);
      continue;
    }
    const target = documents.find((d) => d.id === rule.documentId);
    if (!target) {
      unverified(rule, checkId, 'The configured target form is not supplied.');
      continue;
    }
    const targetRecords = records.filter((r) => r.doc === target);
    const expectedScope = {
      class: rule.shareClass?.toUpperCase() || null,
      investor: rule.investorType?.toLowerCase() || null,
    };
    if (disjoint(expectedScope, localScope(target.pages.map((p) => p.text).join('\n')))) {
      unverified(rule, checkId, 'The identified form has a different class or investor scope.');
      continue;
    }
    if (rule.check === 'field') {
      // Only label-shaped prompts count. A narrative mention in instructions
      // does not establish that the form collects the disclosure.
      const present = targetRecords.some((r) =>
        [rule.label, ...rule.aliases].some((label) =>
          new RegExp(`(?:^|[☐□?;])\\s*${esc(label)}\\s*(?::|[?☐□]|_{2,}|\\[\\s*\\]|$)`, 'i').test(
            r.text.trim(),
          ),
        ),
      );
      if (present) continue;
      if (hasGap(target)) {
        unverified(
          rule,
          checkId,
          'The form has incomplete readable text; inspect the original for the required field.',
        );
        continue;
      }
      if (!targetRecords.length) {
        unverified(rule, checkId, 'The form has no readable text.');
        continue;
      }
      add(
        checkId,
        rule.label,
        [...evidence, targetRecords[0].evidence],
        `No labeled prompt for “${rule.label}” (or configured aliases) was found in ${target.name}. The cited requirement applies to this identified form.`,
        `Should ${target.name} include a field for “${rule.label}”?`,
        `requirement:${rule.id}`,
        { target: rule.label, searchedFor: rule.label, checkedDocumentId: target.id },
      );
    } else {
      const version = targetRecords
        .map((r) => ({ r, m: r.text.match(/\b(?:version|revision|edition)\s*:?\s*(.+?)\s*$/i) }))
        .find((x) => x.m);
      if (!rule.expectedVersion || !version || hasGap(target)) {
        unverified(
          rule,
          checkId,
          'An approved version and a readable explicit version label are required. Document dates alone do not establish versions.',
        );
        continue;
      }
      if (key(version.m[1]) === key(rule.expectedVersion)) continue;
      add(
        checkId,
        rule.label,
        [...evidence, version.r.evidence],
        `The approved version is ${rule.expectedVersion}; ${target.name} is explicitly labeled ${version.m[1]}.`,
        `Should ${target.name} be replaced with the approved ${rule.expectedVersion} version?`,
        `requirement:${rule.id}`,
        {
          title: `Unexpected document version — ${rule.label}`,
          checkTitle: 'Unexpected document version',
        },
      );
    }
  }
  return { checks, checkResults };
}

// Reuse existing detector identities and subtype metadata when both rules found
// the same issue. This preserves local review history and report links.
export function integratePreflight(findings, checks) {
  const result = findings.map(preflightMetadata);
  const overlap = (a, b) =>
    a.evidence.some((e) =>
      b.evidence.some(
        (x) =>
          x.documentId === e.documentId &&
          x.page === e.page &&
          x.span.start < e.span.end &&
          e.span.start < x.span.end,
      ),
    );
  for (const candidate of checks) {
    const current = result.find(
      (f) =>
        f.checkId === candidate.checkId &&
        (f.type === 'Preflight'
          ? f.identity === candidate.identity ||
            (f.checkId === 'missing_document' && key(f.target) === key(candidate.target))
          : f.target && candidate.target
            ? key(f.target) === key(candidate.target)
            : overlap(f, candidate)) &&
        overlap(f, candidate),
    );
    if (current) {
      current.evidence = uniqueEvidence([...current.evidence, ...candidate.evidence]);
      if (candidate.requirementIds)
        current.requirementIds = [
          ...new Set([...(current.requirementIds || []), ...candidate.requirementIds]),
        ];
      // Detailed existing minimum/deadline facts remain available to the UI.
      if (candidate.comparisonValues) current.comparisonValues = candidate.comparisonValues;
      continue;
    }
    const id = stableId(`Preflight:${candidate.identity}`),
      prior = result.find((f) => f.id === id);
    if (prior) {
      prior.evidence = uniqueEvidence([...prior.evidence, ...candidate.evidence]);
      if (candidate.requirementIds)
        prior.requirementIds = [
          ...new Set([...(prior.requirementIds || []), ...candidate.requirementIds]),
        ];
      continue;
    }
    result.push({
      ...candidate,
      id,
      status: 'open',
      note: '',
      evidenceVersion: 2,
      rule: `Deterministic ${candidate.checkId} text rule; no model call`,
      uncertainty: candidate.verificationReason || 'Applicability requires reviewer confirmation',
    });
  }
  return result;
}
