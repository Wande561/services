const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/serviceValue.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module('serviceValue'); mod._compile(js, 'serviceValue.js');
const { completedServiceValueCents } = mod.exports;
test('only completed quoted work contributes its full quoted price once', () => {
  const quote = { status: 'Completed', quoteRequestId: 'quote', listingPrice: { priceCents: 100000 }, quoteRequest: { depositCents: 25000, depositConfirmedAt: 'now' }, payments: [{ amountCents: 75000 }] };
  assert.equal(completedServiceValueCents([quote]), 100000);
  assert.equal(completedServiceValueCents([quote, { ...quote, status: 'Confirmed' }, { ...quote, status: 'Cancelled' }, { ...quote, quoteRequestId: null }, { ...quote, listingPrice: null }]), 100000);
});
