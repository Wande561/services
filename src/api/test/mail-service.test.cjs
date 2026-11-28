const test = require('node:test');
const assert = require('node:assert/strict');
const { MailService } = require('../dist/mail.service.js');

function withEnv(values, run) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('mail service is a no-op when Resend is not configured', async () => {
  const previousFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not be called'); };
  try {
    await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined }, async () => {
      const mail = new MailService();
      assert.equal(mail.isConfigured(), false);
      assert.equal(await mail.send({ to: 'client@example.com', subject: 'Hello', text: 'Body' }), false);
      assert.equal(called, false);
    });
  } finally {
    global.fetch = previousFetch;
  }
});

test('mail service sends a bounded Resend request without extra payload fields', async () => {
  const previousFetch = global.fetch;
  let sent;
  global.fetch = async (url, options) => {
    sent = { url, options };
    return { ok: true, status: 200 };
  };
  try {
    await withEnv({ RESEND_API_KEY: 'test-key', MAIL_FROM: 'ServiceConnect <hello@example.com>' }, async () => {
      const mail = new MailService();
      assert.equal(mail.isConfigured(), true);
      assert.equal(await mail.send({ to: 'client@example.com', subject: 'Appointment reminder', text: 'Tomorrow at 09:00.' }), true);
      assert.equal(sent.url, 'https://api.resend.com/emails');
      assert.equal(sent.options.method, 'POST');
      assert.equal(sent.options.headers.Authorization, 'Bearer test-key');
      const payload = JSON.parse(sent.options.body);
      assert.equal(payload.from, 'ServiceConnect <hello@example.com>');
      assert.deepEqual(payload.to, ['client@example.com']);
      assert.equal(payload.subject, 'Appointment reminder');
      assert.match(payload.text, /Tomorrow at 09:00\./);
      assert.match(payload.text, /ServiceConnect · Verulam, South Africa/);
      assert.match(payload.html, /Tomorrow at 09:00\./);
      assert.match(payload.html, /ServiceConnect/);
      assert.equal(typeof payload.reply_to, 'string');
      assert.equal(payload.idempotencyKey, undefined);
    });
  } finally {
    global.fetch = previousFetch;
  }
});

test('mail service reports provider failures without throwing', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429 });
  try {
    await withEnv({ RESEND_API_KEY: 'test-key', MAIL_FROM: 'hello@example.com' }, async () => {
      assert.equal(await new MailService().send({ to: 'client@example.com', subject: 'Hi', text: 'Body' }), false);
    });
  } finally {
    global.fetch = previousFetch;
  }
});
