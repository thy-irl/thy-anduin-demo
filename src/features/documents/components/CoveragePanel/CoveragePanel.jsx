import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';
import './CoveragePanel.css';

export function CoveragePanel({ analysis, expanded, onOpen }) {
  const c = analysis.coverage;
  const helpId = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpDismissed, setHelpDismissed] = useState(false);
  return (
    <section className="coverage-panel">
      <div
        className="coverage-heading"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setHelpOpen(false);
            setHelpDismissed(true);
            event.stopPropagation();
          }
        }}
      >
        <h2>Coverage</h2>
        <div
          className={`coverage-help${helpDismissed ? ' is-dismissed' : ''}`}
          onMouseEnter={() => setHelpDismissed(false)}
          onMouseLeave={() => setHelpOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
          }}
        >
          <button
            type="button"
            className="coverage-help-button"
            aria-label="About coverage"
            aria-describedby={helpId}
            onFocus={() => setHelpDismissed(false)}
            onClick={() => {
              setHelpDismissed(helpOpen);
              setHelpOpen(!helpOpen);
            }}
          >
            <Info size={17} aria-hidden="true" />
          </button>
          <div
            id={helpId}
            role="tooltip"
            className={`coverage-help-tooltip${helpOpen ? ' is-open' : ''}`}
          >
            <strong>What coverage means</strong>
            <p>
              Coverage shows how much source text Preflight could check. Images and unreadable
              content can leave gaps that may affect the findings.
            </p>
            <p>
              Automated checks look for reference, definition, date, amount and wording issues using
              fixed rules. They can miss issues and require human review.
            </p>
            <p>
              Inspect flagged pages and supply a searchable version where needed. OCR is not
              performed automatically. Full text coverage does not mean every issue was found.
            </p>
          </div>
        </div>
      </div>
      <p>
        {c.pagesChecked} pages / paragraphs checked · {c.pagesWithGaps} pages with gaps. Scanned
        image text is not read automatically.
      </p>
      {c.files.map((f) => (
        <details key={`${f.id}-${expanded}`} open={expanded && f.status !== 'fully analyzed'}>
          <summary>
            {f.name} · {f.originalPages}{' '}
            {/\.docx$/i.test(f.name) ? 'paragraphs' : f.originalPages === 1 ? 'page' : 'pages'}
            {f.status !== 'fully analyzed' && (
              <>
                {' · '}
                <span className="coverage-status-warning">
                  {f.status === 'rejected' ? 'File could not be checked' : 'Partially analyzed'}
                </span>
              </>
            )}
          </summary>
          {f.gaps.map((g) => (
            <div className="coverage-gap" key={g.page}>
              <div>
                <strong className="coverage-status-warning">
                  Page {g.page}:{' '}
                  {g.status === 'image content unchecked'
                    ? 'this page contains images that need review'
                    : g.status}
                </strong>
                <p
                  className={
                    g.status === 'image content unchecked'
                      ? 'coverage-warning-description'
                      : undefined
                  }
                >
                  {g.status === 'image content unchecked'
                    ? 'We checked this page’s searchable text, but couldn’t read content inside its images. That content may affect the findings.'
                    : g.reason}
                </p>
              </div>
              <button className="button" onClick={() => onOpen({ documentId: f.id, page: g.page })}>
                View page {g.page}
              </button>
            </div>
          ))}
          {f.gaps.some((g) => g.status === 'image content unchecked') && (
            <p className="coverage-tip">
              Inspect the images. If they contain relevant text, upload a searchable version and
              rerun the review. OCR is not performed automatically.
            </p>
          )}
          {f.limitations
            .filter(
              (l) =>
                !(
                  f.gaps.some((g) => g.status === 'image content unchecked') &&
                  l ===
                    'Embedded images may contain unextracted text or headings. Inspect original pages; OCR not performed.'
                ),
            )
            .map((l, i) => (
              <p key={i}>{l}</p>
            ))}
        </details>
      ))}
    </section>
  );
}
