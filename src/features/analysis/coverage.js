export function coverageOf(doc) {
  const pages = doc.pages || [],
    checked = pages.filter(
      (p) => !p.status || p.status === 'searchable text' || p.status === 'likely blank',
    ).length;
  const gaps = pages.filter(
    (p) => p.visualGap || (p.status && !['searchable text', 'likely blank'].includes(p.status)),
  );
  const limitations = [...(doc.limitations || [])];
  return {
    status: doc.rejected
      ? 'rejected'
      : gaps.length || limitations.length
        ? 'partially analyzed'
        : 'fully analyzed',
    originalPages: doc.originalPageCount ?? pages.length,
    pagesChecked: checked,
    gaps: gaps.map((p) => ({
      page: p.number,
      status: p.visualGap && p.status === 'searchable text' ? 'image content unchecked' : p.status,
      reason: p.reason,
    })),
    limitations,
  };
}
export const supportedChecks =
  'Preflight checks readable text for references to sections, tables and attachments; required documents; party names and roles; deadlines and dates; definitions; amounts and currencies; form fields and versions; and contact details. It also flags known spelling errors, drafting placeholders, numbering issues and selected differences in legal and service terms. These automated checks follow fixed rules and recognize specific wording patterns. They can miss issues and require human review. “Text checked” means text was available to check, not that every issue was found.';
export const manualChecks =
  'Ambiguous signer roles, answer types and branches; other vague deadlines and affiliate scope; other contradictions, spelling and unrecognized wording; image text and complex reading order.';
export function packageCoverage(documents) {
  const files = documents.map((d) => ({ id: d.id, name: d.name, ...coverageOf(d) }));
  return {
    status: files.some((f) => f.status !== 'fully analyzed')
      ? 'incomplete'
      : 'readable text checked',
    files,
    pagesChecked: files.reduce((n, f) => n + f.pagesChecked, 0),
    pagesWithGaps: files.reduce((n, f) => n + f.gaps.length, 0),
    supported: supportedChecks,
    manualReview: manualChecks,
    unsupported: [
      'OCR is not performed',
      `Requires manual review: ${manualChecks}`,
      'Image text, legal interpretation, authenticity and exhaustive completeness are unsupported',
      'DOCX uses paragraphs; original pagination and some layout/footnotes may be unavailable',
    ],
  };
}
