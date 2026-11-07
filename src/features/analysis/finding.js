// Presentation metadata is independent of the legacy type used in stable finding IDs.
export function findingDetails(f) {
  let category = f.category,
    subtype = f.subtype,
    certainty = f.certainty,
    impact = f.impact;
  if (f.type === 'Missing attachment') {
    category ||= 'Missing reference';
    subtype ||= 'Missing attachment';
    impact = `${f.target || f.title.replace(/^(Missing|Verify) /, '')}: supporting content is needed to configure its questions, answer choices or required evidence.`;
  } else if (f.type === 'Broken reference') {
    category ||= 'Missing reference';
    subtype ||= 'Internal section reference';
    impact = `${f.target || f.title}: the referenced provision cannot yet be mapped to its form requirement or conditional branch.`;
  } else if (f.type === 'Defined term') {
    const conflict = /^Inconsistent definition/.test(f.title);
    category ||= conflict ? 'Contradiction' : 'Missing reference';
    subtype ||= conflict ? 'Conflicting definitions' : 'Undefined term';
    impact = conflict
      ? 'Competing definitions can change the investor population, answer type or eligibility branch. Confirm the governing definition.'
      : 'The population or condition using this term cannot be described consistently until its governing definition is identified.';
  } else if (f.type === 'Cross-document') {
    category ||= 'Contradiction';
    subtype ||= 'Minimum investment';
    const values = f.facts?.map((a) => `${a.currency} ${a.amount.toLocaleString('en-US')}`);
    impact = `Minimum investment validation${values?.length ? `: ${[...new Set(values)].join(' versus ')}` : ''}. Confirm investor, class, closing and exceptions before setting the form limit.`;
  }
  category ||= f.type;
  subtype ||= f.type;
  certainty ||=
    f.classification === 'internal target missing'
      ? 'Target not established in supplied readable text'
      : f.classification || 'Applicability requires reviewer confirmation';
  return { category, subtype, certainty, impact };
}
export const describeFinding = (f) =>
  `${findingDetails(f).category} · ${findingDetails(f).subtype}`;
