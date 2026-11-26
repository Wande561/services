const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuotation } = require('../dist/quote-calculation.js');

test('calculates a 25% deposit in cents and the remaining balance', () => {
  assert.deepEqual(calculateQuotation({ labourCents: 10000, materialsCents: 2500, travelCents: 1000, depositRequired: true }), {
    labourCents: 10000, materialsCents: 2500, travelCents: 1000, totalCents: 13500, depositCents: 3375, balanceCents: 10125,
  });
  assert.equal(calculateQuotation({ labourCents: 1, materialsCents: 0, travelCents: 0, depositRequired: false }).depositCents, 0);
  assert.equal(calculateQuotation({ labourCents: 10, materialsCents: 0, travelCents: 0, depositRequired: true }).depositCents, 3);
});

test('rejects invalid amounts, totals, and zero deposits', () => {
  for (const labourCents of [-1, 1.5, '100', 2_147_483_648]) {
    assert.throws(() => calculateQuotation({ labourCents, materialsCents: 0, travelCents: 0, depositRequired: true }));
  }
  assert.throws(() => calculateQuotation({ labourCents: 2_147_483_647, materialsCents: 1, travelCents: 0, depositRequired: false }));
  assert.throws(() => calculateQuotation({ labourCents: 0, materialsCents: 0, travelCents: 0, depositRequired: true }));
});
