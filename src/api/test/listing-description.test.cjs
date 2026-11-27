const test = require('node:test');
const assert = require('node:assert/strict');
const { ServicesService } = require('../dist/services.service.js');

const listing = { title: 'Garden care', category: 'Gardening', location: 'Cape Town', priceCents: 10000, priceUnit: 'PerHour' };
const result = { id: 'one', ...listing, description: '', maxPriceCents: null, isPublished: false, provider: { businessName: 'Garden Co', verificationTier: 'Basic', _count: { portfolioItems: 0 } }, _count: { bookings: 0 } };

test('new listings can be created without a description', async () => {
  let data;
  const service = new ServicesService({ serviceListing: { create: async args => { data = args.data; return result; } } });
  await service.create('provider', listing);
  assert.equal(data.description, '');
});

test('editing without a description leaves existing descriptions unchanged', async () => {
  let data;
  const tx = { serviceListing: { findFirst: async () => ({ photos: [] }), update: async args => { data = args.data; return { ...result, photos: [] }; } } };
  const db = {
    serviceListing: { findFirst: async () => ({ photos: [] }) },
    $transaction: async run => run(tx),
  };
  const service = new ServicesService(db, { deleteMany: async () => {}, store: async () => {}, read: async () => {} });
  await service.update('provider', 'one', listing);
  assert.equal(data.description, undefined);
});
