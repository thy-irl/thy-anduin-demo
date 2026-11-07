import React from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { sourceState } from '../../../context/intake.js';
import { statusNames } from '../../review.js';
import { uniqueCitations } from '../../presentation.js';
import './RecordTrace.css';

const evidenceLocation = (e) =>
  e ? `v${e.documentVersion || '?'} · ${e.locator || 'Page'} ${e.page}` : '';
export function RecordTrace({
  finding: f,
  operations,
  documents,
  onEvidence,
  onContext,
  onReport,
}) {
  const decisions = operations.decisions.filter((d) => d.findingIds.includes(f.id));
  const evidence = (items, label) => (
    <div className="trace-group">
      <h3>{label}</h3>
      {uniqueCitations(items).map((e, i) => {
        const state = sourceState(
          {
            documentId: e.documentId,
            documentVersion: e.documentVersion,
            page: e.page,
            quote: e.text,
          },
          documents,
        );
        return (
          <details className="trace-source" key={i}>
            <summary>
              <ChevronRight size={14} className="trace-chevron" aria-hidden="true" />
              <span>
                {e.document}
                <small>{evidenceLocation(e)}</small>
              </span>
              <span
                className={`trace-currency ${state.status === 'current' ? '' : 'needs-review'}`}
              >
                {state.status === 'current' ? 'Text matches' : 'Recheck source'}
              </span>
            </summary>
            {e.section && (
              <p className="trace-section">
                <strong>Section</strong> {e.section}
              </p>
            )}
            {state.status !== 'current' && <p className="verification-note">{state.reason}</p>}
            <blockquote>{e.text}</blockquote>
            <button className="text-button" onClick={() => onEvidence(e)}>
              Open source <ArrowUpRight size={14} />
            </button>
          </details>
        );
      })}
    </div>
  );
  return (
    <details className="record-trace">
      <summary>Sources &amp; review record</summary>
      <dl className="trace-snapshot">
        <div>
          <dt>Review</dt>
          <dd>{statusNames[f.status]}</dd>
        </div>
        <div>
          <dt>Download</dt>
          <dd>{f.includeInReport ? 'Question selected' : 'Not selected'}</dd>
        </div>
      </dl>
      {evidence(f.evidence || [], 'Original citations')}
      {!!f.resolutionEvidence?.length &&
        evidence(f.resolutionEvidence, 'Corrected-source citations')}
      {!!decisions.length && (
        <div className="trace-group">
          <h3>Response links</h3>
          {decisions.map((d) => (
            <article key={d.id}>
              <strong>{d.title}</strong>
              <p className="trace-meta">
                Linked by {d.linkProvenance?.actor || 'a reviewer; name not recorded'}.
                {d.linkProvenance?.reason && ` ${d.linkProvenance.reason}`}
                {d.linkProvenance?.recordedAt &&
                  ` Recorded ${new Date(d.linkProvenance.recordedAt).toLocaleString()}.`}
              </p>
              <small>
                Source: {d.sourceState.status} · Linked versions: {d.dependencyState.status}
              </small>
            </article>
          ))}
        </div>
      )}
      <div className="record-actions">
        <button className="text-button" onClick={onContext}>
          View document requirements <ArrowUpRight size={14} />
        </button>
        <button className="text-button" onClick={onReport}>
          View questions &amp; responses <ArrowUpRight size={14} />
        </button>
      </div>
    </details>
  );
}
