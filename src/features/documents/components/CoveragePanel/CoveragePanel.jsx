import React from 'react';

export function CoveragePanel({ analysis, expanded, onOpen }) {
  const c = analysis.coverage;
  return (
    <section className="coverage-panel">
      <h2>Coverage</h2>
      <p>
        {c.pagesChecked} pages / paragraphs checked · {c.pagesWithGaps} pages with gaps. Scanned
        image text is not read automatically.
      </p>
      {c.files.map((f) => (
        <details key={`${f.id}-${expanded}`} open={expanded && f.status !== 'fully analyzed'}>
          <summary>
            {f.name} · Text checked: {f.pagesChecked}/{f.originalPages}
            {f.status !== 'fully analyzed' ? ` · ${f.status}` : ''}
          </summary>
          {f.gaps.map((g) => (
            <div className="coverage-gap" key={g.page}>
              <div>
                <strong>
                  Page {g.page}: {g.status}
                </strong>
                <p>{g.reason}</p>
              </div>
              <button className="button" onClick={() => onOpen({ documentId: f.id, page: g.page })}>
                View page {g.page}
              </button>
            </div>
          ))}
          {f.limitations.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </details>
      ))}
      <details>
        <summary>What these checks cover</summary>
        <p>
          Checks applied: {c.supported} Readable text checked describes extraction coverage, not a
          complete defect review.
        </p>
        <p>
          <strong>Requires manual review:</strong> {c.manualReview}
        </p>
        {c.unsupported.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </details>
    </section>
  );
}
