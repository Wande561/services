const test = require('node:test');
const assert = require('node:assert/strict');
const { AiSessionGuard, AiRoleGuard } = require('../dist/ai/ai-auth.guard.js');
const { AiRateLimitGuard } = require('../dist/ai/ai-rate-limit.guard.js');
const { AiService } = require('../dist/ai/ai.service.js');
const { parseAiChatDto } = require('../dist/ai/ai-chat.dto.js');
const { UnauthorizedException } = require('@nestjs/common');
const { assertSecureFrontendOrigin } = require('../dist/production-config.js');

function context(req, handler = function providerRoute() {}) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class AiController {},
  };
}

function reflectorFor(roles) {
  return { getAllAndOverride: () => roles };
}

test('AI session guard rejects a missing session', async () => {
  const guard = new AiSessionGuard({ currentUser: async () => assert.fail('must not check an absent session') });
  await assert.rejects(guard.canActivate(context({ cookies: {} })), error => error.getStatus() === 401);
});

test('AI session guard rejects an invalid or expired session', async () => {
  const guard = new AiSessionGuard({ currentUser: async token => {
    assert.equal(token, 'expired-session');
    throw new UnauthorizedException();
  } });
  await assert.rejects(guard.canActivate(context({ cookies: { session: 'expired-session' } })), error => error.getStatus() === 401);
});

test('AI session guard recognises the client from the authenticated session', async () => {
  const guard = new AiSessionGuard({ currentUser: async token => {
    assert.equal(token, 'opaque-session');
    return { id: 'client-a', profile: { role: 'client', clientEnabled: true, providerEnabled: false } };
  } });
  const req = { cookies: { session: 'opaque-session' } };
  assert.equal(await guard.canActivate(context(req)), true);
  assert.deepEqual(req.aiPrincipal, { userId: 'client-a', role: 'client' });
});

test('AI session guard recognises the provider from the authenticated session', async () => {
  const guard = new AiSessionGuard({ currentUser: async () => ({ id: 'provider-a', profile: { role: 'provider', clientEnabled: false, providerEnabled: true } }) });
  const req = { cookies: { session: 'opaque-session' } };
  assert.equal(await guard.canActivate(context(req)), true);
  assert.deepEqual(req.aiPrincipal, { userId: 'provider-a', role: 'provider' });
});

test('client cannot access provider-only endpoint', () => {
  const guard = new AiRoleGuard(reflectorFor(['provider']));
  assert.throws(() => guard.canActivate(context({ aiPrincipal: { userId: 'client-a', role: 'client' } })), error => error.getStatus() === 403);
});

test('provider identity comes from the session and request body cannot impersonate another user', async () => {
  const guard = new AiSessionGuard({ currentUser: async () => ({ id: 'provider-a', profile: { role: 'provider', providerEnabled: true } }) });
  const req = { cookies: { session: 'provider-session' } };
  await guard.canActivate(context(req));
  assert.deepEqual(req.aiPrincipal, { userId: 'provider-a', role: 'provider' });
  assert.throws(() => parseAiChatDto({ message: 'Summarise my requests', userId: 'provider-b' }), error => error.getStatus() === 400);
  assert.equal(req.aiPrincipal.userId, 'provider-a');
});

test('AI request DTO rejects empty messages and unexpected authorization fields', () => {
  assert.throws(() => parseAiChatDto({ message: '  ' }), error => error.getStatus() === 400);
  assert.throws(() => parseAiChatDto({ message: 'Help', role: 'provider' }), error => error.getStatus() === 400);
});

test('AI request DTO rejects oversized messages and accepts a valid message', () => {
  assert.throws(() => parseAiChatDto({ message: 'x'.repeat(2001) }), error => error.getStatus() === 400);
  assert.equal(parseAiChatDto({ message: '  Help me  ' }).message, 'Help me');
});

test('AI rate limits are keyed by authenticated user and endpoint', () => {
  const priorMax = process.env.AI_RATE_LIMIT_MAX;
  const priorWindow = process.env.AI_RATE_LIMIT_WINDOW_MS;
  process.env.AI_RATE_LIMIT_MAX = '1';
  process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
  try {
    const guard = new AiRateLimitGuard();
    assert.equal(guard.canActivate(context({ aiPrincipal: { userId: 'provider-a', role: 'provider' }, path: '/ai/provider', route: { path: 'provider' } })), true);
    assert.throws(() => guard.canActivate(context({ aiPrincipal: { userId: 'provider-a', role: 'provider' }, path: '/ai/provider', route: { path: 'provider' } })), error => error.getStatus() === 429);
    assert.equal(guard.canActivate(context({ aiPrincipal: { userId: 'provider-b', role: 'provider' }, path: '/ai/provider', route: { path: 'provider' } })), true);
    assert.equal(guard.canActivate(context({ aiPrincipal: { userId: 'provider-a', role: 'provider' }, path: '/ai/support', route: { path: 'support' } })), true);
  } finally {
    if (priorMax === undefined) delete process.env.AI_RATE_LIMIT_MAX; else process.env.AI_RATE_LIMIT_MAX = priorMax;
    if (priorWindow === undefined) delete process.env.AI_RATE_LIMIT_WINDOW_MS; else process.env.AI_RATE_LIMIT_WINDOW_MS = priorWindow;
  }
});

test('AI rate limiter bounds the number of in-memory account buckets', () => {
  const priorMax = process.env.AI_RATE_LIMIT_MAX;
  process.env.AI_RATE_LIMIT_MAX = '100';
  try {
    const guard = new AiRateLimitGuard();
    for (let index = 0; index < 10_050; index += 1) {
      assert.equal(guard.canActivate(context({ aiPrincipal: { userId: `account-${index}`, role: 'client' }, path: '/ai/support', route: { path: 'support' } })), true);
    }
    assert.ok(guard.buckets.size <= 10_000);
  } finally {
    if (priorMax === undefined) delete process.env.AI_RATE_LIMIT_MAX; else process.env.AI_RATE_LIMIT_MAX = priorMax;
  }
});

test('missing AI credentials produce a safe configuration error on demand', () => {
  const prior = Object.fromEntries(['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL'].map(key => [key, process.env[key]]));
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = '';
  process.env.OPENAI_MODEL = '';
  try {
    const service = new AiService();
    assert.throws(() => service.getProviderConfiguration(), error => {
      assert.equal(error.getStatus(), 503);
      assert.match(error.message, /OPENAI_API_KEY and OPENAI_MODEL/);
      assert.doesNotMatch(error.message, /sk-|secret/i);
      return true;
    });
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('production startup requires FRONTEND_URL to be an exact HTTPS origin', () => {
  assert.doesNotThrow(() => assertSecureFrontendOrigin('https://service.example', 'production'));
  assert.doesNotThrow(() => assertSecureFrontendOrigin('http://localhost:3000', 'development'));
  for (const url of ['http://service.example', 'https://service.example/', 'https://service.example/path', undefined]) {
    assert.throws(() => assertSecureFrontendOrigin(url, 'production'), /HTTPS origin/);
  }
});
