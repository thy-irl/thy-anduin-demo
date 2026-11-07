import { blocksOf, sourceSpan, normalize, stableId } from './structure.js';
import { linkedServices } from './context.js';
import { writtenAmount } from './mechanical.js';

const number = '(?:\\d+(?:\\.\\d+)?|[a-z]+(?:[ -]+[a-z]+){0,3})';
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const monthNames = `(?:${months.join('|')})`;
const date = `(?:\\d{1,2}\\s+${monthNames}\\s+\\d{4}|${monthNames}\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`;
const quantity = (text) => (/^\d+(?:\.\d+)?$/.test(text) ? Number(text) : writtenAmount(text));

// No host-dependent Date.parse: source dates are parsed and validated as UTC
// calendar dates. Unsupported formats abstain instead of guessing a locale.
function calendarDate(text) {
  let year, month, day;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) [, year, month, day] = iso.map(Number);
  else {
    const tokens = text.replace(',', '').split(/\s+/);
    const monthFirst = /^[A-Za-z]/.test(tokens[0]);
    year = Number(tokens[2]);
    day = Number(tokens[monthFirst ? 1 : 0]);
    month =
      months.findIndex((m) => m.toLowerCase() === tokens[monthFirst ? 0 : 1].toLowerCase()) + 1;
  }
  const value = Date.UTC(year, month - 1, day),
    check = new Date(value);
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? value
    : null;
}
const period = (f) => `${f.value} ${f.unit} days`;
const duration = (value, unit) => {
  value = quantity(value);
  unit = normalize(unit).replace(/s$/, '');
  const multiplier = { minute: 1, hour: 60, 'calendar day': 1440 }[unit];
  return { value, unit, minutes: multiplier === undefined ? null : value * multiplier };
};

