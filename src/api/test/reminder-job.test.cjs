const test = require('node:test');
const assert = require('node:assert/strict');
const { NotificationsService } = require('../dist/notifications.service');
const { NotificationsController } = require('../dist/notifications.controller');

test('reminder endpoint requires the scheduler secret', async () => {
  const old = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'a-long-test-secret';
  let called = 0;
  const controller = new NotificationsController({}, { sendUpcomingReminders: async () => { called++; } });
  const req = value => ({ get: () => value });
  try {
    await assert.rejects(controller.runReminders(req('Bearer wrong')), { status: 401 });
    await assert.rejects(controller.runReminders(req('')), { status: 401 });
    assert.deepEqual(await controller.runReminders(req('Bearer a-long-test-secret')), { success: true });
    assert.equal(called, 1);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});

test('failed reminder email is retried and marked sent after success', async () => {
  let sentAt = null, attempts = 0;
  const future = new Date(Date.now() + 3600000);
  const db = {
    quoteRequest: { findMany: async () => [{ id: 'q', clientId: 'u', listing: { title: 'Service' }, versions: [{ id: 'v', expiresAt: future }] }] },
    notificationPreference: { findUnique: async () => null },
    quoteAlert: { createMany: async () => ({}), findUnique: async () => ({ id: 'alert', emailSentAt: sentAt }), update: async ({ data }) => { sentAt = data.emailSentAt; } },
    booking: { findMany: async () => [] },
    user: { findUnique: async () => ({ email: 'test@example.com', name: null, notificationPreference: null }) },
  };
  const service = new NotificationsService(db, { send: async message => { assert.equal(message.idempotencyKey, 'quote-expiry:q:v'); return ++attempts > 1; } });
  await assert.rejects(service.sendUpcomingReminders(), /could not be delivered/);
  assert.equal(sentAt, null);
  await service.sendUpcomingReminders();
  assert.ok(sentAt instanceof Date);
  await service.sendUpcomingReminders();
  assert.equal(attempts, 2);
});
