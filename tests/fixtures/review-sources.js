// Synthetic source text for review workflow regressions.
export const minimumQuote = (amount) => `The minimum initial investment is USD $${amount}.`;
export const agreementText = (amount) =>
  `CEDAR LEARNING FUND\nCedar Learning Fund, L.P.\nSUBSCRIPTION AGREEMENT\nSynthetic learning document; no real client or legal instruction.\n1. Initial subscription\n${minimumQuote(amount)}\nSubscriptions are subject to acceptance by the General Partner.`;
export const memorandumText = `CEDAR LEARNING FUND\nCedar Learning Fund, L.P.\nPRIVATE PLACEMENT MEMORANDUM\nSynthetic learning document; no real client or legal instruction.\n1. Initial subscription\n${minimumQuote('500,000')}\nSubscriptions are subject to acceptance by the General Partner.`;
