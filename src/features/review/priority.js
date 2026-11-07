// Keep legacy stored severity values; review findings already block internal handoff.
export const priorityOf = (severity) => (severity === 'advisory' ? 'advisory' : 'blocking');
export const priorityOptions = { blocking: 'Blocking', advisory: 'Note' };
export const severityNames = { ...priorityOptions, review: 'Blocking' };
export const priorityDescriptions = {
  blocking: 'Must be addressed before handoff',
  advisory: 'Remains visible but does not block handoff by itself',
};
