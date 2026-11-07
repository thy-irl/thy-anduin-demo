import { blocksOf, normalize } from './structure.js';

const readable = (analysis, e) => {
  const file = analysis.coverage.files.find((d) => d.id === e.documentId);
  return file && !file.gaps.length && file.status !== 'rejected';
};
// Positive source evidence is required; an absent detector alone never resolves a finding.
export function correctionEvidence(f, analysis, documents) {
  if (!analysis || !documents) return [];
  if (f.subtype === 'Drafting placeholder') {
    const marker = f.title.match(/\[[^\]]+\]/)?.[0];
    if (!marker || f.evidence.length !== 1) return [];
    const old = f.evidence[0],
      doc = documents.find((d) => d.id === old.documentId);
    if (!doc || !readable(analysis, old) || doc.version <= old.documentVersion) return [];
    const text = normalize(old.text),
      at = text.indexOf(normalize(marker));
    if (at < 0) return [];
    const prefix = text.slice(Math.max(0, at - 100), at),
      suffix = text.slice(at + marker.length, at + marker.length + 100);
    if (prefix.trim().length < 12 || suffix.trim().length < 3) return [];
    const candidates = blocksOf(doc).filter(
      (b) => normalize(b.section) === normalize(old.section) && readable(analysis, b),
    );
    const replacements = candidates.filter((b) => {
      const current = normalize(b.text),
        start = current.indexOf(prefix);
      if (start < 0) return false;
      const end = current.indexOf(suffix, start + prefix.length);
      if (end < 0) return false;
      const value = current.slice(start + prefix.length, end).trim();
      return (
        value.length > 2 &&
        value.length < 200 &&
        !/[\[\]_{●•]/.test(value) &&
        !/\b(?:tbd|to be confirmed|to be completed)\b/.test(value)
      );
    });
    return replacements.length === 1 ? replacements : [];
  }
  if (f.type === 'Cross-document' && f.facts?.length === 2) {
    const current = analysis.facts.flatMap((d) => d.minimums),
      matches = [];
    for (const old of f.facts) {
      const candidates = current.filter(
        (n) =>
          n.evidence.documentId === old.evidence.documentId &&
          n.currency === old.currency &&
          n.contribution === old.contribution &&
          n.aggregate === old.aggregate &&
          normalize(n.evidence.section) === normalize(old.evidence.section) &&
          ['class', 'investor', 'closing', 'applicant', 'exception'].every(
            (k) => (n.scope[k] ?? null) === (old.scope[k] ?? null),
          ) &&
          readable(analysis, n.evidence),
      );
      if (candidates.length !== 1) return [];
      matches.push(candidates[0]);
    }
    return matches[0].amount === matches[1].amount ? matches.map((n) => n.evidence) : [];
  }
  return [];
}
