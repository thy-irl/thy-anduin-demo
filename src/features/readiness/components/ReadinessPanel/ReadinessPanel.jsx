import React, { useState } from 'react';
import { Check, Circle, ShieldCheck, ArrowRight, LockKeyhole } from 'lucide-react';
import './ReadinessPanel.css';
import { findingCopy } from '../../../analysis/copy.js';
import {
  readinessLabels,
  readinessWorkGroups,
  readinessAction,
  readinessBlockerCopy,
} from '../../../../lib/workflow.js';

const checkNames = {
  sources: 'Required sources and versions',
  coverage: 'Text coverage',
  criticalFindings: 'Finding review',
  decisions: 'Internal approvals for current sources',
  acknowledgement: 'Internal readiness acknowledgement',
};

export function ReadinessPanel({
  readiness: r,
  findings = [],
  onNavigate,
  onDecision,
  onRerun,
  onOpenFinding,
  onOpenSource,
  onAcknowledge,
  onExportSummary,
  exportingSummary = false,
}) {
  const [recordedBy, setRecordedBy] = useState(''),
    [rationale, setRationale] = useState(''),
    [coverageReview, setCoverageReview] = useState(''),
    [acknowledged, setAcknowledged] = useState(false),
    [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    setError('');
    try {
      onAcknowledge({ recordedBy, rationale, coverageReview, acknowledged });
      setAcknowledged(false);
    } catch (err) {
      setError(err.message);
    }
  }
  const reasonText = (item) => {
    const finding = findings.find((f) => f.id === item.findingId);
    return finding ? item.reason.replace(finding.title, findingCopy(finding).title) : item.reason;
  };
  const ack = r.acknowledgement.record,
    groups = readinessWorkGroups(r),
    passed = Object.values(r.checks).filter(Boolean).length;
  const canSubmit =
    r.canAcknowledge &&
    acknowledged &&
    !!recordedBy.trim() &&
    !!rationale.trim() &&
    !!coverageReview.trim();
  function act(b, a) {
    if (a.stage) onDecision({ findingId: b.findingId, decisionId: b.decisionId, stage: a.stage });
    else if (a.rerun) onRerun();
    else if (b.findingId && !a.tab) onOpenFinding(b.findingId);
    else onNavigate(a.tab || b.actionTab, a.section);
  }
  return (
    <section className="readiness-panel" aria-label="Digitization readiness">
      <header className="readiness-heading">
        <div>
          <h2>Internal handoff</h2>
          <p>
            {r.state === 'READY'
              ? 'Current source coverage, finding review and approval checks pass.'
              : r.state === 'NOT_EVALUATED'
                ? 'Upload documents to begin.'
                : groups.length
                  ? `${groups.length} ${groups.length === 1 ? 'step remains' : 'steps remain'} before acknowledgement.`
                  : 'Review coverage and acknowledge this package.'}
          </p>
        </div>
        <strong
          className={`readiness-state readiness-state-${r.state.toLowerCase()}`}
          data-state={r.state}
          role="status"
        >
          {readinessLabels[r.state]}
        </strong>
      </header>
      <section className="readiness-check-overview" aria-labelledby="readiness-progress-heading">
        <div className="readiness-progress-heading">
          <h3 id="readiness-progress-heading">Readiness checks</h3>
          <strong>
            {passed} of {Object.keys(r.checks).length} pass
          </strong>
        </div>
        <progress
          className="readiness-progress"
          value={passed}
          max={Object.keys(r.checks).length}
          aria-label="Readiness checks passed"
        />
        <div className="readiness-checks" aria-label="Calculated readiness checks">
          {Object.entries(r.checks).map(([key, ok]) => (
            <div key={key} data-passed={ok}>
              {ok ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Circle size={18} aria-hidden="true" />
              )}
              <span>
                {checkNames[key]}
                <small>{ok ? 'Current checks pass' : 'Action required'}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="readiness-boundary">Internal workflow only. Not client or legal approval.</p>
      <section className="readiness-deliverable" aria-labelledby="review-summary-heading">
        <div>
          <h3 id="review-summary-heading">Review summary</h3>
          <p>
            All findings and review outcomes, source references, clarification responses, internal
            approval records, coverage limits and current readiness status.
          </p>
          <p>
            {r.state === 'READY'
              ? 'For internal handoff, send this summary with the current source files. Original files are not included or edited by this export.'
              : 'Download a progress snapshot. Complete the remaining readiness actions before internal handoff. Original files are not included or edited by this export.'}
          </p>
        </div>
        <button
          className={`button${r.state === 'READY' ? ' primary' : ''}`}
          onClick={onExportSummary}
          disabled={exportingSummary}
          aria-busy={exportingSummary}
        >
          {exportingSummary ? 'Preparing PDF…' : 'Download review summary (PDF)'}
        </button>
      </section>
      <section className="readiness-blockers" aria-label="Readiness blockers">
        {groups.length > 0 && <h3>What to do next</h3>}
        {groups.map((g, index) => {
          const b = g.items[0],
            a = readinessAction(b),
            finding = findings.find((f) => f.id === b.findingId),
            copy = readinessBlockerCopy(b);
          return (
            <article
              key={g.key}
              className={`readiness-blocker ${b.severity} ${index === 0 ? 'readiness-next' : ''}`}
              data-readiness-code={b.code}
            >
              <div className="readiness-blocker-heading">
                <div>
                  <h3>{finding ? findingCopy(finding).title : a.title}</h3>
                </div>
                <span>
                  {g.items.some((i) => i.severity === 'blocking') ? 'Blocking' : 'Review needed'}
                </span>
              </div>
              <p>{copy?.next || reasonText(b)}</p>
              <div className="readiness-actions">
                <button className="button" onClick={() => act(b, a)}>
                  {a.label}
                </button>
                {finding && a.stage && (
                  <button className="text-button" onClick={() => onOpenFinding(b.findingId)}>
                    Review finding
                  </button>
                )}
              </div>
              <details className="readiness-requirements">
                <summary>Sources &amp; requirements</summary>
                {g.items.map((item) => (
                  <div key={item.id} data-readiness-detail={item.code}>
                    <dl className="check-facts readiness-requirement-facts">
                      <div>
                        <dt>Needed</dt>
                        <dd>{readinessBlockerCopy(item)?.requirement || item.nextAction}</dd>
                      </div>
                      <div>
                        <dt>Responsible</dt>
                        <dd>{item.responsibleRole || 'Unassigned'}</dd>
                      </div>
                    </dl>
                    {item.evidence.length > 0 && (
                      <section className="readiness-source-list" aria-label="Supporting sources">
                        <h4>
                          Supporting sources <span>{item.evidence.length}</span>
                        </h4>
                        {item.evidence.map((e, i) => (
                          <details className="readiness-evidence" key={i}>
                            <summary>
                              <span>
                                {e.document ||
                                  r.coverage.files.find((file) => file.id === e.documentId)?.name ||
                                  e.documentId ||
                                  'Source not specified'}
                              </span>
                              <small>
                                Version {e.documentVersion || 'unverified'} ·{' '}
                                {e.locator || 'Page / paragraph'} {e.page || 'unverified'}
                              </small>
                            </summary>
                            {(e.text || e.quote) && <blockquote>{e.text || e.quote}</blockquote>}
                            {e.documentId && e.documentVersion && (
                              <button className="text-button" onClick={() => onOpenSource(e)}>
                                Open cited source
                              </button>
                            )}
                          </details>
                        ))}
                      </section>
                    )}
                    <details className="readiness-assessment">
                      <summary>Full assessment</summary>
                      <p>{reasonText(item)}</p>
                      <p>{item.nextAction}</p>
                    </details>
                  </div>
                ))}
              </details>
            </article>
          );
        })}
      </section>
      <details className="readiness-coverage" aria-label="Detection coverage limitations">
        <summary>Coverage &amp; limitations</summary>
        <p>
          Automated checks support your review. A clear queue does not mean the package is complete
          or error-free.
        </p>
        <dl className="check-facts">
          <div>
            <dt>Checks</dt>
            <dd>
              Selected references, definitions, amounts, dates and configured requirements in
              readable text.
            </dd>
          </div>
          <div>
            <dt>Manual review</dt>
            <dd>
              Review original files, scanned text and complex layouts. Confirm applicable terms and
              any requirements the checks may miss.
            </dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>
              Internal readiness is not legal or customer approval. Recorded names are not
              authenticated.
            </dd>
          </div>
        </dl>
        {r.warnings.some((w) => w.code !== 'detection-limited') && (
          <section className="check-impact">
            <h3>Notes for this package</h3>
            <ul>
              {r.warnings
                .filter((w) => w.code !== 'detection-limited')
                .map((w) => (
                  <li key={w.id}>{reasonText(w)}</li>
                ))}
            </ul>
          </section>
        )}
        <details className="check-diagnostics">
          <summary>Full check coverage</summary>
          {r.coverage.supported && (
            <>
              <h3>Automated checks</h3>
              <p>{r.coverage.supported}</p>
            </>
          )}
          <h3>Manual review</h3>
          <p>
            {r.coverage.manualReview ||
              'Review the originals and requirements outside the automated checks.'}
          </p>
          {!!r.coverage.unsupported.length && (
            <>
              <h3>Unsupported content &amp; limits</h3>
              <ul>
                {r.coverage.unsupported.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <p>{r.limits}</p>
        </details>
      </details>
      {ack && (
        <section className="readiness-record" aria-label="Recorded readiness acknowledgement">
          <h3>
            {r.acknowledgement.current
              ? 'Current internal acknowledgement'
              : 'Previous acknowledgement · Review needed'}
          </h3>
          <p>
            Recorded by {ack.recordedBy} · {ack.recordedAt}
          </p>
          <p>{ack.rationale}</p>
          <details>
            <summary>Review record &amp; history</summary>
            <p>Manual coverage review: {ack.coverageReview}</p>
            <small>
              Names entered manually; identity not verified. {r.acknowledgement.history.length}{' '}
              earlier records retained.
            </small>
          </details>
        </section>
      )}
      {!r.acknowledgement.current && (
        <form
          className="readiness-acknowledgement"
          onSubmit={submit}
          aria-label="Internal readiness acknowledgement"
        >
          <h3>Final step: acknowledge internal readiness</h3>
          <p id="readiness-acknowledgement-help">
            {r.canAcknowledge
              ? 'Record your manual review of the current package.'
              : 'Available after the steps above are complete.'}
          </p>
          <details open={r.canAcknowledge}>
            <summary>Manual review &amp; acknowledgement</summary>
            <div className="readiness-form-fields">
              <label>
                Readiness recorded by
                <input
                  required
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <small>Names entered manually; identity not verified.</small>
              <label>
                Readiness rationale
                <textarea
                  required
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={2}
                />
              </label>
              <label>
                Manual coverage review
                <textarea
                  required
                  value={coverageReview}
                  onChange={(e) => setCoverageReview(e.target.value)}
                  rows={3}
                  placeholder="Describe your review of originals and requirements outside the automated checks."
                />
              </label>
            </div>
            <label className="readiness-consent">
              <input
                type="checkbox"
                required
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I acknowledge this current package for internal digitization handoff
            </label>
          </details>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button readiness-confirm"
            aria-describedby="readiness-acknowledgement-help"
            disabled={!canSubmit}
          >
            {canSubmit ? (
              <ShieldCheck size={19} aria-hidden="true" />
            ) : (
              <LockKeyhole size={19} aria-hidden="true" />
            )}
            Acknowledge internal readiness
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  );
}
