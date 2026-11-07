import React, { useState } from 'react';
import { priorityOf, priorityDescriptions } from '../../priority.js';
import { createManualIssue, refreshManualIssue } from '../../manual.js';

export function ManualIssueDialog({ documents, finding, onClose, onSubmit }) {
  const [title, setTitle] = useState(finding?.title || ''),
    [question, setQuestion] = useState(finding?.question || ''),
    [category, setCategory] = useState(finding?.category || 'Configuration requirement'),
    [severity, setSeverity] = useState(priorityOf(finding?.severity)),
    [impact, setImpact] = useState(finding?.impact || ''),
    [sources, setSources] = useState(
      finding?.evidence.map((e) => ({ documentId: e.documentId, page: e.page, quote: e.text })) || [
        {
          documentId: documents[0]?.id || '',
          page: documents[0]?.pages[0]?.number || 1,
          quote: '',
        },
      ],
    ),
    [error, setError] = useState('');
  function changeSource(index, patch) {
    setSources((s) => s.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function submit(e) {
    e.preventDefault();
    try {
      const input = { title, question, category, severity, impact, sources };
      onSubmit(
        finding
          ? refreshManualIssue(finding, documents, input)
          : createManualIssue(documents, input),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <form
        className="modal manual-issue-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add analyst issue"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-heading">
          <h2>{finding ? 'Recheck issue sources' : 'Add analyst issue'}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close analyst issue"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p>
          Record a requirement found during your review. Source quotations travel with the question
          and can be linked to configuration work.
        </p>
        <label className="field-label">
          Issue title
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={180}
          />
        </label>
        <div className="manual-form-grid">
          <label className="field-label">
            Issue category
            <select
              aria-label="Issue category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {['Configuration requirement', 'Contradiction', 'Missing reference', 'Ambiguity'].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label className="field-label">
            Issue priority
            <select
              aria-label="Issue priority"
              title={priorityDescriptions[severity]}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="blocking">Blocking</option>
              <option value="advisory">Note</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Clarification question
          <textarea
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
          />
        </label>
        <label className="field-label">
          Affected configuration
          <textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="e.g. Minimum commitment validation for Class A initial subscriptions"
            rows={2}
          />
        </label>
        {sources.map((s, index) => {
          const d = documents.find((d) => d.id === s.documentId),
            p = d?.pages.find((p) => p.number === Number(s.page));
          return (
            <fieldset className="manual-source" key={index}>
              <legend>Source {index + 1}</legend>
              <label className="field-label">
                Source document
                <select
                  aria-label="Source document"
                  value={s.documentId}
                  onChange={(e) => {
                    const doc = documents.find((d) => d.id === e.target.value);
                    changeSource(index, {
                      documentId: doc.id,
                      page: doc.pages[0]?.number || 1,
                      quote: '',
                    });
                  }}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · version {d.version || 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Source page / paragraph
                <select
                  aria-label="Source page / paragraph"
                  value={s.page}
                  onChange={(e) => changeSource(index, { page: Number(e.target.value), quote: '' })}
                >
                  {d?.pages.map((p) => (
                    <option value={p.number} key={p.number}>
                      {p.number}
                    </option>
                  ))}
                </select>
              </label>
              <details>
                <summary>Read extracted source text</summary>
                <pre>{p?.text || 'No readable text'}</pre>
              </details>
              <label className="field-label">
                Exact source quotation
                <textarea
                  required
                  value={s.quote}
                  onChange={(e) => changeSource(index, { quote: e.target.value })}
                  rows={3}
                />
              </label>
              <button
                className="text-button"
                type="button"
                disabled={!p?.text}
                onClick={() => changeSource(index, { quote: p.text })}
              >
                Use this page's text
              </button>
              {sources.length > 1 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setSources((s) => s.filter((_, i) => i !== index))}
                >
                  Remove source {index + 1}
                </button>
              )}
            </fieldset>
          );
        })}
        <button
          type="button"
          className="button"
          disabled={sources.length >= 4 || !documents.length}
          onClick={() =>
            setSources((s) => [
              ...s,
              {
                documentId: documents[0]?.id || '',
                page: documents[0]?.pages[0]?.number || 1,
                quote: '',
              },
            ])
          }
        >
          Add another source
        </button>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!documents.length}>
            {finding ? 'Save rechecked sources' : 'Add issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
