import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, FileText, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { normalizeIntakeContext, operationalContext, sourceState } from '../../intake.js';
import { saveDecisionResolution, exportDecisionQuestion } from '../../decisions.js';
import './ReviewContext.css';
import './Questions.css';
import { findingCopy } from '../../../analysis/copy.js';
import { statusNames } from '../../../review/review.js';
import { decisionStatusNames } from '../../../../lib/workflow.js';
import Pagination from '../../../../components/Pagination.jsx';

const sourceNames = {
  current: 'Source current',
  stale: 'Needs recheck',
  missing: 'Source missing',
  unverified: 'Source needed',
};
const relationshipNames = {
  attached: 'Required in package',
  external: 'Intentionally external',
  'out-of-scope': 'Outside this review',
};
const array = (value) => (Array.isArray(value) ? value : []);
const text = (value) => value ?? '';
const copy = (value) => JSON.parse(JSON.stringify(value));
const emptySource = () => ({ documentId: '', documentVersion: null, page: 1, quote: '' });
const sourceFor = (doc) => ({
  ...emptySource(),
  documentId: doc?.id || '',
  documentVersion: doc?.version ?? null,
  page: doc?.pages?.[0]?.number || 1,
});
const findingStatus = (f) => statusNames[f.status] || f.status;
const routingNames = decisionStatusNames;
function downloadQuestion(value, documents) {
  const url = URL.createObjectURL(
      new Blob([exportDecisionQuestion(value, documents)], { type: 'text/markdown' }),
    ),
    link = document.createElement('a');
  link.href = url;
  link.download = 'clarification-question.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RequiredLabel({ approval = false }) {
  return (
    <span className="question-required">{approval ? 'Required for approval' : 'Required'}</span>
  );
}

