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
  'Explicit section, table and attachment references including annexure-scoped subsections; named attached/received documents and source-cited package requirements; explicit party roles with approved aliases; action-scoped funding and submission deadlines including day basis and time zones; self-reference numbering; known misspellings and approved vocabulary; explicit definition differences and duplicate entries; comparable minimums, currencies, percentages and evidence ages; configured labeled form fields and approved versions; contact details for matching purposes. Also checks drafting placeholders, calendar-date validity, repeated section numbers, written versus numeric amounts, unmeasured receipt/processing timing, selected governing-law and withdrawal differences, and explicit services-package operational terms. All rules are deterministic and syntax-limited.';
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
