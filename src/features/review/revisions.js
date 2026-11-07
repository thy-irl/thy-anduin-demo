import { sourceSpan } from '../analysis/structure.js';
const compact = (text) => text.replace(/\s+/g, ' ').trim();
function passages(doc) {
  let text = '';
  const ranges = doc.pages.map((p) => {
    const start = text.length;
    text += p.text + '\n';
    return { page: p, start, end: text.length - 1 };
  });
  const items = [];
  for (const m of text.matchAll(/[\s\S]+?(?:[.!?](?=\s+[A-Z0-9“])|$)/g)) {
    if (!m[0].trim()) continue;
    const start = m.index,
      end = start + m[0].length;
    items.push({
      text: compact(m[0]),
      evidence: ranges
        .filter((r) => r.end > start && r.start < end)
        .map((r) =>
          sourceSpan(
            doc,
            r.page,
            Math.max(0, start - r.start),
            Math.min(r.page.text.length, end - r.start),
            'Revision excerpt',
          ),
        )
        .filter((e) => e.text.trim()),
    });
  }
  return items;
}
export function compareRevision(before, after) {
  const oldText = before.pages.map((p) => p.text).join('\n'),
    newText = after.pages.map((p) => p.text).join('\n');
  const coverageLimited = [before, after].some(
    (d) =>
      d.rejected ||
      d.limitations?.length ||
      d.pages.some(
        (p) => p.visualGap || (p.status && !['searchable text', 'likely blank'].includes(p.status)),
      ),
  );
  const base = {
    id: `revision-${crypto.randomUUID()}`,
    documentId: after.id,
    name: after.name,
    fromVersion: before.version || 1,
    toVersion: after.version || 1,
    createdAt: new Date().toISOString(),
    changes: [],
    formattingOnly: false,
    limited: coverageLimited,
  };
  if (compact(oldText) === compact(newText))
    return {
      ...base,
      formattingOnly: !coverageLimited && oldText !== newText,
      summary: coverageLimited
        ? 'Extracted wording unchanged; coverage is partial, inspect originals'
        : oldText === newText
          ? 'Extracted wording unchanged'
          : 'Only extracted whitespace or page flow changed',
    };
  if (before.rejected || after.rejected || !oldText.trim() || !newText.trim())
    return {
      ...base,
      limited: true,
      summary: 'Source extraction is incomplete; compare originals before assessing changes',
    };
  const old = passages(before),
    next = passages(after);
  if (old.length > 650 || next.length > 650)
    return {
      ...base,
      limited: true,
      summary:
        'Document exceeds the detailed comparison limit; compare the originals. Extracted wording changed.',
    };
  const width = next.length + 1,
    grid = new Uint16Array((old.length + 1) * width);
  for (let i = old.length - 1; i >= 0; i--)
    for (let j = next.length - 1; j >= 0; j--)
      grid[i * width + j] =
        old[i].text === next[j].text
          ? 1 + grid[(i + 1) * width + j + 1]
          : Math.max(grid[(i + 1) * width + j], grid[i * width + j + 1]);
  let i = 0,
    j = 0,
    removed = [],
    added = [];
  const changes = [];
  function flush() {
    if (!removed.length && !added.length) return;
    changes.push({
      kind: removed.length && added.length ? 'changed' : removed.length ? 'removed' : 'added',
      before: removed,
      after: added,
    });
    removed = [];
    added = [];
  }
  while (i < old.length || j < next.length) {
    if (i < old.length && j < next.length && old[i].text === next[j].text) {
      flush();
      i++;
      j++;
    } else if (
      i < old.length &&
      (j >= next.length || grid[(i + 1) * width + j] >= grid[i * width + j + 1])
    )
      removed.push(old[i++]);
    else added.push(next[j++]);
  }
  flush();
  const evidence = changes.flatMap((c) => c.before.flatMap((p) => p.evidence));
  const pages = [...new Set(evidence.map((e) => e.page))]
    .map((n) => before.pages.find((p) => p.number === n))
    .filter(Boolean);
  return {
    ...base,
    changes: changes.slice(0, 60),
    limited: coverageLimited || changes.length > 60,
    totalChanges: changes.length,
    summary: `${changes.length} text change ${changes.length === 1 ? 'group' : 'groups'}; ${coverageLimited ? 'coverage partial; ' : ''}human impact review required`,
    beforeDocument: {
      id: before.id,
      name: before.name,
      type: before.type,
      version: before.version,
      originalKey: before.originalKey,
      pages,
    },
  };
}
