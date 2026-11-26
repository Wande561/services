const test = require('node:test');
const assert = require('node:assert/strict');
const { cancellationBand, arrivalBand } = require('../dist/reliability-policy.js');
const start = new Date('2026-12-01T10:00:00Z');
const before = minutes => new Date(start.getTime() - minutes * 60000);
const after = minutes => new Date(start.getTime() + minutes * 60000);
test('cancellation windows use the same exact boundaries for every account', () => {
  assert.equal(cancellationBand(start, before(24 * 60 + 1)), 'Free');
  assert.equal(cancellationBand(start, before(24 * 60)), 'Late');
  assert.equal(cancellationBand(start, before(120)), 'Late');
  assert.equal(cancellationBand(start, before(119)), 'VeryLate');
  assert.throws(() => cancellationBand(start, start));
});
test('the grace period and late arrival windows do not automatically establish a no-show', () => {
  assert.equal(arrivalBand(start, after(10), false), 'Grace');
  assert.equal(arrivalBand(start, after(14), false), 'Late');
  assert.equal(arrivalBand(start, after(15), false), 'Decision');
  assert.equal(arrivalBand(start, after(30), false), 'Decision');
  assert.equal(arrivalBand(start, after(31), false), 'NoShowEligible');
  assert.equal(arrivalBand(start, after(31), true), 'Decision');
});
