// Uses a disposable PostgreSQL schema; never changes the marketplace's data.
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { randomUUID, createHash } = require('crypto');
const { spawn, execFileSync } = require('child_process');
const assert = require('assert/strict');
const schema = `reliability_test_${randomUUID().replace(/-/g, '')}`;
const root = new PrismaClient(); const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: url.toString(), PORT: '31782' }; let api, db;
async function call(path, method, token, body) {
  const response = await fetch(`http://127.0.0.1:31782${path}`, { method, headers: { Cookie: `session=${token}`, Origin: process.env.FRONTEND_URL || 'http://localhost:3000', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function main() {
  await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    execFileSync('./node_modules/.bin/prisma', ['migrate', 'deploy'], { env, stdio: 'pipe' });
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    for (const [id, role] of [['client','client'], ['client2','client'], ['provider','provider'], ['provider2','provider'], ['admin','admin']]) {
      await db.user.create({ data: { id, email: `${id}@example.invalid`, name: id, isVerificationAdmin: id === 'admin', profile: { create: { role, phone: '0820000000', location: 'Test', ...(role === 'provider' ? { businessName: id, serviceCategories: ['Plumbing'] } : {}) } } } });
      await db.session.create({ data: { userId: id, tokenHash: createHash('sha256').update(id).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    }
    const listing = await db.serviceListing.create({ data: { providerId: 'provider', title: 'Plumbing', description: '', category: 'Plumbing', location: 'Test', priceCents: 10000, priceUnit: 'PerProject', isPublished: true } });
    const listing2 = await db.serviceListing.create({ data: { providerId: 'provider2', title: 'Cleaning', description: '', category: 'HouseCleaning', location: 'Test', priceCents: 10000, priceUnit: 'PerProject', isPublished: true } });
    async function makeBooking({ client = 'client', provider = 'provider', minutes = 600, deposit = false } = {}) {
      const startsAt = new Date(Date.now() + minutes * 60000); const endsAt = new Date(startsAt.getTime() + 3600000);
      const chosen = provider === 'provider' ? listing : listing2;
      const slot = await db.availabilitySlot.create({ data: { providerId: provider, startsAt, endsAt, isOpen: false } });
      const quote = deposit ? await db.quoteRequest.create({ data: { clientId: client, providerId: provider, listingId: chosen.id, description: 'Test', preferredAt: startsAt, location: 'Test', status: 'Accepted', depositCents: 2500, depositConfirmedAt: new Date(), depositConfirmedBy: provider } }) : null;
      return db.booking.create({ data: { clientId: client, listingId: chosen.id, slotId: slot.id, status: 'Confirmed', serviceTitle: 'Test service', address: 'Test', quoteRequestId: quote?.id } });
    }
    api = spawn('node', ['dist/main.js'], { env, stdio: 'ignore' });
    let ready = false; for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:31782/services')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); } if (!ready) throw Error('Test API did not start');
    const change = (id, actor, body = {}) => call(`/bookings/${id}/status`, 'PATCH', actor, { status: 'Cancelled', ...body });
    const mine = id => call('/reliability/mine', 'GET', id);
    const decide = (id, decision) => call(`/admin/reliability/${id}/decision`, 'POST', 'admin', { decision, note: 'Reviewed evidence' });
    const free = await makeBooking({ minutes: 1500 }); assert.equal((await change(free.id, 'client')).status, 200);
    assert.equal((await mine('client')).data.creditBalance, 0);
    const late = await makeBooking({ minutes: 600 }); assert.equal((await change(late.id, 'client')).status, 200);
    assert.equal((await mine('client')).data.creditBalance, -1);
    const providerLate = await makeBooking({ minutes: 600 }); assert.equal((await change(providerLate.id, 'provider')).status, 200);
    assert.equal((await mine('provider')).data.creditBalance, -1);
    const emergency = await makeBooking({ minutes: 60 }); assert.equal((await change(emergency.id, 'client', { emergency: true, reason: 'Emergency' })).status, 200);
    let state = (await mine('client')).data; const emergencyCase = state.cases.find(x => x.bookingId === emergency.id); assert.equal(emergencyCase.status, 'Pending'); assert.equal(state.creditBalance, -1);
    assert.ok((await call('/admin/reliability?filter=review&page=1', 'GET', 'admin')).data.items.some(item => item.id === emergencyCase.id));
    assert.equal((await call('/admin/reliability?page=0', 'GET', 'admin')).status, 400);
    assert.ok(!(await call('/reliability/cases?page=1', 'GET', 'client2')).data.items.some(item => item.id === emergencyCase.id));
    assert.equal((await decide(emergencyCase.id, 'exempt')).status, 201); assert.equal((await mine('client')).data.creditBalance, -1);
    const startedEmergency = await makeBooking({ minutes: -15 }); assert.equal((await change(startedEmergency.id, 'client', { emergency: true, reason: 'Emergency' })).status, 200); assert.equal((await mine('client')).data.cases.find(x => x.bookingId === startedEmergency.id).status, 'Pending');
    const depositClient = await makeBooking({ minutes: 60, deposit: true }); assert.equal((await change(depositClient.id, 'client')).status, 200);
    state = (await mine('client')).data; assert.equal(state.creditBalance, -1); assert.equal(state.cases.find(x => x.bookingId === depositClient.id).depositForfeitureCents, 2500);
    const depositProvider = await makeBooking({ minutes: 60, deposit: true }); assert.equal((await change(depositProvider.id, 'provider')).status, 200);
    state = (await mine('provider')).data; assert.equal(state.creditBalance, -3); assert.equal(state.cases.find(x => x.bookingId === depositProvider.id).depositForfeitureCents, 0);
    assert.ok((await mine('client')).data.alerts.some(x => x.bookingId === depositProvider.id && x.message.includes('refund')));
    const repeated = [];
    for (let i = 0; i < 7; i++) { const b = await makeBooking({ client: 'client2', provider: 'provider2', minutes: 60 }); assert.equal((await change(b.id, 'client2')).status, 200); repeated.push(b); }
    state = (await mine('client2')).data; assert.equal(state.creditBalance, -10); assert.ok(new Date(state.bookingRestrictedUntil) > new Date());
    const blocked = await call('/quotes', 'POST', 'client2', { listingId: listing.id, description: 'Test', location: 'Test', preferredAt: new Date(Date.now() + 86400000).toISOString() }); assert.equal(blocked.status, 403);
    const cases = state.cases.filter(x => repeated.some(b => b.id === x.bookingId));
    for (let i = 0; i < 3; i++) assert.equal((await decide(cases[i].id, 'reverse')).status, 201);
    assert.equal((await mine('client2')).data.creditBalance, -8);
    for (let i = 0; i < 3; i++) { const b = await makeBooking({ client: 'client2', provider: 'provider2', minutes: 60 }); assert.equal((await change(b.id, 'provider2')).status, 200); }
    state = (await mine('provider2')).data; assert.equal(state.creditBalance, -6); assert.ok(new Date(state.bookingRestrictedUntil) > new Date());
    const pendingQuote = await db.quoteRequest.create({ data: { clientId: 'client', providerId: 'provider2', listingId: listing2.id, description: 'Test', preferredAt: new Date(Date.now() + 86400000), location: 'Test' } });
    const restrictedOffer = await call(`/quotes/${pendingQuote.id}/offer`, 'POST', 'provider2', { serviceDescription: 'Service', labourCents: 100, materialsCents: 0, travelCents: 0, durationMinutes: 60, appointmentAt: new Date(Date.now() + 86400000).toISOString(), validHours: 5, depositRequired: false }); assert.equal(restrictedOffer.status, 403);
    const complete = await makeBooking({ minutes: 1200 });
    assert.equal((await call(`/bookings/${complete.id}/confirm-completion`, 'POST', 'client', {})).status, 201);
    assert.equal((await call(`/bookings/${complete.id}/confirm-completion`, 'POST', 'provider', {})).status, 201);
    assert.equal((await call(`/bookings/${complete.id}/confirm-completion`, 'POST', 'provider', {})).status, 201);
    assert.equal((await mine('client')).data.points, 1); assert.equal((await mine('provider')).data.points, 1);
    const punctual = await makeBooking({ minutes: -40 });
    const punctualReport = await call(`/reliability/bookings/${punctual.id}/report`, 'POST', 'client', { kind: 'Punctuality', reason: 'Arrived on time' }); assert.equal(punctualReport.status, 201);
    assert.equal((await mine('client')).data.points, 1); assert.equal((await decide(punctualReport.data.id, 'apply')).status, 201); assert.equal((await mine('client')).data.points, 2);
    const noShowIds = [];
    for (let i = 0; i < 2; i++) {
      const b = await makeBooking({ minutes: -45 });
      assert.equal((await call(`/reliability/bookings/${b.id}/report`, 'POST', 'provider', { kind: 'NoShow', reason: 'Not here', noCommunication: false })).status, 400);
      const report = await call(`/reliability/bookings/${b.id}/report`, 'POST', 'provider', { kind: 'NoShow', reason: 'Not here', noCommunication: true }); assert.equal(report.status, 201); noShowIds.push(report.data.id);
      assert.equal((await decide(report.data.id, 'apply')).status, 201);
      assert.equal((await db.booking.findUnique({ where: { id: b.id } })).status, 'Cancelled');
    }
    state = (await mine('client')).data; assert.equal(state.creditBalance, -7); assert.ok(new Date(state.suspendedUntil) > new Date());
    const existingQuote = await db.quoteRequest.create({ data: { clientId: 'client', providerId: 'provider', listingId: listing.id, description: 'Test', preferredAt: new Date(Date.now() + 86400000), location: 'Test', status: 'Quoted', versions: { create: { version: 1, serviceDescription: 'Test', labourCents: 100, materialsCents: 0, travelCents: 0, totalCents: 100, durationMinutes: 60, appointmentAt: new Date(Date.now() + 86400000), expiresAt: new Date(Date.now() + 3600000) } } } });
    assert.equal((await call(`/quotes/${existingQuote.id}/response`, 'POST', 'client', { action: 'accept' })).status, 403);
    assert.equal((await call('/auth/me', 'GET', 'client')).status, 200);
    assert.equal((await call('/quotes', 'POST', 'client', { listingId: listing.id, description: 'Test', location: 'Test', preferredAt: new Date(Date.now() + 86400000).toISOString() })).status, 403);
    assert.equal((await call(`/reliability/cases/${noShowIds[0]}/dispute`, 'POST', 'client', { reason: 'I was there' })).status, 201);
    assert.equal((await call(`/reliability/cases/${noShowIds[0]}/dispute`, 'POST', 'client2', { reason: 'Not mine' })).status, 409);
    assert.equal((await decide(noShowIds[0], 'reverse')).status, 201); state = (await mine('client')).data; assert.equal(state.creditBalance, -4); assert.equal(state.suspendedUntil, null);
    for (let i = 0; i < 2; i++) {
      const b = await makeBooking({ provider: 'provider2', minutes: -45 });
      if (i === 0) { const punctualReport = await call(`/reliability/bookings/${b.id}/report`, 'POST', 'provider2', { kind: 'Punctuality', reason: 'Arrived on time' }); assert.equal(punctualReport.status, 201); assert.equal((await decide(punctualReport.data.id, 'apply')).status, 201); assert.equal((await mine('provider2')).data.points, 1); }
      const report = await call(`/reliability/bookings/${b.id}/report`, 'POST', 'client', { kind: 'NoShow', reason: 'Not here', noCommunication: true }); assert.equal(report.status, 201);
      assert.equal((await decide(report.data.id, 'apply')).status, 201);
      if (i === 0) assert.equal((await mine('provider2')).data.points, 0);
    }
    state = (await mine('provider2')).data; assert.ok(new Date(state.suspendedUntil) > new Date()); assert.equal(state.creditBalance, -10);
    assert.equal((await call('/quotes', 'POST', 'client', { listingId: listing2.id, description: 'Test', location: 'Test', preferredAt: new Date(Date.now() + 86400000).toISOString() })).status, 403);
    assert.equal((await call('/services', 'POST', 'provider2', { title: 'New', category: 'Plumbing', location: 'Test', priceCents: 1, priceUnit: 'PerProject' })).status, 403);
    assert.equal((await call('/services/mine', 'GET', 'provider2')).status, 200);
    const challenged = await makeBooking({ minutes: -45 });
    const pendingNoShow = await call(`/reliability/bookings/${challenged.id}/report`, 'POST', 'provider', { kind: 'NoShow', reason: 'Not here', noCommunication: true }); assert.equal(pendingNoShow.status, 201);
    assert.equal((await call(`/bookings/${challenged.id}/confirm-completion`, 'POST', 'client', {})).status, 201);
    assert.equal((await call(`/bookings/${challenged.id}/confirm-completion`, 'POST', 'provider', {})).status, 201);
    assert.equal((await decide(pendingNoShow.data.id, 'apply')).status, 409);
    assert.equal((await decide(pendingNoShow.data.id, 'exempt')).status, 201);
    const rescheduledReportBooking = await makeBooking({ minutes: -45 });
    const rescheduledReport = await call(`/reliability/bookings/${rescheduledReportBooking.id}/report`, 'POST', 'provider', { kind: 'NoShow', reason: 'No communication', noCommunication: true }); assert.equal(rescheduledReport.status, 201);
    const rescheduledTime = new Date(Date.now() + 1000000000).toISOString();
    const rescheduledProposal = await call(`/reliability/bookings/${rescheduledReportBooking.id}/reschedules`, 'POST', 'client', { proposedAt: rescheduledTime }); assert.equal(rescheduledProposal.status, 201);
    assert.equal((await call(`/reliability/bookings/${rescheduledReportBooking.id}/reschedules/${rescheduledProposal.data.id}/respond`, 'POST', 'provider', { action: 'accept' })).status, 201);
    assert.equal((await decide(rescheduledReport.data.id, 'apply')).status, 409);
    assert.equal((await decide(rescheduledReport.data.id, 'exempt')).status, 201);
    assert.equal((await db.booking.findUnique({ where: { id: rescheduledReportBooking.id } })).status, 'Confirmed');
    const schedule = await makeBooking({ minutes: 1800 }); const proposedAt = new Date(Date.now() + 720000000).toISOString();
    assert.equal((await call(`/reliability/bookings/${schedule.id}/late`, 'POST', 'provider', { minutes: 20, note: 'Traffic' })).status, 201);
    const lateCase = (await mine('provider')).data.cases.find(item => item.bookingId === schedule.id && item.kind === 'LateArrival');
    assert.equal((await call(`/admin/reliability/${lateCase.id}/messages?page=1`, 'GET', 'client')).status, 403);
    const evidence = await call(`/admin/reliability/${lateCase.id}/messages?page=1`, 'GET', 'admin'); assert.ok(evidence.data.items.some(item => item.body.includes('Traffic')));
    const proposal = await call(`/reliability/bookings/${schedule.id}/reschedules`, 'POST', 'client', { proposedAt }); assert.equal(proposal.status, 201);
    assert.equal((await call(`/reliability/bookings/${schedule.id}/reschedules/${proposal.data.id}/respond`, 'POST', 'client', { action: 'accept' })).status, 409);
    assert.equal((await call(`/reliability/bookings/${schedule.id}/reschedules/${proposal.data.id}/respond`, 'POST', 'provider', { action: 'accept' })).status, 201);
    const updated = await db.booking.findUnique({ where: { id: schedule.id }, include: { slot: true } }); assert.equal(updated.slot.startsAt.toISOString(), proposedAt);
    for (const [id, role] of [['client3', 'client'], ['provider3', 'provider']]) {
      await db.user.create({ data: { id, email: `${id}@example.invalid`, profile: { create: { role, phone: '0820000000', location: 'Test' } } } });
      await db.session.create({ data: { userId: id, tokenHash: createHash('sha256').update(id).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    }
    const depositListing = await db.serviceListing.create({ data: { providerId: 'provider3', title: 'Deposit service', description: '', category: 'Plumbing', location: 'Test', priceCents: 10000, priceUnit: 'PerProject', isPublished: true } });
    async function depositBooking() {
      const startsAt = new Date(Date.now() - 45 * 60000); const slot = await db.availabilitySlot.create({ data: { providerId: 'provider3', startsAt, endsAt: new Date(startsAt.getTime() + 3600000), isOpen: false } });
      const quote = await db.quoteRequest.create({ data: { clientId: 'client3', providerId: 'provider3', listingId: depositListing.id, description: 'Test', preferredAt: startsAt, location: 'Test', status: 'Accepted', depositCents: 2500, depositConfirmedAt: new Date(), depositConfirmedBy: 'provider3' } });
      const b = await db.booking.create({ data: { clientId: 'client3', listingId: depositListing.id, slotId: slot.id, status: 'Confirmed', serviceTitle: 'Deposit service', address: 'Test', quoteRequestId: quote.id } }); return { b, quote };
    }
    const clientDepositNoShow = await depositBooking();
    const clientDepositReport = await call(`/reliability/bookings/${clientDepositNoShow.b.id}/report`, 'POST', 'provider3', { kind: 'NoShow', reason: 'No communication', noCommunication: true }); assert.equal(clientDepositReport.status, 201);
    assert.equal((await decide(clientDepositReport.data.id, 'apply')).status, 201);
    let depositState = (await mine('client3')).data; assert.equal(depositState.creditBalance, 0); assert.equal(depositState.cases.find(x => x.id === clientDepositReport.data.id).depositForfeitureCents, 2500);
    assert.equal((await call(`/reliability/cases/${clientDepositReport.data.id}/dispute`, 'POST', 'client3', { reason: 'Emergency' })).status, 201);
    assert.equal((await decide(clientDepositReport.data.id, 'reverse')).status, 201);
    depositState = (await mine('client3')).data; assert.equal(depositState.cases.find(x => x.id === clientDepositReport.data.id).status, 'Reversed'); assert.equal(depositState.cases.find(x => x.id === clientDepositReport.data.id).depositForfeitureCents, 2500);
    assert.equal((await db.quoteRequest.findUnique({ where: { id: clientDepositNoShow.quote.id } })).depositCents, 2500);
    const providerDepositNoShow = await depositBooking();
    const providerDepositReport = await call(`/reliability/bookings/${providerDepositNoShow.b.id}/report`, 'POST', 'client3', { kind: 'NoShow', reason: 'No communication', noCommunication: true }); assert.equal(providerDepositReport.status, 201);
    assert.equal((await decide(providerDepositReport.data.id, 'apply')).status, 201); assert.equal((await mine('provider3')).data.creditBalance, -3);
    assert.ok((await mine('client3')).data.alerts.some(x => x.bookingId === providerDepositNoShow.b.id && x.message.includes('refund')));
    for (const [id, role] of [['legacyclient', 'client'], ['legacyprovider', 'provider']]) await db.user.create({ data: { id, email: `${id}@example.invalid`, profile: { create: { role, phone: '0820000000', location: 'Test' } } } });
    const legacyListing = await db.serviceListing.create({ data: { providerId: 'legacyprovider', title: 'Past service', description: '', category: 'Plumbing', location: 'Test', priceCents: 100, priceUnit: 'PerProject' } });
    const legacySlot = await db.availabilitySlot.create({ data: { providerId: 'legacyprovider', startsAt: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000), isOpen: false } });
    const legacy = await db.booking.create({ data: { clientId: 'legacyclient', listingId: legacyListing.id, slotId: legacySlot.id, status: 'Completed', serviceTitle: 'Past service', address: 'Test' } });
    const backfill = require('fs').readFileSync('prisma/migrations/20261126001600_reliability_completion_history/migration.sql', 'utf8').split(';').map(x => x.trim()).filter(Boolean);
    for (const sql of backfill) await db.$executeRawUnsafe(sql);
    assert.equal((await db.reliabilityAccount.findUnique({ where: { userId: 'legacyclient' } })).points, 1);
    assert.equal((await db.reliabilityAccount.findUnique({ where: { userId: 'legacyprovider' } })).points, 1);
    for (const sql of backfill) await db.$executeRawUnsafe(sql);
    assert.equal(await db.reliabilityEntry.count({ where: { bookingId: legacy.id, kind: 'Completed' } }), 2);
    const conflictBooking = await makeBooking({ minutes: 1800 }); const occupied = await makeBooking({ minutes: 21000 });
    const occupiedTime = (await db.availabilitySlot.findUnique({ where: { id: occupied.slotId } })).startsAt.toISOString();
    const conflictingProposal = await call(`/reliability/bookings/${conflictBooking.id}/reschedules`, 'POST', 'client', { proposedAt: occupiedTime }); assert.equal(conflictingProposal.status, 201);
    assert.equal((await call(`/reliability/bookings/${conflictBooking.id}/reschedules/${conflictingProposal.data.id}/respond`, 'POST', 'provider', { action: 'accept' })).status, 409);
    assert.equal((await call(`/reliability/bookings/${conflictBooking.id}/reschedules/${conflictingProposal.data.id}/respond`, 'POST', 'provider', { action: 'decline' })).status, 201);
    const pendingStart = new Date(Date.now() + 2000000000); const depositSlot = await db.availabilitySlot.create({ data: { providerId: 'provider3', startsAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000), isOpen: false } });
    const moving = await db.booking.create({ data: { clientId: 'client3', listingId: depositListing.id, slotId: depositSlot.id, status: 'Confirmed', serviceTitle: 'Moving service', address: 'Test' } });
    const waiting = await db.quoteRequest.create({ data: { clientId: 'client', providerId: 'provider3', listingId: depositListing.id, description: 'Test', preferredAt: pendingStart, location: 'Test', status: 'DepositPending', depositCents: 2500, versions: { create: { version: 1, serviceDescription: 'Test', labourCents: 10000, materialsCents: 0, travelCents: 0, totalCents: 10000, depositRequired: true, depositCents: 2500, bankName: 'Test bank', accountNumber: '12345678', paymentReference: 'Test', durationMinutes: 60, appointmentAt: pendingStart, expiresAt: new Date(Date.now() + 3600000) } } } });
    const moveProposal = await call(`/reliability/bookings/${moving.id}/reschedules`, 'POST', 'client3', { proposedAt: pendingStart.toISOString() }); assert.equal(moveProposal.status, 201);
    assert.equal((await call(`/reliability/bookings/${moving.id}/reschedules/${moveProposal.data.id}/respond`, 'POST', 'provider3', { action: 'accept' })).status, 201);
    assert.equal((await db.quoteRequest.findUnique({ where: { id: waiting.id } })).status, 'SlotUnavailable'); assert.equal(await db.quoteAlert.count({ where: { requestId: waiting.id } }), 2);
    for (const [id, role] of [['client4', 'client'], ['provider4', 'provider']]) {
      await db.user.create({ data: { id, email: `${id}@example.invalid`, profile: { create: { role, phone: '0820000000', location: 'Test' } } } });
      await db.session.create({ data: { userId: id, tokenHash: createHash('sha256').update(id).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    }
    const concurrentListing = await db.serviceListing.create({ data: { providerId: 'provider4', title: 'Concurrent', description: '', category: 'Plumbing', location: 'Test', priceCents: 100, priceUnit: 'PerProject' } });
    const parallelBookings = [];
    for (let i = 0; i < 5; i++) { const startsAt = new Date(Date.now() + 3600000); const slot = await db.availabilitySlot.create({ data: { providerId: 'provider4', startsAt, endsAt: new Date(startsAt.getTime() + 3600000), isOpen: false } }); parallelBookings.push(await db.booking.create({ data: { clientId: 'client4', listingId: concurrentListing.id, slotId: slot.id, status: 'Confirmed', serviceTitle: 'Concurrent', address: 'Test' } })); }
    const simultaneous = await Promise.all(parallelBookings.map(item => change(item.id, 'client4'))); assert.ok(simultaneous.every(result => result.status === 200));
    const concurrentState = (await mine('client4')).data; assert.equal(concurrentState.creditBalance, -10); assert.ok(new Date(concurrentState.bookingRestrictedUntil) > new Date());
    assert.equal((await call('/admin/reliability', 'GET', 'client')).status, 403);
    console.log('Reliability, cancellation fairness, deposit records, caps, restrictions, disputes, reviews and rescheduling passed.');
  } finally { if (api) api.kill(); if (db) await db.$disconnect(); await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