function DecisionFields({ value, set, documents, step, responseError }) {
  const response = value.response || {},
    approval = value.approval || {},
    scope = approval.applicability || {};
  const responseField = (label, key, type = 'text') => (
    <label>
      <span className="question-field-label">
        {label}
        <RequiredLabel approval />
      </span>
      <input
        aria-label={label}
        aria-required={step === 'approval'}
        type={type}
        value={response[key] || ''}
        onChange={(e) => set({ response: { ...response, [key]: e.target.value } })}
      />
    </label>
  );
  const approvalField = (label, key, type = 'text') => (
    <label>
      <span className="question-field-label">
        {label}
        <RequiredLabel approval />
      </span>
      <input
        aria-label={label}
        aria-required="true"
        type={type}
        value={approval[key] || ''}
        onChange={(e) => set({ approval: { ...approval, [key]: e.target.value } })}
      />
    </label>
  );
  const scopeField = (label, key) => (
    <label>
      <span className="question-field-label">
        {label}
        {key !== 'conditions' && <RequiredLabel approval />}
      </span>
      <input
        aria-label={label}
        aria-required={key !== 'conditions'}
        value={scope[key] || ''}
        onChange={(e) =>
          set({ approval: { ...approval, applicability: { ...scope, [key]: e.target.value } } })
        }
      />
    </label>
  );
  return (
    <>
      {step === 'question' && (
        <fieldset className="intake-source-editor">
          <legend>Draft question</legend>
          <div className="intake-fields">
            <label>
              Response needed from
              <select
                value={value.issueType || 'legal'}
                onChange={(e) => set({ issueType: e.target.value })}
              >
                <option value="legal">Legal counsel</option>
                <option value="client">Client</option>
                <option value="internal">Internal team</option>
              </select>
            </label>
            <label>
              Question status
              <select
                value={value.routingStatus || 'draft'}
                onChange={(e) => set({ routingStatus: e.target.value })}
              >
                {Object.entries(routingNames)
                  .filter(
                    ([key]) =>
                      key !== 'needs-reconfirmation' &&
                      (key !== 'approved' || value.routingStatus === 'approved'),
                  )
                  .map(([key, label]) => (
                    <option key={key} value={key} disabled={key === 'approved'}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="intake-wide">
              Question to send{' '}
              <small className="input-help">You can leave this blank while drafting.</small>
              <textarea
                aria-label="Clarification question"
                value={value.question || ''}
                rows={3}
                onChange={(e) => set({ question: e.target.value })}
              />
            </label>
            <label>
              Assigned to
              <input
                value={value.assignedTo || ''}
                onChange={(e) => set({ assignedTo: e.target.value })}
              />
            </label>
            <label>
              Asked date
              <input
                type="date"
                value={value.askedAt || ''}
                onChange={(e) => set({ askedAt: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => downloadQuestion(value, documents)}
          >
            Download question
          </button>
          <small className="intake-help">Download only; no message is sent.</small>
        </fieldset>
      )}
      {step === 'response' && (
        <fieldset className="intake-source-editor">
          <legend>The answer you received</legend>
          <p className="intake-help">
            Paste or write the answer below. Saving it keeps a record; internal approval is a
            separate step.
          </p>
          <div className="intake-fields">
            <label className="intake-wide">
              <span className="question-field-label">
                Response text <RequiredLabel />
              </span>
              <textarea
                aria-label="Response text"
                aria-required="true"
                placeholder="What did your team, client or counsel say?"
                aria-invalid={!!responseError}
                aria-describedby={responseError ? 'response-text-error' : undefined}
                rows={3}
                value={response.text || ''}
                onChange={(e) => set({ response: { ...response, text: e.target.value } })}
              />
              {responseError && (
                <small className="intake-error" id="response-text-error" role="alert">
                  {responseError}
                </small>
              )}
            </label>
          </div>
        </fieldset>
      )}
      {(step === 'response' || step === 'approval') && (
        <details
          className="question-response-details"
          open={step === 'approval' ? true : undefined}
        >
          <summary>
            Who supplied the answer?{' '}
            <span>
              {step === 'approval' ? 'Required for approval' : 'Add now or before approval'}
            </span>
          </summary>
          <p className="intake-help">
            Keep the sender, date and reference so someone else can verify the answer.
          </p>
          <div className="intake-fields">
            {responseField('Who provided the response', 'author')}
            {responseField('How it was received', 'channel')}
            {responseField('Response received date', 'receivedAt', 'date')}
            {responseField('Email, document or other reference', 'reference')}
            {responseField('Response recorded by', 'recordedBy')}
          </div>
        </details>
      )}
      {step === 'approval' && (
        <>
          <fieldset className="intake-source-editor">
            <legend>Record the internal review</legend>
            <p className="intake-help">
              Check the answer against the sources, then record who reviewed it and where it
              applies. All marked details are needed to record approval; you can save an incomplete
              draft.
            </p>
            <p className="intake-help">
              Names entered manually; identity not verified. This is not legal approval.
            </p>
            <div className="intake-fields">
              {approvalField('Internal approval recorded by', 'recordedBy')}
              {approvalField('Internal approval date', 'approvedAt', 'date')}
              {approvalField('Internal approval rationale', 'rationale')}
              {scopeField('Fund or vehicle covered', 'vehicle')}
              {scopeField('Investor group or application route', 'investorRoute')}
              {scopeField('Conditions or limits', 'conditions')}
            </div>
            <CheckPicker
              title="Approval source documents · required for approval"
              items={documents}
              value={scope.documentIds}
              onChange={(ids) =>
                set({ approval: { ...approval, applicability: { ...scope, documentIds: ids } } })
              }
              empty="Upload the relevant sources first."
            />
            <p className="intake-help">
              Select every applicable source. Changed evidence requires approval again.
            </p>
          </fieldset>
        </>
      )}
    </>
  );
}

function SourceStatus({ source, documents, onOpen }) {
  const state = sourceState(source, documents),
    doc = documents.find((d) => d.id === source?.documentId);
  return (
    <div className="intake-source-status">
      <span className={`intake-status ${state.status}`} title={state.reason}>
        {sourceNames[state.status]}
      </span>

      {doc && (
        <button
          type="button"
          className="text-button"
          onClick={() => onOpen?.({ documentId: doc.id, page: source.page || 1 })}
        >
          {doc.name} · {doc.type === 'DOCX' ? 'Paragraph' : 'Page'} {source.page || 1}
          <ArrowUpRight size={13} />
        </button>
      )}
      {state.status !== 'current' && <small>{state.reason}</small>}
    </div>
  );
}

function DependencyStatus({ row }) {
  return row?.dependencyState && row.dependencyState.status !== 'current' ? (
    <p className="intake-help intake-dependency-warning">
      <strong>Linked sources need review:</strong> {row.dependencyState.reason}
    </p>
  ) : null;
}

function SourceEditor({ value, onChange, documents, onOpen, approvalRequired = false }) {
  const source = value || emptySource(),
    doc = documents.find((d) => d.id === source.documentId),
    pages = doc?.pages || [],
    page = pages.find((p) => p.number === Number(source.page));
  const state = sourceState(source, documents);
  const edit = (patch) =>
    onChange({ ...source, ...patch, documentVersion: doc?.version ?? source.documentVersion });
  return (
    <fieldset className="intake-source-editor">
      <legend>Supporting source {approvalRequired && <RequiredLabel approval />}</legend>
      <p className="intake-help">Cite the current document and exact supporting text.</p>
      <div className="intake-fields">
        <label>
          <span className="question-field-label">
            Source document {approvalRequired && <RequiredLabel approval />}
          </span>
          <select
            aria-required={approvalRequired}
            aria-label="Source document"
            value={source.documentId || ''}
            onChange={(e) => {
              const selected = documents.find((d) => d.id === e.target.value);
              onChange(sourceFor(selected));
            }}
          >
            <option value="">No source selected</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · v{d.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          {doc?.type === 'DOCX' ? 'Paragraph / segment' : 'Page'}
          <select
            aria-label={doc?.type === 'DOCX' ? 'Paragraph / segment' : 'Page'}
            value={source.page || 1}
            disabled={!doc}
            onChange={(e) => edit({ page: Number(e.target.value), quote: '' })}
          >
            {pages.length ? (
              pages.map((p) => (
                <option key={p.number} value={p.number}>
                  {p.number}
                </option>
              ))
            ) : (
              <option value="1">1</option>
            )}
          </select>
        </label>
      </div>
      <label className="intake-full-label">
        <span className="question-field-label">
          Source quote {approvalRequired && <RequiredLabel approval />}
        </span>
        <textarea
          aria-required={approvalRequired}
          aria-label="Source quote"
          value={source.quote || ''}
          rows={3}
          onChange={(e) => edit({ quote: e.target.value })}
          placeholder="Paste an exact passage from the selected page."
        />
      </label>
      <div className="intake-source-tools">
        <button
          type="button"
          className="button"
          disabled={!page?.text?.trim()}
          onClick={() => edit({ quote: page.text })}
        >
          Use selected page text
        </button>
        {doc && (
          <button
            type="button"
            className="text-button"
            onClick={() => onOpen?.({ documentId: doc.id, page: Number(source.page) || 1 })}
          >
            View source
            <ArrowUpRight size={13} />
          </button>
        )}
        <span className={`intake-status ${state.status}`}>{sourceNames[state.status]}</span>
      </div>
      {state.status !== 'current' && (
        <p className="intake-help">
          {state.reason}
          {state.status === 'stale'
            ? ' Select the current page and check its wording before saving again.'
            : ''}
        </p>
      )}
      <small className="intake-help">
        Source version {source.documentVersion ?? '—'}. Recheck after replacement.
      </small>
    </fieldset>
  );
}

function CheckPicker({ title, items, value, onChange, empty, describe }) {
  const values = array(value),
    selected = new Set(values),
    missing = values.filter((id) => !items.some((i) => i.id === id));
  const toggle = (id, checked) =>
    onChange(checked ? [...values, id] : values.filter((v) => v !== id));
  return (
    <details className="intake-picker">
      <summary>
        {title}
        <span>{values.length} selected</span>
      </summary>
      {items.length || missing.length ? (
        <fieldset>
          <legend className="sr-only">{title}</legend>
          {items.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={(e) => toggle(item.id, e.target.checked)}
              />
              <span>
                {item.name || findingCopy(item).title}
                {describe && <small>{describe(item)}</small>}
              </span>
            </label>
          ))}
          {missing.map((id) => (
            <label key={id}>
              <input type="checkbox" checked onChange={(e) => toggle(id, e.target.checked)} />
              <span>
                Unavailable linked item<small>Remove this link or restore its source.</small>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="intake-help">{empty}</p>
      )}
    </details>
  );
}

const sameEvidence = (a, b) =>
  !!a &&
  !!b &&
  a.documentId === b.documentId &&
  a.documentVersion === b.documentVersion &&
  a.page === b.page &&
  a.text === b.text;

function DecisionEvidence({
  value,
  findings,
  documents,
  preferredEvidence,
  onOpenSource,
  onOpenFinding,
}) {
  const linked = array(value.findingIds)
    .map((id) => findings.find((f) => f.id === id))
    .filter(Boolean);
  const citation = (e, key) => {
    const doc = documents.find((d) => d.id === e.documentId);
    const state = sourceState({ ...e, quote: e.text }, documents);
    return (
      <div className="decision-citation" key={key}>
        <button
          type="button"
          className="text-button"
          disabled={!doc}
          onClick={() => onOpenSource?.(e)}
        >
          {e.document || doc?.name || 'Unavailable source'} · Version{' '}
          {e.documentVersion || 'unknown'} · {e.locator || 'Page'} {e.page}
          <ArrowUpRight size={14} />
        </button>
        {sameEvidence(e, preferredEvidence) && <small>Selected in finding</small>}
        <blockquote>{e.text}</blockquote>
        {state.status !== 'current' && (
          <p className="intake-help">
            {sourceNames[state.status]}: {state.reason}
          </p>
        )}
      </div>
    );
  };
  return (
    <section className="decision-evidence" aria-label="Question and source evidence">
      <h4>Question being answered</h4>
      <p>
        {value.question ||
          'No question text yet. Open the Question step to add the question being answered.'}
      </p>
      {linked.map((finding) => {
        const sources =
          finding.status === 'resolved' && finding.resolutionEvidence?.length
            ? finding.resolutionEvidence
            : array(finding.evidence);
        const ordered = [...sources].sort(
          (a, b) =>
            Number(sameEvidence(b, preferredEvidence)) - Number(sameEvidence(a, preferredEvidence)),
        );
        return (
          <div className="decision-finding-evidence" key={finding.id}>
            <strong>{findingCopy(finding).title}</strong>
            {onOpenFinding && (
              <button
                type="button"
                className="text-button"
                aria-label={`Return to finding: ${findingCopy(finding).title}`}
                onClick={() => onOpenFinding(finding.id, preferredEvidence)}
              >
                Return to finding <ArrowUpRight size={14} />
              </button>
            )}
            <details className="question-evidence-details">
              <summary>Read source passages · {ordered.length}</summary>
              {ordered.map(citation)}
            </details>
            {!sources.length && (
              <p className="intake-help">No source evidence recorded for this finding.</p>
            )}
          </div>
        );
      })}
      {!linked.length &&
        (value.source?.quote ? (
          citation({ ...value.source, text: value.source.quote }, 'supporting-source')
        ) : (
          <p className="intake-help">
            No supporting source recorded. Add a citation under Supporting source.
          </p>
        ))}
    </section>
  );
}

function QuestionSourceNotice({ value, documents, findings, effective }) {
  const reasons = [];
  if (effective?.effectiveRoutingStatus === 'needs-reconfirmation')
    reasons.push(
      'The answer or its sources changed. Review them before recording internal approval again.',
    );
  if (effective?.dependencyState && effective.dependencyState.status !== 'current')
    reasons.push(effective.dependencyState.reason);
  const source = sourceState(value.source, documents);
  if (source.status !== 'current') reasons.push(source.reason);
  for (const id of array(value.findingIds)) {
    const finding = findings.find((item) => item.id === id);
    if (!finding) {
      reasons.push(
        'A linked finding is unavailable. Restore it or remove the link before approval.',
      );
      continue;
    }
    const evidence =
      finding.status === 'resolved' && finding.resolutionEvidence?.length
        ? finding.resolutionEvidence
        : array(finding.evidence);
    if (
      !evidence.length ||
      evidence.some(
        (entry) => sourceState({ ...entry, quote: entry.text }, documents).status !== 'current',
      )
    )
      reasons.push(
        'Linked finding evidence needs review. Check its current source passages before approval.',
      );
  }
  const unique = [...new Set(reasons.filter(Boolean))];
  return unique.length ? (
    <aside className="question-recheck" aria-label="Sources need review">
      <strong>Check the sources before approval</strong>
      <ul>
        {unique.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </aside>
  ) : null;
}

function Editor({
  effective,
  kind,
  initial,
  documents,
  findings,
  metadataIssues,
  sourceDocuments,
  detected,
  initialStep,
  requestId,
  onCancel,
  onSave,
  onDelete,
  onOpenSource,
  onOpenFinding,
  preferredEvidence,
}) {
  const [value, setValue] = useState(() =>
      copy(
        kind === 'decision'
          ? { ...initial, approval: initial.approvalDraft || initial.approval }
          : initial,
      ),
    ),
    [error, setError] = useState(''),
    [responseError, setResponseError] = useState(''),
    [step, setStep] = useState(initialStep || 'response');
  const form = useRef(null);
  const set = (patch) => {
    setError('');
    setResponseError('');
    setValue((v) => ({ ...v, ...patch }));
  };
  useEffect(() => {
    form.current?.querySelector('input,select,textarea')?.focus();
  }, []);
  useEffect(() => {
    setStep(initialStep || 'response');
    setError('');
    setResponseError('');
  }, [initialStep, requestId]);
  const titles = {
    document: 'Document identity',
    decision: 'Question & answer',
    requirement: 'Package requirement',
  };
  function save(e) {
    e.preventDefault();
    setError('');
    setResponseError('');
    const recordApproval =
      kind === 'decision' && step === 'approval' && e.nativeEvent.submitter?.value === 'approve';
    if (
      kind === 'decision' &&
      value.status === 'confirmed' &&
      (!value.owner?.trim() || sourceState(value.source, documents).status !== 'current')
    ) {
      setError(
        'A confirmed interpretation needs an owner and an exact quote from a current source.',
      );
      return;
    }
    const next = {
      ...value,
      ...(kind === 'document' ? { source: value.source || emptySource() } : {}),
    };
    if (kind !== 'document' && kind !== 'requirement') {
      const findingDocumentIds = array(next.findingIds).flatMap((id) => {
        const f = findings.find((f) => f.id === id);
        return (
          (f?.status === 'resolved' && f.resolutionEvidence?.length
            ? f.resolutionEvidence
            : f?.evidence
          )?.map((e) => e.documentId) || []
        );
      });
      const ids = [
        ...new Set(
          [
            ...array(next.documentIds),
            ...(kind === 'decision' ? array(next.approval?.applicability?.documentIds) : []),
            ...findingDocumentIds,
            next.source?.documentId,
          ].filter(Boolean),
        ),
      ];
      next.documentVersions = Object.fromEntries(
        ids.map((id) => [id, documents.find((d) => d.id === id)?.version || 0]),
      );
    }
    if (
      kind === 'decision' &&
      JSON.stringify(array(next.findingIds)) !== JSON.stringify(array(initial.findingIds))
    )
      next.linkProvenance = {
        actor: value.linkProvenance?.actor || 'Local reviewer (identity not authenticated)',
        reason:
          value.linkProvenance?.reason || 'Reviewer selected the related findings in Questions.',
        recordedAt: new Date().toISOString(),
      };
    if (kind === 'decision') {
      if (recordApproval && next.approval?.applicability) {
        const scope = next.approval.applicability;
        next.approval = {
          ...next.approval,
          applicability: {
            ...scope,
            documentVersions: Object.fromEntries(
              array(scope.documentIds).map((id) => [
                id,
                documents.find((d) => d.id === id)?.version || 0,
              ]),
            ),
          },
        };
      }
      try {
        onSave(
          saveDecisionResolution(
            initial,
            next,
            { documents, findings, metadataIssues, sourceDocuments },
            { recordApproval, recordResponse: step === 'response' },
          ),
        );
      } catch (error) {
        if (step === 'response' && !value.response?.text?.trim()) {
          setResponseError(error.message);
          form.current?.querySelector('[aria-label="Response text"]')?.focus();
        } else setError(error.message);
      }
      return;
    }
    onSave(next);
  }
  const inputHelp = {
    fund: 'Used to distinguish vehicles in source matching. Verify the legal name against a current citation.',
    declaredVersion:
      'A stated version or date from the document; separate from the app’s uploaded version counter.',
    closing: 'Records which closing this entry concerns; it does not infer legal applicability.',
    label: 'Names the expected or external source in the package inventory.',
    investorType:
      'Records who this wording applies to, such as an entity or individual. No automatic eligibility determination.',
    shareClass:
      'Records the class covered by this population so intentional differences remain explicit.',
    answer:
      'Record an answer and its covered population, not a source fact inferred by the app. A confirmed answer does not close issues.',
    owner: 'Records responsibility only; names are not authenticated and no notification is sent.',
  };
  const field = (
    label,
    key,
    { placeholder = '', required = false, wide = false, area = false } = {},
  ) => (
    <label className={wide ? 'intake-wide' : undefined}>
      <span className="question-field-label">
        {label}
        {required && <RequiredLabel />}
      </span>
      {inputHelp[key] && (
        <small id={`help-${kind}-${key}`} className="input-help">
          {inputHelp[key]}
        </small>
      )}
      {area ? (
        <textarea
          aria-label={label}
          aria-describedby={inputHelp[key] ? `help-${kind}-${key}` : undefined}
          value={text(value[key])}
          onChange={(e) => set({ [key]: e.target.value })}
          required={required}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          aria-label={label}
          aria-describedby={inputHelp[key] ? `help-${kind}-${key}` : undefined}
          value={text(value[key])}
          onChange={(e) => set({ [key]: e.target.value })}
          required={required}
          placeholder={placeholder}
        />
      )}
    </label>
  );
  return (
    <form
      className={`intake-editor${kind === 'decision' ? ' question-editor' : kind === 'requirement' ? ' requirement-editor' : ''}`}
      id="context-editor"
      ref={form}
      onSubmit={save}
      aria-label={`Edit ${titles[kind].toLowerCase()}`}
    >
      <div className="intake-editor-heading">
        <h3>
          {kind === 'decision'
            ? {
                question: 'Draft a question',
                response: 'Record an answer',
                approval: 'Review internal approval',
              }[step]
            : titles[kind]}
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Cancel context edit"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </div>
      {kind === 'document' && (
        <>
          {detected && (
            <div className="intake-detected">
              <p>
                Extracted suggestion: {detected.role} · {detected.fund || 'Fund not established'}
                {detected.declaredVersion ? ` · ${detected.declaredVersion}` : ''}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  set({
                    fund: detected.fund || '',
                    role: detected.role || '',
                    declaredVersion: detected.declaredVersion || '',
                    closing: detected.closing || '',
                  })
                }
              >
                Copy suggested identity
              </button>
            </div>
          )}
          <div className="intake-fields">
            {field('Fund / vehicle', 'fund', { placeholder: 'Legal fund or vehicle name' })}
            <label>
              Document role
              <select
                aria-label="Document role"
                value={value.role || ''}
                onChange={(e) => set({ role: e.target.value })}
              >
                <option value="">Not specified</option>
                {[
                  'subscription agreement',
                  'subscription booklet',
                  'questionnaire',
                  'memorandum',
                  'partnership agreement',
                  'side letter',
                  'supporting document',
                ].map((role) => (
                  <option key={role} value={role}>
                    {role[0].toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {field('Stated version / effective date', 'declaredVersion', {
              placeholder: 'For example, 2.1 or 2026-11-01',
            })}
            {field('Closing', 'closing', { placeholder: 'For example, November 2026 closing' })}
            <label>
              Package status
              <select
                aria-label={
                  kind === 'document'
                    ? 'Package status'
                    : kind === 'decision'
                      ? 'Recorded state'
                      : 'Progress'
                }
                value={value.status || 'current'}
                onChange={(e) => set({ status: e.target.value })}
              >
                <option value="current">Current for this review</option>
                <option value="reference">Supporting / reference source</option>
                <option value="superseded">Superseded</option>
              </select>
            </label>
            <label>
              Attachment belongs to
              <select
                aria-label="Attachment belongs to"
                value={value.parentDocumentId || ''}
                onChange={(e) => set({ parentDocumentId: e.target.value })}
              >
                <option value="">No parent declared</option>
                {documents
                  .filter((d) => d.id !== value.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="intake-help">
            Identity and parent links are analyst declarations supported by the citation below. They
            do not establish a legal hierarchy.
          </p>
        </>
      )}
      {kind === 'decision' && (
        <>
          <p className="question-editor-guide">
            Choose a step. Your edits stay here as you switch; use Save below to keep them.
          </p>
          <nav className="decision-steps" aria-label="Answer steps">
            {[
              ['question', 'Question'],
              ['response', 'Answer'],
              ['approval', 'Internal approval'],
            ].map(([id, label], i) => (
              <button
                key={id}
                type="button"
                aria-current={step === id ? 'step' : undefined}
                onClick={() => {
                  setStep(id);
                  setError('');
                  setResponseError('');
                }}
              >
                <span>{i + 1}</span>
                {label}
              </button>
            ))}
          </nav>
          {(step !== 'question' ||
            effective?.effectiveRoutingStatus === 'needs-reconfirmation' ||
            (effective?.dependencyState && effective.dependencyState.status !== 'current')) && (
            <QuestionSourceNotice
              value={value}
              documents={documents}
              findings={findings}
              effective={effective}
            />
          )}
          <div className="intake-fields">
            {field('Question title', 'title', {
              required: true,
              wide: true,
              placeholder: 'Name the question or requirement',
            })}
          </div>
          {step === 'approval' && (
            <aside className="decision-response-summary">
              <strong>Question being answered</strong>
              <p>{value.question || 'Add the question text before recording approval.'}</p>
              <button className="text-button" type="button" onClick={() => setStep('question')}>
                Edit question
              </button>
              <strong>Response to review</strong>
              <p>
                {value.response?.text ||
                  'No response recorded. Complete Record response before approval.'}
              </p>
              <small>
                {[value.response?.author, value.response?.channel, value.response?.reference]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
              <button className="text-button" type="button" onClick={() => setStep('response')}>
                Review response →
              </button>
            </aside>
          )}
          {step === 'response' ? (
            <div className="decision-response-workspace">
              <DecisionEvidence
                value={value}
                findings={findings}
                documents={documents}
                preferredEvidence={preferredEvidence}
                onOpenSource={onOpenSource}
                onOpenFinding={onOpenFinding}
              />
              <div className="question-answer-form">
                <DecisionFields
                  value={value}
                  set={set}
                  documents={documents}
                  step={step}
                  responseError={responseError}
                />
              </div>
            </div>
          ) : (
            <DecisionFields value={value} set={set} documents={documents} step={step} />
          )}
          <details className="decision-extra">
            <summary>Linked findings &amp; reviewer notes</summary>
            <CheckPicker
              title="Related findings"
              items={findings}
              value={value.findingIds}
              onChange={(ids) => set({ findingIds: ids })}
              empty="No findings recorded yet."
              describe={findingStatus}
            />
            <details className="decision-extra">
              <summary>Reviewer resolution · optional</summary>
              <div className="intake-fields">
                {field('Reviewer resolution and applicable scope', 'answer', {
                  area: true,
                  wide: true,
                  placeholder: 'Answer, covered population and conditions',
                })}
                {field('Resolution reviewer', 'owner', {
                  placeholder: 'Responsible person or team',
                })}
              </div>
            </details>
          </details>
        </>
      )}
      {kind === 'requirement' && (
        <>
          <div className="intake-fields">
            {field('Required / referenced item', 'label', {
              required: true,
              wide: true,
              placeholder: 'For example, Exhibit D — beneficial ownership',
            })}
            <label>
              Rule check
              <select
                aria-label="Rule check"
                value={value.check || 'document'}
                onChange={(e) => set({ check: e.target.value })}
              >
                <option value="document">Required document</option>
                <option value="field">Required form field</option>
                <option value="version">Approved document version</option>
                <option value="alias">Approved party alias</option>
                <option value="vocabulary">Approved word or abbreviation</option>
              </select>
            </label>
            {value.check === 'field' && (
              <>
                {field('Alternative field labels (comma separated)', 'aliases')}
                {field('Investor category', 'investorType', {
                  placeholder: 'individual or entity',
                })}
                {field('Share class', 'shareClass', { placeholder: 'AA' })}
              </>
            )}
            {value.check === 'version' &&
              field('Approved version label', 'expectedVersion', {
                required: true,
                placeholder: 'September 2025',
              })}
            {value.check === 'alias' && (
              <>
                {field('Canonical legal name', 'canonicalName', { required: true })}
                {field('Party role', 'partyRole', { placeholder: 'administrator' })}
              </>
            )}
            <label>
              Package relationship
              <select
                aria-label="Package relationship"
                value={value.relationship || 'attached'}
                onChange={(e) => set({ relationship: e.target.value })}
              >
                {Object.entries(relationshipNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {field('Responsible owner', 'owner', {
              placeholder: 'Who supplies or confirms this item?',
            })}
            <label className="intake-wide">
              {['field', 'version'].includes(value.check) ? 'Form to check' : 'Supplied document'}
              <select
                aria-label="Supplied document"
                value={value.documentId || ''}
                onChange={(e) => set({ documentId: e.target.value })}
              >
                <option value="">Not supplied / no package file</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="intake-help">
            Record whether a reference is expected in this package or intentionally external. This
            does not establish that a reference is legally satisfied. Rule checks use a current
            literal source citation. For fields, select the form to search; blank labeled fields
            count as present. For aliases, enter the alias as the item and its approved legal name.
          </p>
        </>
      )}
      {kind === 'decision' && step !== 'approval' ? (
        <details className="decision-extra">
          <summary>Supporting source · check before approval</summary>
          <SourceEditor
            value={value.source}
            onChange={(source) => set({ source })}
            documents={documents}
            onOpen={onOpenSource}
          />
        </details>
      ) : (
        <SourceEditor
          value={value.source}
          approvalRequired={kind === 'decision' && step === 'approval'}
          onChange={(source) => set({ source })}
          documents={documents}
          onOpen={onOpenSource}
        />
      )}
      {error && (
        <div className="intake-error" role="alert">
          <strong>Check the required details</strong>
          <ul>
            {error.split(/(?<=\.)\s+/).map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {kind === 'decision' && step === 'approval' && (
        <p className="intake-help">Save draft keeps these details without recording approval.</p>
      )}
      <div className="intake-editor-actions">
        {onDelete && (
          <button type="button" className="text-button intake-delete" onClick={onDelete}>
            <Trash2 size={15} />
            {kind === 'document' ? 'Clear declaration' : 'Remove entry'}
          </button>
        )}
        <div>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={
              kind === 'requirement' || (kind === 'decision' && step === 'approval')
                ? 'button'
                : 'button primary'
            }
          >
            <Save size={15} />
            {kind === 'decision'
              ? step === 'question'
                ? 'Save question'
                : step === 'response'
                  ? 'Save response'
                  : 'Save draft'
              : kind === 'document'
                ? 'Save identity'
                : 'Save entry'}
          </button>
          {kind === 'decision' && step === 'approval' && (
            <button type="submit" name="action" value="approve" className="button primary">
              Record internal approval
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function ContextSection({
  id,
  title,
  description,
  count,
  children,
  icon: Icon,
  addLabel,
  onAdd,
  open,
}) {
  return (
    <details className="intake-section" id={id} open={open}>
      <summary>
        <Icon size={19} />
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="intake-count">{count}</span>
      </summary>
      <div className="intake-section-body">
        {onAdd && (
          <div className="intake-section-actions">
            <button type="button" className="button" onClick={onAdd}>
              <Plus size={15} />
              {addLabel}
            </button>
          </div>
        )}
        {children}
      </div>
    </details>
  );
}

function QuestionsQueue({
  packageId,
  context,
  findings,
  operations,
  documents,
  editor,
  editForm,
  begin,
  onCancel,
  onOpenFinding,
  sourceProps,
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const linkedIds = new Set(context.decisions.flatMap((item) => array(item.findingIds)));
  const rows = [
    ...context.decisions.map((item) => {
      const effective = operations.decisions.find((row) => row.id === item.id);
      const status = effective?.effectiveRoutingStatus;
      return {
        item,
        effective,
        key: item.id,
        title: item.title || 'Untitled question',
        question: item.question,
        group:
          status === 'approved'
            ? 'approved'
            : item.response?.text?.trim()
              ? 'review'
              : 'unanswered',
        label:
          status === 'approved'
            ? 'Internally approved'
            : status === 'needs-reconfirmation'
              ? 'Approval needs recheck'
              : item.response?.text?.trim()
                ? 'Answer saved'
                : 'Needs an answer',
      };
    }),
    ...findings
      .filter(
        (finding) =>
          findingCopy(finding).question?.trim() &&
          finding.status !== 'dismissed' &&
          !linkedIds.has(finding.id),
      )
      .map((finding) => ({
        finding,
        key: `finding-${finding.id}`,
        title: findingCopy(finding).title,
        question: findingCopy(finding).question,
        group: 'unanswered',
        label: 'Needs an answer',
      })),
  ];
  const filters = [
    ['all', 'All questions'],
    ['unanswered', 'Needs an answer'],
    ['review', 'Answer saved'],
    ['approved', 'Internally approved'],
  ];
  const visible = rows.filter(
    (row) =>
      (filter === 'all' || row.group === filter) &&
      `${row.title} ${row.question || ''} ${row.item?.response?.text || ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [packageId, query, filter]);
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);
  function open(row, step = 'response') {
    if (row.item) return begin('decision', row.item, step);
    const finding = row.finding;
    const evidence = finding.evidence?.[0];
    begin(
      'decision',
      {
        id: crypto.randomUUID(),
        title: row.title,
        question: row.question,
        answer: '',
        owner: '',
        status: 'proposed',
        findingIds: [finding.id],
        source: evidence
          ? {
              documentId: evidence.documentId,
              documentVersion: evidence.documentVersion,
              page: evidence.page,
              quote: evidence.text,
            }
          : emptySource(),
      },
      step,
      evidence,
    );
  }
  return (
    <section id="context-decisions" className="questions-desk" aria-label="Questions and answers">
      <header className="questions-heading">
        <div>
          <h2>Questions</h2>
          <p>
            {editor ? (
              'Record the response, then review internal approval separately.'
            ) : (
              <>
                Select <strong>Record answer</strong> to save a response. Internal approval is
                recorded separately.
              </>
            )}
          </p>
        </div>
        {!editor && (
          <button className="button" onClick={() => begin('decision', null, 'question')}>
            <Plus size={16} />
            New question
          </button>
        )}
      </header>
      {editor ? (
        <>
          <button className="text-button question-back" onClick={onCancel}>
            Back to questions · discard unsaved edits
          </button>
          {editForm}
        </>
      ) : (
        <>
          <div className="questions-toolbar">
            <div className="questions-filters" role="group" aria-label="Filter questions">
              {filters.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <span>
                    {key === 'all' ? rows.length : rows.filter((row) => row.group === key).length}
                  </span>
                </button>
              ))}
            </div>
            <label className="questions-search">
              Find a question
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search questions or answers"
              />
            </label>
          </div>
          <div className="questions-list" aria-label="Question list">
            {pageRows.map((row) => (
              <article className="question-row" key={row.key}>
                <div className="question-row-heading">
                  <h3>{row.title}</h3>
                  <span className={`question-state ${row.group}`}>{row.label}</span>
                </div>
                <p className="question-wording">
                  {row.question || 'Question text has not been added yet.'}
                </p>
                {row.item?.response?.text && (
                  <div className="question-saved-answer">
                    <strong>Recorded answer</strong>
                    <p>{row.item.response.text}</p>
                    {row.item.response.author && (
                      <small>
                        From {row.item.response.author}
                        {row.item.response.receivedAt ? ` · ${row.item.response.receivedAt}` : ''}
                      </small>
                    )}
                  </div>
                )}
                {row.effective?.effectiveRoutingStatus === 'needs-reconfirmation' && (
                  <p className="question-recheck">
                    The answer or its sources changed. Review them before recording internal
                    approval again.
                  </p>
                )}
                <div className="question-row-actions">
                  <button className="button" onClick={() => open(row)}>
                    {row.group === 'unanswered' ? 'Record answer' : 'Edit answer'}
                  </button>
                  {row.item?.response?.text && (
                    <button className="button" onClick={() => open(row, 'approval')}>
                      {row.group === 'approved'
                        ? 'View internal approval'
                        : 'Review internal approval'}
                    </button>
                  )}
                  <button className="text-button" onClick={() => open(row, 'question')}>
                    Edit question
                  </button>
                  {row.finding && (
                    <button className="text-button" onClick={() => onOpenFinding?.(row.finding.id)}>
                      View finding <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
                {row.item && <DependencyStatus row={row.effective} />}
                {row.item && sourceState(row.item.source, documents).status !== 'current' && (
                  <p className="question-recheck">
                    Supporting source needs review: {sourceState(row.item.source, documents).reason}{' '}
                    Open the answer to check its supporting source.
                  </p>
                )}
                {row.item && (
                  <details className="question-record-details">
                    <summary>Sources, response details &amp; history</summary>
                    <dl className="question-record-facts">
                      {[
                        ['Provided by', row.item.response?.author],
                        ['Received via', row.item.response?.channel],
                        ['Received on', row.item.response?.receivedAt],
                        ['Reference', row.item.response?.reference],
                        ['Recorded by', row.item.response?.recordedBy],
                        ['Assigned to', row.item.assignedTo],
                        ['Reviewer resolution', row.item.answer],
                        ['Resolution reviewer', row.item.owner],
                      ]
                        .filter(([, value]) => value)
                        .map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                    {row.item.approval && (
                      <p>
                        Internal approval recorded by {row.item.approval.recordedBy} ·{' '}
                        {row.item.approval.approvedAt}
                        <br />
                        Applies to: {row.item.approval.applicability?.vehicle} ·{' '}
                        {row.item.approval.applicability?.investorRoute}
                        <br />
                        {row.item.approval.rationale}
                      </p>
                    )}
                    <SourceStatus source={row.item.source} {...sourceProps} />
                    {array(row.item.findingIds).map((id) => (
                      <button key={id} className="text-button" onClick={() => onOpenFinding?.(id)}>
                        View linked finding:{' '}
                        {findingCopy(findings.find((finding) => finding.id === id) || {}).title ||
                          'Unavailable finding'}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                    {row.item.history?.length > 0 && (
                      <details>
                        <summary>Previous records · {row.item.history.length}</summary>
                        {row.item.history.map((entry, index) => (
                          <div className="question-history-entry" key={index}>
                            <p>
                              {entry.recordedAt} · {entry.reason}
                            </p>
                            <p>Prior response: {entry.response?.text}</p>
                            <p>
                              {entry.response?.author} · {entry.response?.channel} ·{' '}
                              {entry.response?.reference}
                            </p>
                            <p>
                              Prior approval: {entry.approval?.recordedBy} ·{' '}
                              {entry.approval?.approvedAt} ·{' '}
                              {entry.approval?.applicability?.vehicle} ·{' '}
                              {entry.approval?.applicability?.investorRoute}
                            </p>
                          </div>
                        ))}
                      </details>
                    )}
                    <button
                      className="button"
                      onClick={() => downloadQuestion(row.item, documents)}
                    >
                      Download question
                    </button>
                  </details>
                )}
              </article>
            ))}
            {!visible.length && (
              <div className="questions-empty">
                <h3>{!rows.length ? 'No questions yet' : 'No matching questions'}</h3>
                <p>
                  {!rows.length
                    ? 'Questions from Review appear here. You can also add a question directly with New question.'
                    : 'Try another status or clear your search to see more questions.'}
                </p>
                {!!rows.length && (
                  <button
                    className="button"
                    onClick={() => {
                      setFilter('all');
                      setQuery('');
                    }}
                  >
                    Show all questions
                  </button>
                )}
              </div>
            )}
          </div>
          <Pagination
            page={currentPage}
            total={visible.length}
            itemName="questions"
            label="Questions pagination"
            onPageChange={setPage}
          />
          <p className="questions-footnote">
            Saving an answer and recording internal approval are separate actions. Approval names
            are entered manually and are not verified.
          </p>
        </>
      )}
    </section>
  );
}

function ReviewContextRecords({
  mode,
  pkg,
  analysis,
  onChange,
  onOpenSource,
  onOpenFinding,
  decisionRequest,
  onDecisionRequestHandled,
}) {
  const context = useMemo(() => normalizeIntakeContext(pkg.intakeContext), [pkg.intakeContext]),
    operations = useMemo(() => operationalContext(pkg, analysis), [pkg, analysis]);
  const [editor, setEditor] = useState(null),
    [saved, setSaved] = useState('');
  const documents = pkg.documents || [],
    findings = pkg.findings || [];
  useEffect(() => {
    setEditor(null);
    setSaved('');
  }, [pkg.id]);
  function begin(kind, item, step, preferredEvidence) {
    let value = item;
    if (kind === 'document')
      value = {
        id: item.id,
        fund: '',
        role: '',
        declaredVersion: '',
        closing: '',
        parentDocumentId: '',
        status: 'current',
        source: sourceFor(item),
        ...context.documents[item.id],
      };
    if (!value) {
      const defaults = {
        decision: { title: '', answer: '', owner: '', status: 'proposed', findingIds: [] },
        requirement: { label: '', relationship: 'attached', documentId: '', owner: '' },
      };
      value = { id: crypto.randomUUID(), ...defaults[kind], source: emptySource() };
    }
    setSaved('');
    setEditor({
      kind,
      value,
      isNew: !item || (!context.decisions.some((d) => d.id === item?.id) && kind === 'decision'),
      step,
      preferredEvidence,
      requestId: crypto.randomUUID(),
    });
    requestAnimationFrame(() =>
      document
        .getElementById('context-editor')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }
  useEffect(() => {
    if (mode !== 'questions' || !decisionRequest) return;
    onDecisionRequestHandled?.();
    const f = findings.find((f) => f.id === decisionRequest.findingId);
    if (
      editor?.kind === 'decision' &&
      (decisionRequest.decisionId
        ? editor.value.id === decisionRequest.decisionId
        : f && array(editor.value.findingIds).includes(f.id))
    ) {
      setEditor((current) => ({
        ...current,
        step: decisionRequest.stage,
        preferredEvidence: decisionRequest.evidence || current.preferredEvidence,
        requestId: decisionRequest.id,
      }));
      return;
    }
    const existing =
      context.decisions.find((d) => d.id === decisionRequest.decisionId) ||
      context.decisions.find((d) => d.findingIds.includes(f?.id));
    if (existing) {
      begin('decision', existing, decisionRequest.stage, decisionRequest.evidence);
      return;
    }
    if (!f) {
      begin('decision', null, decisionRequest.stage);
      return;
    }
    const e = f.evidence?.find((e) => sameEvidence(e, decisionRequest.evidence)) || f.evidence?.[0],
      source = e
        ? {
            documentId: e.documentId,
            documentVersion: e.documentVersion,
            page: e.page,
            quote: e.text,
          }
        : emptySource();
    begin(
      'decision',
      {
        id: crypto.randomUUID(),
        title: findingCopy(f).title,
        question: findingCopy(f).question || '',
        answer: '',
        owner: '',
        status: 'proposed',
        findingIds: [f.id],
        source,
      },
      decisionRequest.stage,
      e,
    );
  }, [decisionRequest]);
  function save(value) {
    const key = {
      decision: 'decisions',
      requirement: 'requirements',
    }[editor.kind];
    const next =
      editor.kind === 'document'
        ? {
            ...context,
            documents: {
              ...context.documents,
              [value.id]: Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id')),
            },
          }
        : {
            ...context,
            [key]: context[key].some((item) => item.id === value.id)
              ? context[key].map((item) => (item.id === value.id ? value : item))
              : [...context[key], value],
          };
    onChange(next);
    setEditor(null);
    setSaved('Review record saved. Source checks updated.');
  }
  function remove() {
    const key = {
      decision: 'decisions',
      requirement: 'requirements',
    }[editor.kind];
    let next;
    if (editor.kind === 'document') {
      const docs = { ...context.documents };
      delete docs[editor.value.id];
      next = { ...context, documents: docs };
    } else next = { ...context, [key]: context[key].filter((item) => item.id !== editor.value.id) };
    onChange(next);
    setEditor(null);
    setSaved('Review record removed.');
  }
  const editForm = (kind) =>
    editor?.kind === kind ? (
      <Editor
        key={`${kind}-${editor.value.id}`}
        kind={kind}
        initial={editor.value}
        effective={operations.decisions.find((item) => item.id === editor.value.id)}
        initialStep={editor.step}
        requestId={editor.requestId}
        documents={documents}
        findings={findings}
        metadataIssues={analysis.context?.metadataIssues || []}
        sourceDocuments={analysis.context?.documents || []}
        detected={
          kind === 'document'
            ? analysis.context?.documents.find((d) => d.documentId === editor.value.id)
            : null
        }
        onCancel={() => setEditor(null)}
        onSave={save}
        onDelete={
          !editor.isNew && (kind !== 'document' || context.documents[editor.value.id])
            ? remove
            : undefined
        }
        onOpenSource={onOpenSource}
        onOpenFinding={onOpenFinding}
        preferredEvidence={editor.preferredEvidence}
      />
    ) : null;
  const EditButton = ({ kind, item, label }) => (
    <button
      type="button"
      className="button intake-edit"
      aria-label={`Edit ${label}`}
      onClick={() => begin(kind, item)}
    >
      <Pencil size={14} />
      <span>Edit</span>
    </button>
  );
  const sourceProps = { documents, onOpen: onOpenSource };
  return (
    <section
      className={`context-workspace${mode === 'questions' ? ' questions-workspace' : ''}`}
      aria-label={mode === 'documents' ? 'Document declarations' : 'Clarification records'}
    >
      {mode === 'documents' && analysis.context?.metadataIssues?.length > 0 && (
        <aside
          className="notice intake-metadata-issues"
          aria-label="Document identity needs review"
        >
          <strong>Document identity needs review</strong>
          {analysis.context.metadataIssues.map((issue, i) => (
            <p key={i}>
              {documents.find((d) => d.id === issue.documentId)?.name}: {issue.reason}
            </p>
          ))}
        </aside>
      )}
      {saved && (
        <p className="intake-saved" role="status">
          <Check size={15} />
          {saved}
        </p>
      )}
      {mode === 'documents' && (
        <ContextSection
          id="context-documents"
          title="Document identity & review requirements"
          description="Document identity, versions, attachment parents and expected sources"
          count={documents.length}
          icon={FileText}
          open={true}
        >
          {editForm('document')}
          <div className="intake-list">
            {documents.map((doc) => {
              const declared = context.documents[doc.id],
                detected = analysis.context?.documents.find((d) => d.documentId === doc.id);
              return (
                <article className="intake-card" key={doc.id}>
                  <div className="intake-card-top">
                    <div>
                      <h3>{doc.name}</h3>
                      <p>
                        Uploaded v{doc.version}
                        {declared
                          ? ` · ${declared.status || 'current'}`
                          : ' · Identity not declared'}
                      </p>
                    </div>
                    <EditButton kind="document" item={doc} label={`identity for ${doc.name}`} />
                  </div>
                  {declared ? (
                    <>
                      <p>
                        {[
                          declared.role,
                          declared.fund,
                          declared.declaredVersion && `Stated version ${declared.declaredVersion}`,
                          declared.closing,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No identity fields recorded.'}
                      </p>
                      {declared.parentDocumentId && (
                        <p>
                          Attachment to{' '}
                          {documents.find((d) => d.id === declared.parentDocumentId)?.name ||
                            'unavailable document'}
                        </p>
                      )}
                      <SourceStatus source={declared.source} {...sourceProps} />
                    </>
                  ) : (
                    detected && (
                      <p className="intake-help">
                        Extracted: {detected.role} · {detected.fund || 'Fund not established'}.
                        Review before declaring.
                      </p>
                    )
                  )}
                </article>
              );
            })}
          </div>
          <div className="intake-subheading">
            <div>
              <h3>Package requirements and rule configuration</h3>
              <p>
                Record required documents, form fields, versions, approved aliases and vocabulary
                with their sources.
              </p>
            </div>
            <button type="button" className="button" onClick={() => begin('requirement')}>
              <Plus size={15} />
              Add requirement
            </button>
          </div>
          {editForm('requirement')}
          {context.requirements.length ? (
            <div className="intake-list">
              {context.requirements.map((item) => (
                <article className="intake-card" key={item.id}>
                  <div className="intake-card-top">
                    <div>
                      <h3>{item.label}</h3>
                      <p>
                        {item.check || 'document'} · {relationshipNames[item.relationship]} ·{' '}
                        {item.owner || 'Owner not recorded'}
                      </p>
                    </div>
                    <EditButton kind="requirement" item={item} label={item.label} />
                  </div>
                  <p>
                    {item.check === 'alias'
                      ? `Approved name: ${item.canonicalName || 'Not recorded'}`
                      : item.check === 'vocabulary'
                        ? 'Approved word or abbreviation for this package.'
                        : item.documentId
                          ? documents.find((d) => d.id === item.documentId)?.name ||
                            'Linked document is unavailable'
                          : item.relationship === 'attached'
                            ? 'No package file linked. The rule also searches identifiable embedded sections.'
                            : 'No package file linked.'}
                  </p>
                  <SourceStatus source={item.source} {...sourceProps} />
                  <DependencyStatus row={operations.requirements.find((r) => r.id === item.id)} />
                </article>
              ))}
            </div>
          ) : (
            <p className="intake-empty">Add expected documents or record intentional exclusions.</p>
          )}
        </ContextSection>
      )}
      {mode === 'questions' && (
        <QuestionsQueue
          packageId={pkg.id}
          context={context}
          findings={findings}
          operations={operations}
          documents={documents}
          editor={editor}
          editForm={editForm('decision')}
          begin={begin}
          onCancel={() => setEditor(null)}
          onOpenFinding={onOpenFinding}
          sourceProps={sourceProps}
        />
      )}
    </section>
  );
}

export function DocumentContextPanel(props) {
  return <ReviewContextRecords {...props} mode="documents" />;
}

export function ClarificationPanel(props) {
  return <ReviewContextRecords {...props} mode="questions" />;
}
