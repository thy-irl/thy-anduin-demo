// Display copy only: retain detector identities, stored review history and user edits.
export const referenceNames = {
  'internal target missing': 'Not matched in checked text',
  'ambiguous target': 'Possible match needs review',
  'insufficient extraction coverage': 'Text coverage incomplete',
  'external document not supplied': 'External source not matched',
  resolved: 'Reference matched',
};

export const sourceLocation = (e) =>
  [e?.document, e?.section, e?.page && `${e.locator || 'Page'} ${e.page}`]
    .filter(Boolean)
    .join(', ');

// Only exact known generated defaults are replaced. Unknown and edited questions survive.
export function findingCopy(f) {
  if (f.manual) return f;
  if (f.type === 'Preflight') return f;
  const result = { ...f },
    evidence = f.evidence || [],
    source = evidence[0],
    location = sourceLocation(source),
    term = f.title?.match(/“([^”]+)”/)?.[1];
  const question = (old, next) => {
    if (f.question === old) result.question = next;
  };
  if (f.type === 'Missing attachment' && f.target) {
    const target = f.target,
      gap = f.classification === 'insufficient extraction coverage',
      ambiguous = f.classification === 'ambiguous target',
      application = f.domain === 'services' ? 'contract' : 'application',
      identity =
        f.domain === 'services'
          ? 'contract parties, agreement and version'
          : 'agreement, fund and version';
    result.title =
      gap || ambiguous
        ? `Check whether ${target} is included`
        : `${target} not found in checked text`;
    result.description = gap
      ? `${location ? `${location} refers to ${target}. ` : ''}Some uploaded content could not be checked as text. Review the original documents to see whether they contain ${target}. Scanned image text is not read automatically.`
      : ambiguous
        ? `${location ? `${location} refers to ${target}. ` : ''}A possible attachment match needs review. Check which uploaded ${target} belongs to this ${identity}.`
        : `${location ? `${location} refers to ${target}. ` : ''}We couldn’t match it to attachment content for this agreement in the readable text we checked. Check the original documents and confirm whether the attachment was supplied.`;
    result.impact = `${target}: the team needs the attachment content to identify its questions, answer choices and supporting-information requirements.`;
    question(
      `Please supply the substantive ${target} or confirm its applicability and governing scope.`,
      `Please provide ${target}${location ? ` referenced in ${location}` : ''}, or confirm whether the requirement applies to this ${application}.`,
    );
    question(
      `Which supplied ${target} candidate governs this reference? Confirm agreement, fund and version identity.`,
      `Which uploaded ${target} should we use${source?.document ? ` for ${source.document}` : ''} and this ${application}? Please confirm the ${identity}.`,
    );
    question(
      `Inspect the ${target} reference and unreadable/image pages to verify presence. OCR was not performed; do not conclude that material is missing before checking the original.`,
      `If the original documents do not contain ${target}, please provide a copy or confirm whether the requirement applies to this ${application}.`,
    );
    if (f.description?.includes('A supplied attachment identifies a different fund')) {
      result.description +=
        ' An uploaded attachment appears to name a different fund. Check its fund, agreement and version before using it.';
    }
  } else if (f.type === 'Broken reference' && f.target) {
    const gap = f.classification === 'insufficient extraction coverage';
    result.title = `Reference to ${f.target} needs checking`;
    result.description = gap
      ? `${location ? `${location} refers to ${f.target}. ` : ''}Some source content could not be checked as text. Check the original agreement for the referenced provision before concluding that it is missing.`
      : `${location ? `${location} refers to ${f.target}. ` : ''}We couldn’t match that section number to a heading in this agreement’s checked text. Check the original agreement for the section or a numbering error.`;
    result.impact = `${f.target}: the referenced instructions cannot be mapped from this reference alone.`;
    question(
      `Which provision should ${f.target} identify? Confirm the internal target or supply the governing companion.`,
      `Which provision should the reference to ${f.target}${location ? ` in ${location}` : ''} point to? Please provide the provision or the corrected reference.`,
    );
  } else if (f.type === 'Defined term' && term) {
    const conflict =
      f.subtype === 'Conflicting definitions' || /^Inconsistent definition/.test(f.title);
    result.title = conflict
      ? `Definitions of “${term}” differ`
      : `Definition of “${term}” not found in checked text`;
    result.description = conflict
      ? `The cited definitions of “${term}” differ. Review both passages and check whether they apply to the same investor and requirement. Different agreements may use different definitions.`
      : `${location ? `${location} uses “${term}”. ` : ''}We couldn’t match it to a definition in the text checked for this agreement. Check the original and any referenced definitions.`;
    result.impact = conflict
      ? 'Confirm which definition applies before configuring a requirement that uses this term.'
      : 'Confirm who or what this term covers before configuring a requirement that uses it.';
    question(
      `Which definition of “${term}” governs the identified investor and provision?`,
      `Which cited definition of “${term}” applies to this investor and requirement?`,
    );
    question(
      `Please identify the governing definition of “${term}” and its applicability.`,
      `Please provide the definition of “${term}” for this application, or identify its source and who or what it covers.`,
    );
    question(
      `Please identify what qualifies an investor for “${term}”, its governing definition and applicability, and which supplemental verification fields are required.`,
      `Who qualifies as a “${term}”${location ? ` under ${location}` : ''}, and which supplemental verification fields are required? Please provide the definition and field requirements, or identify their source.`,
    );
  } else if (f.type === 'Cross-document' && f.facts?.length === 2) {
    const [a, b] = f.facts,
      amount = (v) => `${v.currency} ${v.amount.toLocaleString('en-US')}`,
      commitment = f.facts.every((v) => /commitment/i.test(v.provision || v.evidence?.text || '')),
      name = commitment ? 'commitment' : 'investment',
      contribution = ['initial', 'additional'].includes(a.contribution) ? `${a.contribution} ` : '';
    result.title = `${contribution ? contribution[0].toUpperCase() + contribution.slice(1) : 'Minimum '}${name} ${contribution ? 'minimums' : 'amounts'} differ`;
    result.description = `${sourceLocation(a.evidence) || 'One cited passage'} states ${amount(a)}. ${sourceLocation(b.evidence) || 'The other cited passage'} states ${amount(b)}. Review both passages, including any wording about waivers or exceptions. Check whether both apply to the same investor, class and closing.`;
    result.impact = `Confirm the applicable minimum before configuring ${contribution}${name} validation: ${amount(a)} or ${amount(b)}.`;
    question(
      'Which minimum applies to this investor, class and closing? Confirm both provisions and whether an exception was exercised.',
      `Which minimum ${contribution}${name} applies to this investor, class and closing: ${amount(a)} or ${amount(b)}? Please confirm the amount, any applicable exception and any source correction needed.`,
    );
  } else if (['Receipt cutoff', 'Processing deadline'].includes(f.subtype)) {
    const receipt = f.subtype === 'Receipt cutoff',
      phrase = f.description?.match(/uses “([^”]+)”/)?.[1];
    result.title = `Application ${receipt ? 'receipt' : 'processing'} timing needs clarification`;
    result.description = `${location ? `${location} ` : 'The cited passage '}${phrase ? `uses “${phrase}”` : 'describes application timing'}. The checked wording does not establish a measurable ${receipt ? 'receipt cutoff' : 'processing interval'}. Check for a definition or a separate timing rule.`;
    result.impact = receipt
      ? 'A rule for deciding whether an application arrived on time cannot be configured from this wording alone.'
      : 'A processing due date cannot be calculated from this wording alone.';
    question(
      receipt
        ? 'What objective application receipt cutoff should the form enforce? Confirm the date/time, time zone and triggering event.'
        : 'What measurable processing deadline should be used? Confirm the interval, business/calendar day type and event that starts the clock.',
      receipt
        ? 'Is a specific application receipt cutoff required? If so, please confirm the cutoff, time zone and event or date it is measured from.'
        : 'Is a specific processing deadline required? If so, please confirm the interval, whether it uses business or calendar days, and when it starts.',
    );
  } else if (f.subtype === 'Spelling' && f.suggestion && term) {
    result.description = `The source says “${term}”. This may be a spelling error for “${f.suggestion}”. Check the original and route a routine correction to the document owner.`;
    result.impact =
      'A possible spelling correction in the source text. No specific configuration blocker is established.';
    question(
      `Should “${term}” be corrected to “${f.suggestion}”?`,
      `Please check “${term}”${location ? ` in ${location}` : ''} and confirm whether it should read “${f.suggestion}”.`,
    );
  } else if (f.subtype === 'Funding deadline' && f.facts?.length === 2) {
    const values = f.facts.map((v) => `${v.value} ${v.unit} days after ${v.anchor}`);
    result.description =
      f.facts
        .map(
          (v, i) =>
            `${sourceLocation(v.evidence) || `Cited passage ${i + 1}`} states ${values[i]}.`,
        )
        .join(' ') +
      ' Review both passages and any stated limits on extensions before configuring the deadline.';
    result.impact =
      'Confirm the applicable funding rule before configuring the due-date calculation.';
    question(
      `Which funding deadline applies: ${values.join(' or ')}? Confirm the applicable investor, clock trigger and any exception.`,
      `Which funding deadline applies: ${values.join(' or ')}? Please confirm the investor, when the period starts, and any stated limits on extensions.`,
    );
  }
  if (f.classification) {
    result.certainty = referenceNames[f.classification] || f.certainty;
    if (f.uncertainty === f.classification) result.uncertainty = result.certainty;
  }
  return result;
}
