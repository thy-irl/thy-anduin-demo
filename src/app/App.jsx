import React, { useState, useEffect, useRef, useMemo } from 'react';
import Pagination from '../components/Pagination.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { priorityOf, priorityOptions, priorityDescriptions } from '../features/review/priority.js';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  CircleCheck,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  RotateCcw,
} from 'lucide-react';
import { documentReferences } from '../features/documents/references.js';
import { makeDemoPackages, addDemoPackages, DEMO_PACKAGE_IDS } from '../features/documents/demo.js';
import { RecordTrace } from '../features/review/components/RecordTrace/RecordTrace.jsx';
import { describeFinding, findingDetails } from '../features/analysis/finding.js';
import { findingCopy } from '../features/analysis/copy.js';
import { analyze, analyzePackage, mergeFindings } from '../features/analysis/engine.js';
import { parseFile, failedFile } from '../features/documents/parser.js';
import { coverageOf, packageCoverage } from '../features/analysis/coverage.js';
import { OriginalPage } from '../features/documents/components/OriginalPage/OriginalPage.jsx';
import { CoveragePanel } from '../features/documents/components/CoveragePanel/CoveragePanel.jsx';
import { InventoryPanel } from '../features/documents/components/InventoryPanel/InventoryPanel.jsx';
import { AnalysisDownload } from '../features/documents/components/AnalysisDownload/AnalysisDownload.jsx';
import {
  migrateReviewState,
  statusNames,
  findingDispositionError,
  reportFindings,
  reportData,
  reportMarkdown,
} from '../features/review/review.js';
import {
  normalizeIntakeContext,
  operationalContext,
  reconcileFindingLinks,
} from '../features/context/intake.js';
import {
  DocumentContextPanel,
  ClarificationPanel,
} from '../features/context/components/ReviewContext/ReviewContext.jsx';
import { ManualIssueDialog } from '../features/review/components/ManualIssueDialog/ManualIssueDialog.jsx';
import { compareRevision } from '../features/review/revisions.js';
import { RevisionPanel } from '../features/review/components/RevisionPanel/RevisionPanel.jsx';
import {
  evaluateReadiness,
  recordReadinessAcknowledgement,
} from '../features/readiness/readiness.js';
import { ReadinessPanel } from '../features/readiness/components/ReadinessPanel/ReadinessPanel.jsx';
import { findingQueueStatus, readinessLabels, decisionStatusNames } from '../lib/workflow.js';
import {
  findingReviewGuidance,
  findingReviewExplanation,
} from '../features/review/presentation.js';
import './App.css';
import './workflow.css';
import './desk.css';
import './palette.css';
const STORAGE = 'anduin-preflight-v1';
function BrowserStorageHint() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;
  return (
    <span
      className="browser-storage-hint"
      tabIndex={0}
      aria-describedby={open ? 'browser-storage-tooltip' : undefined}
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        setFocused(true);
        setDismissed(false);
      }}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setDismissed(true);
      }}
    >
      Packages in this browser
      {open && (
        <span id="browser-storage-tooltip" role="tooltip" className="browser-storage-tooltip">
          Files and package data are stored locally in this browser profile on this device. Clearing
          this site’s browser data removes them.
        </span>
      )}
    </span>
  );
}

