import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { documentSections } from '../../references.js';
import './InventoryPanel.css';

const sourceLabel = (e) => `${e.document} · ${e.locator || 'Page'} ${e.page}`;
function EvidenceLink({ e, onOpen, label }) {
  return (
    <button className="text-button evidence-link" onClick={() => onOpen(e)}>
      {label || sourceLabel(e)} <ArrowUpRight size={15} />
    </button>
  );
}
export function InventoryPanel({ analysis, documents, references, onOpen, onReviewFinding }) {
  const sections = documentSections(analysis.inventory, analysis.references);
  function referenceSource(r, i = 0) {
    const e = r.evidence;
    const quote =
      r.kind === 'legislative/tax form'
        ? e.text.match(/^[\s\S]*?subscription attachment\./i)?.[0] || e.text
        : e.text;
    return (
      <div className="reference-source" key={i}>
        {r.externalDocument && <p>Referenced document: {r.externalDocument}</p>}
        <EvidenceLink e={e} onOpen={onOpen} />
        <blockquote>{quote}</blockquote>
        {r.candidateTargets?.map((t, j) => (
          <div key={`candidate-${j}`}>
            <p>Possible match: compare it with the cited passage.</p>
            <EvidenceLink
              e={t.evidence}
              onOpen={onOpen}
              label={`Possible match: ${sourceLabel(t.evidence)}`}
            />
            <blockquote>{t.evidence.text}</blockquote>
          </div>
        ))}
        {r.mismatchedCandidates?.map((t, j) => (
          <div key={`mismatch-${j}`}>
            <p>Supplied for a different fund: {t.fund}</p>
            <EvidenceLink e={t.evidence} onOpen={onOpen} />
          </div>
        ))}
        {(r.targets || []).map((t, j) => (
          <div key={j}>
            <EvidenceLink
              e={t.evidence}
              onOpen={onOpen}
              label={`Matched source: ${sourceLabel(t.evidence)}`}
            />
            <blockquote>{t.evidence.text}</blockquote>
          </div>
        ))}
      </div>
    );
  }
  function reference(item, i) {
    return (
      <details className="reference-entry" key={i}>
        <summary>
          <strong>{item.label}</strong> <span className="reference-status">· {item.status}</span>
        </summary>
        {item.next && <p>{item.next}</p>}
        {item.findingId && (
          <button className="button" onClick={() => onReviewFinding(item.findingId)}>
            Open finding <ArrowUpRight size={15} />
          </button>
        )}
        {referenceSource(item.reference)}
        {item.mentions?.length > 1 && (
          <details className="reference-mentions">
            <summary>Other mentions · {item.mentions.length - 1}</summary>
            {item.mentions.slice(1).map(referenceSource)}
          </details>
        )}
      </details>
    );
  }
  const facts = analysis.facts.flatMap((f) => [
    ...f.minimums.map((m) => ({
      name: `Minimum ${m.contribution === 'unspecified' ? 'investment' : m.contribution + ' contribution'}`,
      value: `${m.currency} ${m.amount.toLocaleString('en')}`,
      scope:
        [
          m.scope.class && `Class ${m.scope.class}`,
          m.scope.applicant,
          m.scope.investor && `${m.scope.investor} investors`,
          m.scope.closing && `${m.scope.closing} closing`,
          m.exercised && 'Express exception stated',
        ]
          .filter(Boolean)
          .join(' · ') || 'Applicability not established',
      e: m.evidence,
    })),
    ...f.definitions.map((d) => ({ name: `“${d.display}”`, value: d.meaning, e: d.evidence })),
    ...f.incorporations.map((d) => ({ name: 'Incorporated terms', value: d.text, e: d.evidence })),
  ]);
  return (
    <section className="inventory-panel">
      <div id="reference-map">
        <h2>Document references</h2>
        {references.attention.length ? (
          <>
            <p className="reference-overview">
              {references.attention.length}{' '}
              {references.attention.length === 1 ? 'reference needs' : 'references need'} attention.{' '}
              Check the cited text or open the finding to record your review.
            </p>
            {references.attention.map(reference)}
          </>
        ) : (
          <p className="reference-overview">No reference issues detected in the checked text.</p>
        )}
        {references.notes.length > 0 && (
          <details className="reference-group">
            <summary>Other referenced documents · {references.notes.length}</summary>
            {references.notes.map(reference)}
          </details>
        )}
        {references.matched.length > 0 && (
          <details className="reference-group">
            <summary>References found in supplied documents · {references.matched.length}</summary>
            {references.matched.map(reference)}
          </details>
        )}
      </div>
      <details className="reference-support">
        <summary>Supporting document details</summary>
        <details className="readable-facts">
          <summary>Document identity &amp; relationships</summary>
          {analysis.context?.documents.map((c) => (
            <div className="fact-row" key={c.documentId}>
              <strong>{documents.find((d) => d.id === c.documentId)?.name}</strong>
              <p>
                {c.role} · {c.fund || 'Fund identity not established'}
                {c.declaredVersion ? ` · Stated version ${c.declaredVersion}` : ''}
                {c.closing ? ` · ${c.closing} closing` : ''}
              </p>
            </div>
          ))}
          {analysis.context?.relationships.map((r, i) => (
            <div key={i}>
              <p>
                {documents.find((d) => d.id === r.from)?.name} forms part of{' '}
                {documents.find((d) => d.id === r.to)?.name}.
              </p>
              <EvidenceLink e={r.evidence} onOpen={onOpen} label="View relationship source" />
            </div>
          ))}
          <p>
            Roles and relationships follow supplied wording. No universal document precedence is
            assumed.
          </p>
        </details>
        <details className="document-outline">
          <summary>Detected document headings</summary>
          <p>
            Headings found in the supplied text. These are navigation aids, not a verified list of
            required documents.
          </p>
          {sections.map((x, i) => (
            <details key={i}>
              <summary>
                {x.title} <span>· {x.evidence.document}</span>
              </summary>
              <p>
                {x.evidence.document}
                {x.fund ? ` · Fund: ${x.fund}` : ' · Fund identity requires verification'}
              </p>
              {x.occurrences.map((item, j) => (
                <div key={j}>
                  <EvidenceLink e={item.evidence} onOpen={onOpen} />
                  <blockquote>{item.evidence.text}</blockquote>
                </div>
              ))}
              {x.contentEvidence?.map((e, j) => (
                <div key={j}>
                  <EvidenceLink e={e} onOpen={onOpen} label={`Continuation: ${sourceLabel(e)}`} />
                  <blockquote>{e.text}</blockquote>
                </div>
              ))}
            </details>
          ))}
        </details>
        {facts.length > 0 && (
          <details className="readable-facts">
            <summary>Terms &amp; amounts found in the text · {facts.length}</summary>
            <div className="fact-table">
              {facts.map((f, i) => (
                <div className="fact-row" key={i}>
                  <strong>{f.name}</strong>
                  <p>{f.value}</p>
                  {f.scope && <p>{f.scope}</p>}
                  <EvidenceLink e={f.e} onOpen={onOpen} />
                </div>
              ))}
            </div>
          </details>
        )}
      </details>
    </section>
  );
}