export function servicesChecks(documents, context, packageFacts) {
  const roles = new Map(context.documents.map((d) => [d.documentId, d]));
  const active = documents.filter(
    (d) =>
      roles.get(d.id)?.status !== 'superseded' &&
      ['master services agreement', 'statement of work', 'service level schedule'].includes(
        roles.get(d.id)?.role,
      ),
  );
  const facts = [],
    checks = [];
  for (const doc of active) {
    const blocks = blocksOf(doc);
    for (const page of doc.pages) {
      const make = (m, kind, fields) => {
        const block = blocks.find(
          (b) => b.page === page.number && b.span.start <= m.index && b.span.end > m.index,
        );
        // Keep the whole numbered clause, including any restriction in its next
        // sentence. Character windows can silently omit precedence instructions.
        const clause = blocks.filter(
          (b) =>
            b.page === page.number &&
            b.section === block?.section &&
            b.sectionScope === block?.sectionScope,
        );
        const evidence = sourceSpan(
          doc,
          page,
          clause[0]?.span.start ?? m.index,
          clause.at(-1)?.span.end ?? m.index + m[0].length,
          block?.section,
        );
        const fact = {
          kind,
          ...fields,
          evidence,
          scope: block?.sectionScope || block?.governing || doc.id,
        };
        facts.push(fact);
        return fact;
      };
      const collect = (pattern, kind, parse) => {
        for (const m of page.text.matchAll(pattern)) {
          const fields = parse(m);
          if (
            fields &&
            (fields.value === undefined || (Number.isFinite(fields.value) && fields.value >= 0))
          )
            make(m, kind, fields);
        }
      };
      const sow =
        page.text.match(/^\s*Statement of Work\s+(\d+)\s*$/im)?.[1] ||
        doc.pages[0]?.text.match(/^\s*Statement of Work\s+(\d+)\s*$/im)?.[1];
      collect(
        new RegExp(
          `\\b(?:Every|Each|The|This|An?)\\s+invoice(?:\\s+under\\s+Statement\\s+of\\s+Work\\s+(\\d+))?\\s+is\\s+payable\\s+within\\s+(${number})\\s+(calendar|business)\\s+days?\\s+after\\s+(receipt|delivery|acceptance|invoice\\s+date)\\b`,
          'gi',
        ),
        'payment',
        (m) => ({
          value: quantity(m[2]),
          unit: normalize(m[3]),
          anchor: normalize(m[4]),
          work: m[1] || sow || null,
        }),
      );
      collect(
        new RegExp(
          `\\bservice\\s+term\\s+starts\\s+on\\s+(${date})\\s+and\\s+ends\\s+on\\s+(${date})`,
          'gi',
        ),
        'term',
        (m) => {
          const start = calendarDate(m[1]),
            end = calendarDate(m[2]);
          return start !== null && end !== null && start <= end
            ? { start, end, startText: m[1], endText: m[2] }
            : null;
        },
      );
      collect(
        new RegExp(`\\bProduction\\s+Launch\\s+is\\s+scheduled\\s+for\\s+(${date})`, 'gi'),
        'launch',
        (m) => {
          const value = calendarDate(m[1]);
          return value === null ? null : { value, dateText: m[1] };
        },
      );
      collect(
        new RegExp(
          `\\bEither\\s+party\\s+may\\s+terminate\\s+for\\s+(convenience|cause)\\s+by\\s+giving\\s+at\\s+least\\s+(${number})\\s+(calendar|business)\\s+days?\\s+of\\s+written\\s+notice`,
          'gi',
        ),
        'notice',
        (m) => ({ anchor: normalize(m[1]), value: quantity(m[2]), unit: normalize(m[3]) }),
      );
      collect(
        new RegExp(
          `\\bAfter\\s+(service\\s+termination|contract\\s+termination|account\\s+closure),\\s*(Supplier|Provider|Customer)\\s+shall\\s+retain\\s+(?:a|the)\\s+(recovery|backup)\\s+copy\\s+of\\s+([^.;]{2,80}?)\\s+for\\s+(exactly|at\\s+least)\\s+(${number})\\s+(calendar|business)\\s+days?`,
          'gi',
        ),
        'retain',
        (m) => ({
          anchor: normalize(m[1]),
          actor: normalize(m[2]),
          copy: normalize(m[3]),
          object: normalize(m[4]),
          bound: normalize(m[5]),
          value: quantity(m[6]),
          unit: normalize(m[7]),
        }),
      );
      collect(
        new RegExp(
          `\\b(Supplier|Provider|Customer)\\s+shall\\s+(?:permanently\\s+)?delete\\s+(every|all)\\s+cop(?:y|ies)\\s+of\\s+([^,.;]{2,80}),\\s*(including|excluding)\\s+(?:all\\s+)?(recovery|backup)\\s+copies,\\s*within\\s+(${number})\\s+(calendar|business)\\s+days?\\s+after\\s+(service\\s+termination|contract\\s+termination|account\\s+closure)`,
          'gi',
        ),
        'delete',
        (m) => ({
          actor: normalize(m[1]),
          object: normalize(m[3]),
          includes: normalize(m[4]) === 'including',
          copy: normalize(m[5]),
          value: quantity(m[6]),
          unit: normalize(m[7]),
          anchor: normalize(m[8]),
        }),
      );

      // Only acceptance obligations, not general occurrences of "shortly" or
      // capitalized phrases, create an acceptance timing question.
      for (const block of blocks.filter(
        (b) => b.page === page.number && /\baccept(?:ance|ed|\s+or\s+reject)\b/i.test(b.text),
      )) {
        const vague = block.text.match(/\bshortly\s+after\s+delivery\b/i);
        const window = block.text.match(
          /\bwithin\s+(?:the\s+)?(?:applicable\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?=[,.;])/,
        );
        const automatic = /\bautomatically\s+accepted\b/i.test(block.text);
        const definition =
          window &&
          packageFacts
            .filter((f) => f.status !== 'superseded')
            .flatMap((f) => f.definitions)
            .find(
              (f) =>
                f.term === normalize(window[1]) &&
                linkedServices(context, doc.id, f.evidence.documentId),
            );
        const undefinedWindow = automatic && window && !definition;
        const measured = definition?.meaning.match(
          new RegExp(
            `\\b(${number})\\s+(?:business|calendar)\\s+days?\\s+(?:after|from)\\s+(?:delivery|receipt|acceptance)\\b`,
            'i',
          ),
        );
        const unmeasuredWindow =
          automatic &&
          window &&
          definition &&
          !(measured && Number.isFinite(quantity(measured[1])));
        if (!vague && !undefinedWindow && !unmeasuredWindow) continue;
        checks.push({
          type: 'Ambiguity',
          subtype: 'Acceptance timing',
          title: 'Acceptance timing needs clarification',
          severity: 'review',
          evidence: [block, ...(unmeasuredWindow ? [definition.evidence] : [])],
          description: [
            vague
              ? 'The acceptance response is due “shortly after delivery,” without a measurable interval.'
              : '',
            undefinedWindow
              ? `Automatic acceptance uses “${window[1]}” with no definition established in the supplied contract package.`
              : '',
            unmeasuredWindow
              ? `The supplied definition of “${window[1]}” does not establish a measurable review interval, day type and clock trigger.`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
          question: `Please confirm the acceptance response interval, day type and event that starts the clock.${undefinedWindow ? ` Please define “${window[1]}” and confirm when automatic acceptance takes effect.` : ''}${unmeasuredWindow ? ` Please supply measurable timing for “${window[1]}” and confirm when automatic acceptance takes effect.` : ''}`,
          identity: `${doc.id}:${block.sectionScope}:${normalize(block.section)}:acceptance`,
          impact:
            'Acceptance reminders and automatic-acceptance timing cannot be configured reliably from the cited wording.',
        });
      }

      const timeUnit = '(?:minutes?|hours?|Business\\s+Days?|calendar\\s+days?)';
      collect(
        new RegExp(
          `\\bFor\\s+each\\s+(Priority\\s+[A-Za-z0-9]+\\s+Incident),\\s*(Supplier|Provider)\\s+shall\\s+provide\\s+its\\s+first\\s+human\\s+response\\s+no\\s+later\\s+than\\s+(${number})\\s+(${timeUnit})\\s+after\\s+the\\s+incident\\s+is\\s+reported`,
          'gi',
        ),
        'response',
        (m) => ({
          priority: normalize(m[1]),
          ...duration(m[3], m[4]),
          anchor: 'report receipt',
          action: 'first human response',
        }),
      );
      collect(
        new RegExp(
          `\\b(Priority\\s+[A-Za-z0-9]+\\s+Incident):\\s*first\\s+human\\s+response\\s+within\\s+(${number})\\s+(${timeUnit})\\s+after\\s+report\\b`,
          'gi',
        ),
        'response',
        (m) => ({
          priority: normalize(m[1]),
          ...duration(m[2], m[3]),
          anchor: 'report receipt',
          action: 'first human response',
        }),
      );
    }
  }

  const shared = (a, b) =>
    a.evidence.documentId === b.evidence.documentId
      ? a.scope === b.scope
      : linkedServices(context, a.evidence.documentId, b.evidence.documentId);
  const add = (subtype, title, a, b, description, question, impact) => {
    checks.push({
      type: 'Contradiction',
      subtype,
      title,
      severity: 'review',
      evidence: [a.evidence, b.evidence],
      facts: [a, b],
      description,
      question,
      impact,
      identity: `${subtype}:${[a, b]
        .map((f) => `${f.evidence.documentId}:${f.scope}:${normalize(f.evidence.section)}`)
        .sort()
        .join(':')}`,
    });
  };
  for (let i = 0; i < facts.length; i++)
    for (let j = i + 1; j < facts.length; j++) {
      const a = facts[i],
        b = facts[j];
      if (!shared(a, b)) continue;
      if (
        a.kind === 'payment' &&
        b.kind === 'payment' &&
        a.value !== b.value &&
        a.unit === b.unit &&
        a.anchor === b.anchor &&
        a.work &&
        a.work === b.work
      ) {
        const restriction = [a, b].find((f) =>
          /\bno\s+alternate\b[\s\S]{0,100}\bpermitted\b/i.test(f.evidence.text),
        );
        add(
          'Payment terms',
          'Payment terms differ',
          a,
          b,
          `The invoice payment periods for Statement of Work ${a.work} are ${period(a)} and ${period(b)} after ${a.anchor}.${restriction ? ' A cited clause prohibits alternate payment terms or overrides in a statement of work.' : ''}`,
          'Which payment deadline applies to these invoices? Confirm the applicable rule, any stated restriction on overrides, and the wording that needs correction.',
          'Invoice due-date calculation has different source periods.',
        );
      }
      if (
        a.kind === 'notice' &&
        b.kind === 'notice' &&
        a.value !== b.value &&
        a.unit === b.unit &&
        a.anchor === b.anchor
      ) {
        const restriction = [a, b].find((f) =>
          /\bcannot\s+be\s+shortened\b/i.test(f.evidence.text),
        );
        add(
          'Termination notice',
          'Termination notice wording differs',
          a,
          b,
          `Termination for ${a.anchor} requires ${period(a)} in one clause and ${period(b)} in another.${restriction ? ' The cited notice clause explicitly says the period cannot be shortened by any other clause.' : ''}`,
          'Please confirm the intended notice wording and any correction needed, taking the explicit instruction against shortening the period into account.',
          'Termination notice templates and due-date calculations need consistent instructions.',
        );
      }
      const term = a.kind === 'term' ? a : b.kind === 'term' ? b : null,
        launch = a.kind === 'launch' ? a : b.kind === 'launch' ? b : null;
      if (term && launch && (launch.value < term.start || launch.value > term.end)) {
        add(
          'Launch date',
          'Production launch falls outside the service term',
          term,
          launch,
          `The authorized service term is ${term.startText} through ${term.endText}; Production Launch is scheduled for ${launch.dateText}, ${launch.value < term.start ? 'before the term starts' : 'after the term ends'}.`,
          'Which production launch date and authorized service term should be recorded? Confirm any correction or expressly authorized exception before scheduling production.',
          'The production release schedule and authorized service period do not align.',
        );
      }
      const retain = a.kind === 'retain' ? a : b.kind === 'retain' ? b : null,
        del = a.kind === 'delete' ? a : b.kind === 'delete' ? b : null;
      if (
        retain &&
        del &&
        del.includes &&
        retain.value > del.value &&
        ['actor', 'object', 'copy', 'unit', 'anchor'].every((k) => retain[k] === del[k])
      ) {
        add(
          'Retention and deletion',
          'Retention and deletion periods conflict',
          retain,
          del,
          `The same ${retain.object} recovery copies must be retained for ${period(retain)} after ${retain.anchor}, while every copy, including recovery copies, must be deleted within ${period(del)} after that event. Both stated requirements cannot be met for those copies.`,
          'Please reconcile the retention duration and deletion deadline for the same data and recovery copies. Confirm the intended rule and any explicit exception.',
          'Retention and deletion jobs have incompatible instructions for the same copies.',
        );
      }
      if (
        a.kind === 'response' &&
        b.kind === 'response' &&
        a.priority === b.priority &&
        a.anchor === b.anchor &&
        a.action === b.action &&
        a.minutes !== null &&
        b.minutes !== null &&
        a.minutes !== b.minutes
      ) {
        add(
          'Response deadline',
          'Incident response deadlines differ',
          a,
          b,
          `The same ${a.priority} first human response is due within ${a.value} ${a.unit}s and ${b.value} ${b.unit}s after ${a.anchor}. These equal ${a.minutes} and ${b.minutes} elapsed minutes.`,
          'Which first human response deadline applies to this incident priority? Confirm the elapsed-time limit, reporting trigger and any service tier or exception.',
          'Incident-response timers have competing limits for the same priority and event.',
        );
      }
    }
  return checks.filter(
    (check, index) =>
      checks.findIndex((other) => stableId(other.identity) === stableId(check.identity)) === index,
  );
}