function recheckPackage(pkg, documents = pkg.documents, intakeContext = pkg.intakeContext) {
  const findings = mergeFindings(pkg.findings, analyze(documents, intakeContext));
  return { findings, intakeContext: reconcileFindingLinks(intakeContext, findings) };
}
const formatDate = (d) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
const prettyBytes = (n) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE));
    if (
      s?.packages?.length &&
      s.packages.every((p) => Array.isArray(p.documents) && Array.isArray(p.findings))
    )
      return migrateReviewState(s);
  } catch {}
  return migrateReviewState({ packages: makeDemoPackages(), activeId: DEMO_PACKAGE_IDS[0] });
}
function Badge({ children, kind = 'neutral' }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
function IconButton({ children, label, ...props }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
function download(name, content, type = 'text/markdown') {
  const a = document.createElement('a'),
    url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useDialog(onClose, blocked = false) {
  useEffect(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const previous = document.activeElement;
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      ).filter((e) => e.offsetParent !== null);
    if (!dialog.contains(document.activeElement)) focusables()[0]?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!blocked) onClose();
      }
      if (e.key === 'Tab') {
        const items = focusables(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (previous?.isConnected) previous.focus();
    };
  }, [blocked]);
}
export default function App() {
  const [state, setState] = useState(loadState),
    [nav, setNav] = useState('package'),
    [tab, setTab] = useState('review'),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [severity, setSeverity] = useState('all'),
    [reviewPage, setReviewPage] = useState(1),
    [selectedId, setSelectedId] = useState(null),
    [reviewSource, setReviewSource] = useState(null),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [running, setRunning] = useState(false),
    [exportingSummary, setExportingSummary] = useState(false),
    [summaryError, setSummaryError] = useState(''),
    [storageState, setStorageState] = useState('saving'),
    [showGaps, setShowGaps] = useState(false),
    [decisionRequest, setDecisionRequest] = useState(null);
  const pkg = state.packages.find((p) => p.id === state.activeId) || state.packages[0];
  const analysis = useMemo(
    () => analyzePackage(pkg.documents, pkg.intakeContext),
    [pkg.documents, pkg.intakeContext],
  );
  const operations = useMemo(() => operationalContext(pkg, analysis), [pkg, analysis]);
  const readiness = useMemo(() => evaluateReadiness(pkg, analysis), [pkg, analysis]);
  const references = useMemo(
    () => documentReferences(analysis, pkg.documents, readiness),
    [analysis, pkg.documents, readiness],
  );
  const pending = pkg.findings.filter((f) =>
    ['open', 'needs-verification'].includes(f.status),
  ).length;
  const selected = pkg.findings.find((f) => f.id === selectedId);
  const included = reportFindings(pkg);
  const questionRecords = normalizeIntakeContext(pkg?.intakeContext).decisions;
  const linkedQuestionFindings = new Set(questionRecords.flatMap((item) => item.findingIds));
  const questionCount =
    questionRecords.length +
    (pkg?.findings || []).filter(
      (finding) =>
        findingCopy(finding).question?.trim() &&
        finding.status !== 'dismissed' &&
        !linkedQuestionFindings.has(finding.id),
    ).length;
  const filtered = pkg.findings.filter(
    (f) =>
      (filter === 'all' ||
        (filter === 'open' && ['open', 'needs-verification'].includes(f.status)) ||
        (filter === 'report' && f.includeInReport) ||
        (filter === 'closed' && ['resolved', 'dismissed'].includes(f.status))) &&
      (severity === 'all' || priorityOf(f.severity) === severity) &&
      `${findingCopy(f).title} ${findingCopy(f).description} ${describeFinding(f)} ${f.checkId || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const reviewPageSize = 5;
  const reviewPageCount = Math.max(1, Math.ceil(filtered.length / reviewPageSize));
  const currentReviewPage = Math.min(reviewPage, reviewPageCount);
  const reviewPageStart = (currentReviewPage - 1) * reviewPageSize;
  const visibleFindings = filtered.slice(reviewPageStart, reviewPageStart + reviewPageSize);
  useEffect(() => {
    setReviewPage(1);
  }, [pkg.id, query, filter, severity]);
  useEffect(() => {
    setReviewPage((page) => Math.min(page, reviewPageCount));
  }, [reviewPageCount]);
  const reviewIds = filtered.some((f) => f.id === selectedId)
    ? filtered.map((f) => f.id)
    : pkg.findings.map((f) => f.id);
  const selectedIndex = reviewIds.indexOf(selectedId);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      setStorageState('saved');
    } catch {
      setStorageState('error');
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  function updatePkg(fn) {
    setStorageState('saving');
    setState((s) => ({ ...s, packages: s.packages.map((p) => (p.id === pkg.id ? fn(p) : p)) }));
  }
  const log = (p, text) => [
    { id: crypto.randomUUID(), text, time: new Date().toISOString() },
    ...(p.activity || []),
  ];
  function editFinding(id, patch) {
    updatePkg((p) => ({
      ...p,
      findings: p.findings.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }
  function recordEdit(id) {
    updatePkg((p) => ({
      ...p,
      findings: p.findings.map((f) =>
        f.id === id
          ? {
              ...f,
              history: [
                ...(f.history || []),
                {
                  event: 'Reviewer edited question / note (autosaved)',
                  time: new Date().toISOString(),
                },
              ],
            }
          : f,
      ),
      activity: log(p, 'Question / reviewer note updated'),
    }));
  }
  function changeStatus(id, status) {
    updatePkg((p) => {
      const f = p.findings.find((f) => f.id === id);
      if (!f || findingDispositionError(f, status)) return p;
      return {
        ...p,
        findings: p.findings.map((f) =>
          f.id === id
            ? {
                ...f,
                status,
                history: [
                  ...(f.history || []),
                  {
                    event: `Reviewer selected ${statusNames[status]}`,
                    time: new Date().toISOString(),
                    ...(status === 'dismissed' ? { rationale: f.note?.trim() || '' } : {}),
                  },
                ],
              }
            : f,
        ),
        activity: log(p, `${findingCopy(f).title} · ${statusNames[status]}`),
      };
    });
  }
  function toggleReport(id, checked) {
    updatePkg((p) => ({
      ...p,
      findings: p.findings.map((f) =>
        f.id === id
          ? {
              ...f,
              includeInReport: checked,
              history: [
                ...(f.history || []),
                {
                  event: checked ? 'Selected for download' : 'Removed from download',
                  time: new Date().toISOString(),
                },
              ],
            }
          : f,
      ),
      activity: log(
        p,
        checked ? 'Question selected for download' : 'Question removed from download',
      ),
    }));
  }
  function selectPackage(id) {
    setState((s) => ({ ...s, activeId: id }));
    setSelectedId(null);
    setFilter('all');
    setSeverity('all');
    setQuery('');
    setTab('review');
    setNav('package');
    setShowGaps(false);
  }
  function navigateTab(next, section) {
    // Compatibility for existing Review controls; the retired screen has no route.
    setTab(next === 'context' ? 'documents' : next);
    setNav('package');
    requestAnimationFrame(() => {
      const target = section && document.getElementById(section);
      if (target?.tagName === 'DETAILS') target.open = true;
      (target || document.querySelector('.package-tabs'))?.scrollIntoView({ block: 'start' });
    });
  }
  function openDecision(request) {
    setSelectedId(null);
    setDecisionRequest({ ...request, id: crypto.randomUUID() });
    navigateTab('report');
  }
  function viewGaps() {
    setTab('documents');
    setShowGaps(true);
  }
  const coverageMessage = (c) =>
    c.pagesWithGaps
      ? `${c.pagesWithGaps} ${c.pagesWithGaps === 1 ? 'page needs' : 'pages need'} verification`
      : c.status === 'incomplete'
        ? `${c.files.filter((f) => f.status !== 'fully analyzed').length} ${c.files.filter((f) => f.status !== 'fully analyzed').length === 1 ? 'file needs' : 'files need'} verification`
        : 'Readable text checked';
  async function rerun() {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 150));
    updatePkg((p) => ({
      ...p,
      ...recheckPackage(p),
      lastRun: new Date().toISOString(),
      activity: log(p, 'Analysis rerun; review decisions retained where evidence is unchanged'),
    }));
    setRunning(false);
    setToast(`Analysis finished — ${coverageMessage(analysis.coverage).toLowerCase()}.`);
  }
  function updateContext(value) {
    const intakeContext = normalizeIntakeContext(value);
    updatePkg((p) => ({
      ...p,
      intakeContext,
      ...recheckPackage(p, p.documents, intakeContext),
      lastRun: new Date().toISOString(),
      activity: log(p, 'Structured context updated; matching and source-bound decisions rechecked'),
    }));
    setToast('Context saved and preflight rechecked.');
  }
  function acknowledgeReadiness(options) {
    const readinessReview = recordReadinessAcknowledgement(pkg, analysis, options);
    updatePkg((p) => ({
      ...p,
      readinessReview,
      activity: log(
        p,
        'Internal digitization-readiness acknowledgement recorded locally; actor identity is unauthenticated',
      ),
    }));
    setToast('Readiness acknowledgement recorded on this device.');
  }
  function addManualIssue(finding) {
    updatePkg((p) => ({
      ...p,
      findings: p.findings.some((f) => f.id === finding.id)
        ? p.findings.map((f) => (f.id === finding.id ? finding : f))
        : [...p.findings, finding],
      activity: log(p, `Analyst issue saved: ${finding.title}`),
    }));
    setModal(null);
    setTab('review');
    setFilter('all');
    setQuery('');
    setSeverity('all');
    setSelectedId(finding.id);
  }
  async function exportReviewSummary() {
    if (exportingSummary) return;
    setExportingSummary(true);
    setSummaryError('');
    try {
      const data = reportData(pkg, analysis, { allFindings: true });
      const { createReviewSummaryPdf } = await import('../features/review/pdf.js');
      const pdf = await createReviewSummaryPdf(data);
      download(
        `${pkg.name.replace(/[\/\\:*?"<>|]/g, '-')}-review-summary.pdf`,
        pdf,
        'application/pdf',
      );
      setToast('Review summary PDF downloaded.');
    } catch (error) {
      setSummaryError('The PDF could not be generated. Try downloading the review summary again.');
    } finally {
      setExportingSummary(false);
    }
  }
  function exportReport(format = 'md') {
    const data = reportData(pkg, analysis);
    if (!data.findings.length && !data.checkResults.length) return;
    download(
      `${pkg.name}-counsel-clarifications.${format}`,
      format === 'json' ? JSON.stringify(data, null, 2) : reportMarkdown(data, { demo: pkg.demo }),
      format === 'json' ? 'application/json' : 'text/markdown',
    );
    setToast(`Question download started: ${data.findings.length} selected.`);
  }
  function addDocuments(docs, name, replace = false) {
    let nextDocuments = docs;
    if (modal === 'new' && !replace) {
      const p = {
        id: crypto.randomUUID(),
        name,
        description: 'Document review package',
        documents: docs,
        intakeContext: normalizeIntakeContext(),
        revisions: [],
        findings: analyze(docs),
        createdAt: new Date().toISOString(),
        lastRun: new Date().toISOString(),
        activity: [
          {
            id: crypto.randomUUID(),
            text: `Package created · ${docs.length} documents analyzed`,
            time: new Date().toISOString(),
          },
        ],
      };
      setStorageState('saving');
      setState((s) => ({ ...s, packages: [...s.packages, p], activeId: p.id }));
      setSelectedId(null);
      setNav('package');
      setTab('documents');
      setFilter('all');
      setQuery('');
      setSeverity('all');
      setShowGaps(false);
    } else {
      nextDocuments = [...pkg.documents];
      const revisions = [];
      for (const doc of docs) {
        const idx = nextDocuments.findIndex((d) => d.name.toLowerCase() === doc.name.toLowerCase());
        if (idx >= 0) {
          const before = nextDocuments[idx],
            after = { ...doc, id: before.id, version: before.version + 1 };
          revisions.push(compareRevision(before, after));
          nextDocuments[idx] = after;
        } else nextDocuments.push(doc);
      }
      updatePkg((p) => ({
        ...p,
        demo: !!p.learningSample,
        documents: nextDocuments,
        revisions: [...(p.revisions || []), ...revisions],
        ...recheckPackage(p, nextDocuments),
        lastRun: new Date().toISOString(),
        activity: log(
          p,
          `${docs.length} document${docs.length === 1 ? '' : 's'} uploaded · package rechecked; source-bound context requires rechecking after revisions`,
        ),
      }));
    }
    setToast(
      `Analysis finished — ${coverageMessage(packageCoverage(nextDocuments)).toLowerCase()}.`,
    );
    setModal(null);
  }
  function traceEvidence(e) {
    setSelectedId(null);
    const doc = pkg.documents.find((d) => d.id === e.documentId);
    if (doc && String(doc.version) === String(e.documentVersion))
      setModal({ document: doc, page: e.page });
    else {
      const revision = pkg.revisions?.find(
        (r) => r.documentId === e.documentId && r.fromVersion === e.documentVersion,
      );
      setModal({ historical: e, revision: revision || {} });
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setNav('packages');
          }}
        >
          <span className="brand-mark">
            <CheckCheck size={22} />
          </span>{' '}
          Preflight for Anduin<small>by Thy Nguyen</small>
        </a>
        <nav aria-label="Workspace">
          <button
            className={nav === 'packages' ? 'text-button active' : 'text-button'}
            onClick={() => {
              setNav('packages');
              setSelectedId(null);
            }}
          >
            Packages
          </button>
          <button className="button primary" onClick={() => setModal('new')}>
            <Plus size={16} />
            New package
          </button>
        </nav>
      </header>
      <main className="workspace">
        {summaryError && (
          <div className="notice error" role="alert">
            {summaryError}
          </div>
        )}
        {storageState === 'error' && (
          <div className="notice error" role="alert">
            Changes couldn’t be saved in this browser. Keep this page open and download the
            available questions or review summary before closing. Downloads do not include original
            files.
          </div>
        )}
        {nav === 'packages' ? (
          <>
            <div className="page-title">
              <h1>Packages</h1>
              {DEMO_PACKAGE_IDS.some((id) => !state.packages.some((p) => p.id === id)) ? (
                <button className="button" onClick={() => setState((s) => addDemoPackages(s))}>
                  <Plus size={16} /> Add demo packages
                </button>
              ) : (
                <BrowserStorageHint />
              )}
            </div>
            <div className="package-grid">
              {state.packages.map((p) => {
                const cardAnalysis = analyzePackage(p.documents, p.intakeContext);
                const cardReadiness = evaluateReadiness(p, cardAnalysis);
                const c = cardAnalysis.coverage;
                return (
                  <button className="package-card" key={p.id} onClick={() => selectPackage(p.id)}>
                    <FolderOpen size={22} />
                    <h2>{p.name}</h2>
                    {DEMO_PACKAGE_IDS.includes(p.id) && <p>{p.description}</p>}
                    <p>
                      {p.documents.length} {p.documents.length === 1 ? 'file' : 'files'} ·{' '}
                      {
                        p.findings.filter((f) => !['resolved', 'dismissed'].includes(f.status))
                          .length
                      }{' '}
                      open findings
                    </p>
                    <span
                      className={`package-card-readiness readiness-state-${cardReadiness.state.toLowerCase()}`}
                      data-state={cardReadiness.state}
                    >
                      {readinessLabels[cardReadiness.state]}
                    </span>
                    <span
                      className={
                        c.status === 'incomplete' && cardReadiness.state !== 'READY'
                          ? 'coverage-warning'
                          : 'muted'
                      }
                    >
                      {cardReadiness.state === 'READY' && c.status === 'incomplete'
                        ? 'Coverage notes retained · manual review acknowledged'
                        : coverageMessage(c)}
                    </span>
                    {p.demo && <small>Synthetic sample</small>}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <section className="package-heading">
              <div>
                <h1>{pkg.name}</h1>
                {pkg.demo && <small>Synthetic sample package</small>}
              </div>
              <div className="package-actions">
                <button className="button" onClick={() => setModal('upload')}>
                  <Upload size={16} />
                  Add / replace files
                </button>
                <button className="button" disabled={running} onClick={rerun}>
                  <RotateCcw size={16} className={running ? 'spin' : undefined} />
                  {running ? 'Checking…' : 'Run preflight again'}
                </button>
                <details className="package-options">
                  <summary>More</summary>
                  <div>
                    <button onClick={() => setModal('history')}>Package history</button>
                  </div>
                </details>
              </div>
            </section>
            <section
              className="package-summary"
              aria-label="Package status"
              data-readiness={readiness.state}
            >
              <div>
                <button
                  className="text-button package-readiness"
                  onClick={() => navigateTab('readiness')}
                >
                  {readiness.state === 'READY' ? (
                    <CircleCheck size={15} />
                  ) : (
                    <CircleAlert size={15} />
                  )}
                  {readinessLabels[readiness.state]}
                </button>
                <span>
                  {pkg.documents.length} {pkg.documents.length === 1 ? 'file' : 'files'}
                </span>
                <span>
                  {pending} unreviewed {pending === 1 ? 'issue' : 'issues'}
                </span>
                <span>
                  {included.length} {included.length === 1 ? 'question' : 'questions'} selected
                </span>
              </div>
              <div
                className={
                  analysis.coverage.status === 'incomplete' && readiness.state !== 'READY'
                    ? 'coverage-warning'
                    : 'coverage-summary'
                }
              >
                <strong>
                  {readiness.state === 'READY' && analysis.coverage.status === 'incomplete'
                    ? 'Coverage notes retained'
                    : coverageMessage(analysis.coverage)}
                </strong>
                {analysis.coverage.status === 'incomplete' ? (
                  <button className="text-button" onClick={viewGaps}>
                    {readiness.state === 'READY' ? 'View source coverage' : 'View affected pages'}{' '}
                    <ChevronRight size={15} />
                  </button>
                ) : (
                  <span>
                    {readiness.state === 'READY'
                      ? 'Manual review acknowledged'
                      : 'Limited automated checks · manual review required'}
                  </span>
                )}
                {references.attention.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setTab('documents');
                      setTimeout(
                        () =>
                          document
                            .getElementById('reference-map')
                            ?.scrollIntoView({ block: 'start' }),
                        0,
                      );
                    }}
                  >
                    {references.attention.length}{' '}
                    {references.attention.length === 1
                      ? 'document reference needs'
                      : 'document references need'}{' '}
                    review <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </section>
            <div className="workbench">
              <nav className="package-tabs" aria-label="Package">
                <div className="workflow-tabs">
                  {[
                    ['documents', 'Documents', pkg.documents.length, FileText],
                    ['review', 'Review', pending, Search],
                    ['report', 'Questions', questionCount, FolderOpen],
                    ['readiness', 'Readiness', undefined, ShieldCheck],
                  ].map(([id, label, count, Icon]) => (
                    <button
                      key={id}
                      className={tab === id ? 'active' : ''}
                      aria-current={tab === id ? 'page' : undefined}
                      onClick={() => navigateTab(id)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {label}
                      {count !== undefined && <span>{count}</span>}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="task-content">
                {tab === 'review' && (
                  <section aria-label="Review queue">
                    <div className="queue-toolbar">
                      <label className="search-wrap">
                        <Search size={17} />
                        <input
                          aria-label="Search findings"
                          placeholder="Search findings"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <label className="filter-label">
                        <span className="sr-only">Review filter</span>
                        <select
                          aria-label="Review filter"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="all">All statuses</option>
                          <option value="open">Unreviewed</option>
                          <option value="report">Selected for download</option>
                          <option value="closed">Resolved or dismissed</option>
                        </select>
                      </label>
                      <select
                        aria-label="Priority filter"
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                      >
                        <option value="all">All priorities</option>
                        {Object.entries(priorityOptions).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <button className="button manual-add" onClick={() => setModal('manual')}>
                        <Plus size={15} />
                        Add issue
                      </button>
                    </div>
                    {!!analysis.checkResults?.length && (
                      <section className="coverage-warning" aria-label="Checks not verified">
                        <h3>Checks not verified</h3>
                        <ul>
                          {analysis.checkResults.map((result, i) => (
                            <li key={i}>
                              <strong>{result.target}</strong> · {result.checkId}: {result.reason}
                            </li>
                          ))}
                        </ul>
                        <button className="text-button" onClick={() => navigateTab('context')}>
                          Review configured requirements
                        </button>
                        <button className="text-button" onClick={() => exportReport('md')}>
                          Download check results (Markdown)
                        </button>
                        <button className="text-button" onClick={() => exportReport('json')}>
                          Download check results (JSON)
                        </button>
                      </section>
                    )}
                    <div className="findings-list">
                      {filtered.length ? (
                        visibleFindings.map((f) => (
                          <FindingRow
                            key={f.id}
                            finding={f}
                            operations={operations}
                            onOpen={() => setSelectedId(f.id)}
                          />
                        ))
                      ) : (
                        <div className="empty-state">
                          <h2>
                            {pkg.findings.length
                              ? 'No matching findings'
                              : 'No findings from the automated checks'}
                          </h2>
                          <p>
                            {pkg.findings.length
                              ? 'Clear the search or change the filters to see other findings.'
                              : analysis.coverage.status === 'incomplete'
                                ? 'Coverage is incomplete. Inspect the affected files and pages before relying on this result.'
                                : 'Review references and unsupported checks in Documents. Automated checks do not establish completeness or legal approval.'}
                          </p>
                          {analysis.coverage.status === 'incomplete' && (
                            <button className="button" onClick={viewGaps}>
                              View affected pages
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <Pagination
                      page={currentReviewPage}
                      total={filtered.length}
                      itemName="findings"
                      label="Review pagination"
                      onPageChange={setReviewPage}
                    />
                  </section>
                )}
                {tab === 'readiness' && (
                  <ReadinessPanel
                    key={pkg.id}
                    readiness={readiness}
                    findings={pkg.findings}
                    onDecision={openDecision}
                    onRerun={rerun}
                    onNavigate={navigateTab}
                    onOpenFinding={(id) => setSelectedId(id)}
                    onOpenSource={(e) => traceEvidence({ ...e, text: e.text ?? e.quote })}
                    onAcknowledge={acknowledgeReadiness}
                    onExportSummary={exportReviewSummary}
                    exportingSummary={exportingSummary}
                  />
                )}
                {tab === 'documents' && (
                  <section className="documents-view">
                    <AnalysisDownload analysis={analysis} documents={pkg.documents} />
                    <CoveragePanel
                      analysis={analysis}
                      expanded={showGaps}
                      onOpen={(e) =>
                        setModal({
                          document: pkg.documents.find((d) => d.id === e.documentId),
                          page: e.page,
                        })
                      }
                    />
                    <DocumentList
                      documents={pkg.documents}
                      onOpen={(d) => setModal({ document: d })}
                    />
                    <DocumentContextPanel
                      key={pkg.id}
                      pkg={pkg}
                      analysis={analysis}
                      onChange={updateContext}
                      onOpenSource={(e) =>
                        setModal({
                          document: pkg.documents.find((d) => d.id === e.documentId),
                          page: e.page,
                        })
                      }
                    />
                    <RevisionPanel
                      revisions={pkg.revisions}
                      onOpenEvidence={(e, r) => setModal({ historical: e, revision: r })}
                    />
                    <InventoryPanel
                      analysis={analysis}
                      references={references}
                      onReviewFinding={(id) => {
                        if (pkg.findings.some((f) => f.id === id)) setSelectedId(id);
                        else {
                          setTab('review');
                          setToast(
                            'Run preflight again to add the current finding to the review queue.',
                          );
                        }
                      }}
                      documents={pkg.documents}
                      onOpen={(e) =>
                        setModal({
                          document: pkg.documents.find((d) => d.id === e.documentId),
                          page: e.page,
                        })
                      }
                    />
                  </section>
                )}
                {tab === 'report' && (
                  <section className="report-view">
                    <ClarificationPanel
                      key={pkg.id}
                      pkg={pkg}
                      analysis={analysis}
                      onChange={updateContext}
                      decisionRequest={decisionRequest}
                      onDecisionRequestHandled={() => setDecisionRequest(null)}
                      onOpenFinding={(findingId, evidence) => {
                        setReviewSource({ packageId: pkg.id, findingId, evidence });
                        setSelectedId(findingId);
                      }}
                      onOpenSource={(e) =>
                        setModal({
                          document: pkg.documents.find((d) => d.id === e.documentId),
                          page: e.page,
                        })
                      }
                    />
                    <details className="question-download">
                      <summary>
                        Share questions from Review <span>{included.length} selected</span>
                      </summary>
                      <div className="report-heading">
                        <div>
                          <h2>Selected questions</h2>
                          <p>
                            Select the finding questions you want to download and share. Recorded
                            answers stay in the list above; this download does not send a message.
                          </p>
                        </div>
                        <button
                          className="button primary"
                          disabled={!included.length}
                          onClick={() => exportReport()}
                        >
                          Download {included.length} question{included.length === 1 ? '' : 's'}{' '}
                          <Download size={16} />
                        </button>
                      </div>
                      {!included.length && (
                        <p className="notice">
                          {pkg.findings.length
                            ? 'Select at least one question below, then download it to share for review.'
                            : 'No questions to download. Review Documents and add a finding if you identify a question.'}
                        </p>
                      )}
                      {pkg.findings.map(findingCopy).map((f) => (
                        <article
                          className={`report-finding ${f.includeInReport ? 'included' : ''}`}
                          key={f.id}
                        >
                          <label className="report-selection">
                            <input
                              type="checkbox"
                              aria-label={`Include ${f.title} in question download`}
                              checked={!!f.includeInReport}
                              onChange={(e) => toggleReport(f.id, e.target.checked)}
                            />
                            <strong>{f.title}</strong>
                          </label>
                          <div className="report-question">
                            <span>
                              {describeFinding(f)} · {statusNames[f.status]} ·{' '}
                              <PriorityBadge severity={f.severity} />
                            </span>
                            <p>{f.question}</p>
                            {f.note && <p>Reviewer note: {f.note}</p>}
                            <small>
                              {f.evidence
                                .map((e) => `${e.document} · ${e.locator || 'Page'} ${e.page}`)
                                .join(' / ')}
                            </small>
                            <button className="text-button" onClick={() => setSelectedId(f.id)}>
                              Edit question & review <ArrowUpRight size={15} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </details>
                    <details className="question-other-downloads">
                      <summary>Review summary &amp; data exports</summary>
                      <button
                        className="button"
                        onClick={exportReviewSummary}
                        disabled={exportingSummary}
                        aria-busy={exportingSummary}
                      >
                        {exportingSummary ? 'Preparing PDF…' : 'Download review summary (PDF)'}
                      </button>
                      <details className="advanced">
                        <summary>Export options & limitations</summary>
                        <p>
                          Both formats include the {included.length} selected questions, evidence,
                          review statuses, notes and coverage limits. JSON also includes structured
                          package records and diagnostics. Original files are not included.
                        </p>
                        <button
                          className="button"
                          disabled={!included.length}
                          onClick={() => exportReport('json')}
                        >
                          Download JSON
                        </button>
                      </details>
                    </details>
                  </section>
                )}
                <footer className="workspace-footer">
                  Processed in this browser. Check the save status for your changes.
                </footer>
              </div>
            </div>
          </>
        )}
      </main>
      {selected && nav === 'package' && (
        <FindingReview
          onDecision={(stage, evidence) =>
            openDecision({ findingId: selected.id, stage, evidence })
          }
          onEvidence={traceEvidence}
          onNavigate={(next, section) => {
            setSelectedId(null);
            navigateTab(next, section);
          }}
          key={selected.id}
          finding={selected}
          initialSource={
            reviewSource?.packageId === pkg.id && reviewSource.findingId === selected.id
              ? reviewSource.evidence
              : null
          }
          documents={pkg.documents}
          operations={operations}
          onRefreshSource={() => {
            setSelectedId(null);
            setModal({ editIssue: selected });
          }}
          onClose={() => setSelectedId(null)}
          onStatus={(s) => changeStatus(selected.id, s)}
          onEdit={(patch) => editFinding(selected.id, patch)}
          onEditComplete={() => recordEdit(selected.id)}
          onInclude={(checked) => toggleReport(selected.id, checked)}
          storageState={storageState}
          index={selectedIndex}
          total={reviewIds.length}
          onPrevious={() => setSelectedId(reviewIds[selectedIndex - 1])}
          onNext={() => setSelectedId(reviewIds[selectedIndex + 1])}
        />
      )}
      {(modal === 'new' || modal === 'upload') && (
        <UploadModal
          isNew={modal === 'new'}
          packageName={pkg.name}
          onClose={() => setModal(null)}
          onSubmit={addDocuments}
        />
      )}
      {modal?.document && (
        <DocumentModal
          key={`${modal.document.id}-${modal.page}`}
          findings={pkg.findings}
          onOpenFinding={(id) => {
            setModal(null);
            setSelectedId(id);
          }}
          initialPage={modal.page}
          document={modal.document}
          onClose={() => setModal(null)}
        />
      )}
      {(modal === 'manual' || modal?.editIssue) && (
        <ManualIssueModal
          finding={modal?.editIssue}
          documents={pkg.documents}
          onClose={() => setModal(null)}
          onSubmit={addManualIssue}
        />
      )}
      {modal?.historical && (
        <HistoricalEvidence
          evidence={modal.historical}
          revision={modal.revision}
          documents={pkg.documents}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'history' && (
        <HistoryModal activity={pkg.activity || []} onClose={() => setModal(null)} />
      )}
      {toast && !selected && (
        <div className="toast" role="status">
          {toast}
          <IconButton label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
function FindingRow({ finding, operations, onOpen }) {
  const f = findingCopy(finding);
  const [rowFocused, setRowFocused] = useState(false);
  const e = f.evidence[0];
  const { category, subtype } = findingDetails(f);
  const status = findingQueueStatus(f, operations);
  return (
    <article className="finding-card">
      <button
        className="finding-row"
        onClick={onOpen}
        aria-label={`Review ${f.title}`}
        aria-description={priorityDescriptions[priorityOf(f.severity)]}
        onFocus={() => setRowFocused(true)}
        onBlur={() => setRowFocused(false)}
      >
        <div className="finding-heading">
          <h2>{f.title}</h2>
          <span>
            {e?.document} · v{e?.documentVersion || '?'} · {e?.locator || 'Page'} {e?.page}
            {f.evidence.length > 1
              ? ` · +${f.evidence.length - 1} ${f.evidence.length === 2 ? 'source' : 'sources'}`
              : ''}
          </span>
          {e?.text && (
            <p className="queue-quote">
              “{e.text.length > 150 ? `${e.text.slice(0, 150)}…` : e.text}”
            </p>
          )}
        </div>
        <div className="finding-category">
          <span>{category}</span>
          {subtype !== category && <small>{subtype}</small>}
        </div>
        <div className="finding-labels" aria-label="Priority and status">
          <PriorityBadge severity={f.severity} rowFocused={rowFocused} focusable={false} />
          <span
            className={`badge finding-status status-${status.kind}`}
            data-finding-status={f.status}
          >
            {status.label}
          </span>
        </div>
        <ChevronRight className="row-arrow" size={19} />
      </button>
    </article>
  );
}
function FindingReview({
  onDecision,
  onEvidence,
  onNavigate,
  finding: rawFinding,
  initialSource,
  documents,
  operations,
  onRefreshSource,
  onClose,
  onStatus,
  onEdit,
  onEditComplete,
  onInclude,
  storageState,
  index,
  total,
  onPrevious,
  onNext,
}) {
  useDialog(onClose);
  const f = findingCopy(rawFinding);
  const [sourceIndex, setSourceIndex] = useState(() =>
      Math.max(
        0,
        f.evidence.findIndex(
          (e) =>
            e.documentId === initialSource?.documentId &&
            e.documentVersion === initialSource.documentVersion &&
            e.page === initialSource.page &&
            e.text === initialSource.text,
        ),
      ),
    ),
    [dispositionError, setDispositionError] = useState(''),
    [mode, setMode] = useState(() => {
      const evidence = f.evidence[sourceIndex];
      const doc = documents.find((d) => d.id === evidence.documentId);
      return doc?.type === 'PDF' && (evidence.originalKey || doc.originalKey) ? 'original' : 'text';
    });
  const dirty = useRef(false),
    noteInput = useRef(null);
  const e = f.evidence[sourceIndex] || f.evidence[0],
    doc = documents.find((d) => d.id === e.documentId),
    matches = !e.documentVersion || e.documentVersion === doc?.version;
  const page = matches ? doc?.pages.find((p) => p.number === e.page) : null;
  const evidenceDoc = doc
    ? { ...doc, originalKey: e.originalKey || (matches ? doc.originalKey : null) }
    : null;
  function edited(patch) {
    if (patch.note?.trim()) setDispositionError('');
    dirty.current = true;
    onEdit(patch);
  }
  function selectStatus(status) {
    const error = findingDispositionError(f, status);
    setDispositionError(error);
    if (error) {
      noteInput.current?.focus();
      return;
    }
    onStatus(status);
  }
  function finishEdit() {
    if (dirty.current) {
      dirty.current = false;
      onEditComplete();
    }
  }
  const closed = ['dismissed', 'resolved'].includes(f.status);
  const guidance = findingReviewGuidance(f, operations);
  return (
    <div className="overlay review-overlay">
      <section
        className="finding-review"
        role="dialog"
        aria-modal="true"
        aria-label="Finding details"
      >
        <header className="review-header">
          <div>
            <small>
              Finding {index + 1} of {total}
            </small>
            <h2>{f.title}</h2>
          </div>
          <div className="review-navigation">
            <IconButton label="Previous finding" disabled={index <= 0} onClick={onPrevious}>
              <ChevronLeft size={20} />
            </IconButton>
            <IconButton label="Next finding" disabled={index >= total - 1} onClick={onNext}>
              <ChevronRight size={20} />
            </IconButton>
            <IconButton label="Close finding details" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
        </header>
        <div className="review-body">
          <section className="review-source" aria-label="Source evidence">
            <div className="source-selector">
              {f.evidence.map((source, i) => (
                <button
                  key={i}
                  className={i === sourceIndex ? 'active' : ''}
                  aria-pressed={i === sourceIndex}
                  onClick={() => setSourceIndex(i)}
                >
                  <span>{source.section || `Passage ${i + 1}`}</span>
                  <small>
                    {source.document} · {source.locator || 'Page'} {source.page}
                  </small>
                </button>
              ))}
            </div>
            <div className="source-tools">
              <span>
                {e.section} · Version {e.documentVersion || doc?.version || 'legacy'}
              </span>
              <ViewToggle mode={mode} setMode={setMode} />
            </div>
            <div className="source-content">
              {mode === 'original' ? (
                <OriginalPage document={evidenceDoc} page={e.page} />
              ) : (
                <div className="source-text">
                  {doc?.type === 'PDF' && !e.originalKey && !doc.originalKey && (
                    <p className="muted">
                      Original file unavailable. Reattach {doc.name} to inspect the page layout.
                    </p>
                  )}
                  <h3>Cited text</h3>
                  <blockquote className="highlighted-text">{e.text}</blockquote>
                  {page && (
                    <details>
                      <summary>Full extracted {e.locator?.toLowerCase() || 'page'} text</summary>
                      <pre>{page.text}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </section>
          <section className="review-editor" aria-label="Finding decision">
            <div className="review-help">
              <div className="finding-state-line">
                <strong>{guidance.title}</strong>
                <span>
                  {closed ? 'Original priority' : 'Priority'}:{' '}
                  <PriorityBadge severity={f.severity} />
                </span>
              </div>
              <p>{guidance.next}</p>
            </div>
            <details className="finding-explanation" open={!closed} key={`${f.id}:${closed}`}>
              <summary>{closed ? 'Why this was flagged' : 'What to check'}</summary>
              <p>{findingReviewExplanation(f)}</p>
              {f.verificationReason && (
                <p className="verification-note">Not verified: {f.verificationReason}</p>
              )}
            </details>
            <div className="finding-answer-actions">
              <button className="text-button" onClick={() => onDecision('question', e)}>
                Draft question
              </button>
              <button className="button" onClick={() => onDecision('response', e)}>
                Record response
              </button>
              <button className="text-button" onClick={() => onDecision('approval', e)}>
                Record internal approval
              </button>
            </div>
            {f.manual && (
              <button className="button" onClick={onRefreshSource}>
                Recheck issue sources
              </button>
            )}
            <label className="field-label" htmlFor="counsel-question">
              Question for counsel
              <small className="input-help">
                For your question download. Nothing is sent from this app.
              </small>
              <textarea
                aria-label="Question for counsel"
                id="counsel-question"
                value={f.question || ''}
                onChange={(ev) => edited({ question: ev.target.value })}
                onBlur={finishEdit}
                rows={4}
              />
            </label>
            <label className="field-label" htmlFor="reviewer-note">
              Reviewer note
              <small className="input-help" id="reviewer-note-help">
                Explain your decision. A reason is required to dismiss this finding.
              </small>
              <textarea
                aria-label="Reviewer note"
                aria-invalid={!!dispositionError}
                aria-describedby={`reviewer-note-help${dispositionError ? ' reviewer-note-error' : ''}`}
                ref={noteInput}
                id="reviewer-note"
                value={f.note || ''}
                onChange={(ev) => edited({ note: ev.target.value })}
                onBlur={finishEdit}
                rows={2}
              />
              {dispositionError && (
                <small className="save-error" id="reviewer-note-error" role="alert">
                  {dispositionError}
                </small>
              )}
            </label>
            <FindingWorkContext finding={f} operations={operations} />
            <RecordTrace
              finding={f}
              operations={operations}
              documents={documents}
              onEvidence={onEvidence}
              onContext={() => onNavigate('documents', 'context-documents')}
              onReport={() => onNavigate('report')}
            />
            <details className="context-details check-overview">
              <summary>About this check</summary>
              <dl className="check-facts">
                <div>
                  <dt>Check</dt>
                  <dd>{findingDetails(f).subtype}</dd>
                </div>
                <div>
                  <dt>Basis</dt>
                  <dd>{f.certainty || 'Needs reviewer verification'}</dd>
                </div>
              </dl>
              {f.impact && (
                <section className="check-impact">
                  <h3>Why it matters</h3>
                  <p>{f.impact}</p>
                </section>
              )}
              {!!f.facts?.some((fact) => fact.exceptionContext || fact.qualificationEvidence) && (
                <section className="check-qualifications">
                  <h3>Exceptions &amp; qualifications</h3>
                  {f.facts.map((fact, i) => (
                    <div key={i}>
                      {fact.exceptionContext && <p>{fact.exceptionContext}</p>}
                      {fact.qualificationEvidence && (
                        <blockquote>{fact.qualificationEvidence.text}</blockquote>
                      )}
                    </div>
                  ))}
                </section>
              )}
              <details className="check-diagnostics">
                <summary>Detection method &amp; original wording</summary>
                <dl className="check-facts">
                  <div>
                    <dt>Origin</dt>
                    <dd>{f.manual ? 'Entered by a reviewer' : 'Automated text check'}</dd>
                  </div>
                  {f.checkTitle && (
                    <div>
                      <dt>Check name</dt>
                      <dd>{f.checkTitle}</dd>
                    </div>
                  )}
                  {f.checkId && (
                    <div>
                      <dt>Check ID</dt>
                      <dd>{f.checkId}</dd>
                    </div>
                  )}
                  {f.detectionStatus && (
                    <div>
                      <dt>Result</dt>
                      <dd>{f.detectionStatus.replaceAll('_', ' ')}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Method</dt>
                    <dd>{f.rule || 'Legacy text check; accuracy has not been calibrated'}</dd>
                  </div>
                </dl>
                <h3>Original explanation</h3>
                <p>{f.description}</p>
                {f.uncertainty && f.uncertainty !== f.certainty && <p>{f.uncertainty}</p>}
              </details>
              <details className="check-limits">
                <summary>Review limits</summary>
                <dl className="check-facts">
                  <div>
                    <dt>Approval</dt>
                    <dd>
                      Reviewing a finding or selecting a question does not record internal approval.
                    </dd>
                  </div>
                  <div>
                    <dt>Readiness</dt>
                    <dd>Internal handoff only; not legal or customer approval.</dd>
                  </div>
                  <div>
                    <dt>Identity</dt>
                    <dd>Names are entered manually and are not authenticated.</dd>
                  </div>
                </dl>
              </details>
            </details>
            <details className="finding-history">
              <summary>Finding history · {(f.history || []).length} events</summary>
              {(f.history || []).map((h, i) => (
                <div key={i}>
                  <p>
                    {formatDate(h.time)} · {h.event}
                    {h.previousStatus ? ` · Previous state: ${h.previousStatus}` : ''}
                  </p>
                  {h.evidence?.map((source, j) => (
                    <blockquote key={j}>
                      {source.document} · {source.locator || 'Page'} {source.page} · Version{' '}
                      {source.documentVersion || 'legacy'}: {source.text}
                    </blockquote>
                  ))}
                </div>
              ))}
            </details>
          </section>
        </div>
        <footer className="decision-bar">
          <div className="report-choice">
            <label>
              <input
                type="checkbox"
                checked={!!f.includeInReport}
                onChange={(ev) => onInclude(ev.target.checked)}
              />
              Include in question download
            </label>
            <span className={storageState === 'error' ? 'save-error' : 'save-state'} role="status">
              {storageState === 'error'
                ? 'Not saved — storage unavailable'
                : storageState === 'saving'
                  ? 'Saving…'
                  : 'Saved in this browser'}
            </span>
          </div>
          <div className="decision-actions">
            {closed ? (
              <button className="button" onClick={() => selectStatus('open')}>
                <RotateCcw size={16} />
                Reopen
              </button>
            ) : (
              <>
                {f.status !== 'confirmed' && (
                  <button className="button primary" onClick={() => selectStatus('confirmed')}>
                    <Check size={16} />
                    Confirm issue
                  </button>
                )}
                {f.status === 'confirmed' && (
                  <button className="button primary" onClick={() => selectStatus('resolved')}>
                    <CheckCheck size={16} />
                    Mark as resolved
                  </button>
                )}
                <button className="button" onClick={() => selectStatus('dismissed')}>
                  Dismiss finding
                </button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
function FindingWorkContext({ finding, operations }) {
  const decisions = operations?.decisions.filter((d) => d.findingIds?.includes(finding.id)) || [];
  if (!decisions.length) return null;
  return (
    <details className="finding-work-context">
      <summary>
        Linked questions &amp; responses <span>{decisions.length}</span>
      </summary>
      {decisions.map((d) => (
        <div key={d.id}>
          <h3>{d.title}</h3>
          <p className="linked-response-state">
            {decisionStatusNames[d.effectiveRoutingStatus] || decisionStatusNames.draft}
          </p>
          <p>{d.response?.text || d.answer || 'No response recorded.'}</p>
          <small>
            Source: {d.sourceState?.status || 'unverified'} · Owner: {d.owner || 'Unassigned'}
          </small>
        </div>
      ))}
      <p className="input-help">
        Recording a response does not grant internal approval or change the finding’s review status.
      </p>
    </details>
  );
}
function ManualIssueModal(props) {
  useDialog(props.onClose);
  return <ManualIssueDialog {...props} />;
}
function HistoricalEvidence({ evidence: e, revision, documents, onClose }) {
  useDialog(onClose);
  const [mode, setMode] = useState(
    documents.find((d) => d.id === e.documentId)?.type === 'PDF' ? 'original' : 'text',
  );
  const current = documents.find((d) => d.id === e.documentId),
    previous = revision.beforeDocument,
    doc =
      current && (current.version || 1) === e.documentVersion
        ? current
        : previous?.version === e.documentVersion
          ? previous
          : {
              id: e.documentId,
              name: e.document,
              type: current?.type || previous?.type,
              version: e.documentVersion,
              originalKey: e.originalKey,
            };
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <section
        className="modal document-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Revision source"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="drawer-heading">
          <h2>
            {e.document} · {e.locator || 'Page'} {e.page} · version {e.documentVersion}
          </h2>
          <IconButton label="Close revision source" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="document-tools">
          <span>Revision evidence</span>
          <ViewToggle mode={mode} setMode={setMode} />
        </div>
        <div className="document-modal-body">
          {mode === 'original' ? (
            <OriginalPage document={doc} page={e.page} />
          ) : (
            <pre>{e.text}</pre>
          )}
        </div>
      </section>
    </div>
  );
}
function ViewToggle({ mode, setMode }) {
  return (
    <div className="view-toggle" aria-label="Evidence view">
      <button
        className={mode === 'original' ? 'active' : ''}
        aria-pressed={mode === 'original'}
        onClick={() => setMode('original')}
      >
        Original
      </button>
      <button
        className={mode === 'text' ? 'active' : ''}
        aria-pressed={mode === 'text'}
        onClick={() => setMode('text')}
      >
        Text
      </button>
    </div>
  );
}
function DocumentList({ documents, onOpen }) {
  return (
    <section className="document-list">
      <h2>Source documents</h2>
      {documents.map((d) => (
        <button className="document-row" key={d.id} onClick={() => onOpen(d)}>
          <FileText size={19} />
          <div>
            <strong>{d.name}</strong>
            <small>
              {d.type} · {d.pages.length} {d.type === 'DOCX' ? 'text segments' : 'pages'} ·{' '}
              {prettyBytes(d.size)} · Version {d.version}
            </small>
          </div>
          <span>
            {coverageOf(d).status === 'fully analyzed'
              ? `Text checked: ${coverageOf(d).pagesChecked}/${coverageOf(d).originalPages}`
              : coverageOf(d).status}
          </span>
          <ArrowUpRight size={17} />
        </button>
      ))}
      {documents.some((d) => d.type === 'DOCX') && (
        <p className="muted">
          DOCX citations use paragraphs/text segments. Original Word page boundaries are
          unavailable.
        </p>
      )}
    </section>
  );
}
function SourceConnections({ document: d, page, findings, onOpenFinding }) {
  const linked = findings.filter((f) =>
    [...(f.evidence || []), ...(f.resolutionEvidence || [])].some(
      (e) => e.documentId === d.id && e.documentVersion === d.version && e.page === page,
    ),
  );
  return (
    <details className="source-connections">
      <summary>Issues citing this source location · {linked.length}</summary>
      <p>
        These links come from exact rule citations or analyst-selected passages, not a complete
        assessment of this page.
      </p>
      {linked.length ? (
        linked.map((f) => (
          <div key={f.id}>
            <button className="text-button" onClick={() => onOpenFinding(f.id)}>
              {findingCopy(f).title} → trace review & work
            </button>
            <small>
              {f.manual ? 'Manually recorded finding' : 'Automated finding'} ·{' '}
              {statusNames[f.status]}
            </small>
          </div>
        ))
      ) : (
        <p>
          No finding cites this version and location. A reviewer can still discover requirements
          here.
        </p>
      )}
    </details>
  );
}
function DocumentModal({ document: d, initialPage, onClose, findings = [], onOpenFinding }) {
  useDialog(onClose);
  const [index, setIndex] = useState(
      Math.max(
        0,
        d.pages.findIndex((p) => p.number === initialPage),
      ),
    ),
    [mode, setMode] = useState(d.type === 'PDF' ? 'original' : 'text');
  const p = d.pages[index];
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <section
        className="modal document-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Document viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-heading">
          <h2>{d.name}</h2>
          <IconButton label="Close document" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="document-tools">
          <span>{p?.status || d.error || coverageOf(d).status}</span>
          <ViewToggle mode={mode} setMode={setMode} />
        </div>
        {p?.reason && <p className="notice">{p.reason}</p>}
        {d.storageWarning && <p role="alert">{d.storageWarning}</p>}
        <div className="document-modal-body">
          <SourceConnections
            document={d}
            page={p?.number}
            findings={findings}
            onOpenFinding={onOpenFinding}
          />
          {mode === 'original' && p ? (
            <OriginalPage document={d} page={p.number} />
          ) : (
            <pre>{p?.text || 'No readable text for this file/page. Original required.'}</pre>
          )}
        </div>
        <div className="document-pagination">
          <button className="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Previous
          </button>
          <label>
            {d.type === 'DOCX' ? 'Paragraph' : 'Page'}{' '}
            <input
              aria-label="Source page"
              type="number"
              min="1"
              max={d.pages.length || 1}
              value={index + 1}
              onChange={(e) =>
                setIndex(Math.max(0, Math.min(d.pages.length - 1, Number(e.target.value) - 1)))
              }
            />{' '}
            of {d.pages.length}
          </label>
          <button
            className="button"
            disabled={index >= d.pages.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
function HistoryModal({ activity, onClose }) {
  useDialog(onClose);
  return (
    <div className="overlay modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Package history"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-heading">
          <h2>Package history</h2>
          <IconButton label="Close history" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="activity-list">
          {activity.map((a) => (
            <div key={a.id}>
              <strong>{a.text}</strong>
              <small>{formatDate(a.time)}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function UploadModal({ isNew, packageName, onClose, onSubmit }) {
  const [name, setName] = useState(''),
    [files, setFiles] = useState([]),
    [drag, setDrag] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [step, setStep] = useState('');
  const input = useRef();
  useDialog(onClose, busy);
  function addFiles(newFiles) {
    setError('');
    const merged = [...files];
    for (const f of Array.from(newFiles)) {
      if (!/\.(pdf|docx|txt)$/i.test(f.name)) {
        setError('Choose PDF, DOCX, or TXT files.');
        continue;
      }
      if (f.size > 25 * 1024 * 1024) {
        setError(`${f.name} is larger than 25 MB. Choose a smaller file.`);
        continue;
      }
      if (!merged.some((x) => x.name === f.name)) merged.push(f);
    }
    if (merged.length > 20) {
      setError('Choose up to 20 files for this upload.');
      return;
    }
    setFiles(merged);
  }
  async function submit(e) {
    e.preventDefault();
    if (!files.length || (isNew && !name.trim())) return;
    setBusy(true);
    setError('');
    try {
      const docs = [];
      for (let i = 0; i < files.length; i++) {
        setStep(`Reading ${i + 1} of ${files.length}: ${files[i].name}`);
        try {
          docs.push(await parseFile(files[i]));
        } catch (error) {
          docs.push(failedFile(files[i], error));
        }
      }
      setStep('Checking references and comparing documents…');
      onSubmit(docs, name.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay modal-overlay" onClick={() => !busy && onClose()}>
      <form
        className="modal upload-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'New document package' : 'Add documents'}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div className="modal-symbol">
            <FolderOpen size={23} />
          </div>
          <IconButton label="Close upload" disabled={busy} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <h2>{isNew ? 'New package' : 'Add / replace files'}</h2>
        <p>
          {isNew
            ? 'Upload the complete package to check references across your documents.'
            : `Add files to ${packageName}. Matching filenames replace the previous version and trigger a fresh check.`}
        </p>
        <p className="input-help">
          Next: inspect Documents coverage and original pages, then review findings. Automated
          checks do not read scanned image text or decide legal intent.
        </p>
        {isNew && (
          <label className="field-label">
            Package name
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northstar Fund IV"
              maxLength={100}
              disabled={busy}
            />
          </label>
        )}
        <input
          type="file"
          className="sr-only"
          ref={input}
          multiple
          accept=".pdf,.docx,.txt"
          disabled={busy}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy}
          className={`drop-zone ${drag ? 'dragging' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) addFiles(e.dataTransfer.files);
          }}
        >
          <span>
            <Upload size={24} />
          </span>
          <strong>
            Click to upload <span>or drag and drop</span>
          </strong>
          <small>PDF, DOCX, or TXT · Up to 25 MB each · 20 files</small>
        </button>
        {files.length > 0 && (
          <div className="upload-file-list">
            {files.map((f, i) => (
              <div key={f.name}>
                <FileText size={17} />
                <span>
                  {f.name}
                  <small>{prettyBytes(f.size)}</small>
                </span>
                <IconButton
                  label={`Remove ${f.name}`}
                  disabled={busy}
                  onClick={() => setFiles(files.filter((_, j) => i !== j))}
                >
                  <X size={15} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <CircleAlert size={17} />
            <span>{error}</span>
          </div>
        )}
        {busy && (
          <div className="processing-status" role="status">
            <LoaderCircle className="spin" size={16} />
            {step}
          </div>
        )}
        <div className="upload-privacy">
          <ShieldCheck size={15} />
          <span>
            Your documents are processed in this browser. No files are sent to an external AI
            service.
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || !files.length || (isNew && !name.trim())}
          >
            {busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{' '}
            {busy ? 'Running preflight…' : isNew ? 'Create & run preflight' : 'Upload & recheck'}
          </button>
        </div>
      </form>
    </div>
  );
}
