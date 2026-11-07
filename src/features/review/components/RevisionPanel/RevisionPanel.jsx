import React from 'react';

export function RevisionPanel({ revisions = [], onOpenEvidence }) {
  if (!revisions.length) return null;
  return (
    <section className="revision-panel">
      <h2>Source revisions</h2>
      <p>
        Text changes identify wording to inspect. Recheck affected citations and resolutions before
        relying on earlier decisions.
      </p>
      {[...revisions].reverse().map((r) => (
        <details key={r.id}>
          <summary>
            {r.name} · version {r.fromVersion} → {r.toVersion} · {r.summary}
          </summary>
          {r.limited && (
            <p className="notice">Detailed comparison is limited. Inspect both originals.</p>
          )}
          {r.changes.map((c, index) => (
            <article className="revision-change" key={index}>
              <h3>
                {c.kind === 'changed'
                  ? 'Changed wording'
                  : c.kind === 'removed'
                    ? 'Removed wording'
                    : 'Added wording'}
              </h3>
              {[
                ['Before', c.before],
                ['After', c.after],
              ].map(([label, parts]) => (
                <div key={label}>
                  <strong>{label}</strong>
                  {parts.length ? (
                    parts.map((part, i) => (
                      <div key={i}>
                        <p>{part.text}</p>
                        {part.evidence.map((e, j) => (
                          <button
                            type="button"
                            className="text-button"
                            key={j}
                            onClick={() => onOpenEvidence(e, r)}
                          >
                            {e.document} · {e.locator || 'Page'} {e.page} · version{' '}
                            {e.documentVersion} ↗
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p>—</p>
                  )}
                </div>
              ))}
            </article>
          ))}
        </details>
      ))}
    </section>
  );
}
