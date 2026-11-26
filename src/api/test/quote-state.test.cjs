const test = require('node:test');
const assert = require('node:assert/strict');
const { requireQuoteOffer, requireQuoteResponse, quoteAfterAcceptance, quoteAfterDepositConfirmation } = require('../dist/quote-state.js');

test('only an outstanding, unexpired quote may be answered', () => {
  assert.doesNotThrow(() => requireQuoteOffer('Requested'));
  assert.throws(() => requireQuoteOffer('Offered'));
  const now = new Date('2026-01-01T10:00:00Z');
  assert.doesNotThrow(() => requireQuoteResponse('Offered', new Date('2026-01-01T10:00:01Z'), now));
  assert.throws(() => requireQuoteResponse('Offered', now, now), /expired/);
  assert.throws(() => requireQuoteResponse('Accepted', new Date('2027-01-01T00:00:00Z'), now));
});

test('a deposit-pending quote does not become accepted until the provider verifies payment', () => {
  assert.equal(quoteAfterAcceptance(3500, false), 'DepositPending');
  assert.equal(quoteAfterAcceptance(0, false), 'Accepted');
  assert.equal(quoteAfterDepositConfirmation('DepositPending', false), 'Accepted');
  assert.throws(() => quoteAfterAcceptance(0, true), /no longer available/);
  assert.throws(() => quoteAfterDepositConfirmation('DepositPending', true), /no longer available/);
  assert.throws(() => quoteAfterDepositConfirmation('Accepted', false));
});
