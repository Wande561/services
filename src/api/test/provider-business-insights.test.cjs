const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderBusinessInsightsService } = require('../dist/ai/provider/provider-business-insights.service.js');
const { ProviderBusinessInsightsController } = require('../dist/ai/provider/provider-business-insights.controller.js');
const { ProviderAssistantService } = require('../dist/ai/provider/provider.service.js');
const { ProviderConversationService } = require('../dist/ai/provider/provider-conversation.service.js');
const { parseInsightsBody, parseInsightsDays } = require('../dist/ai/provider/insights-period.dto.js');
const { AiController } = require('../dist/ai/ai.controller.js');

test('provider metrics aggregate an exact period and are scoped in every SQL query', async () => {
  const calls = [];
  const db = { $queryRaw: async (strings, ...values) => {
    const sql = strings.join('?');
    calls.push({ sql, values });
    if (sql.includes('previousBookingRequests')) return [{ bookingRequests: 6, pendingBookingRequests: 2, confirmedBookings: 3, completedBookings: 1, quoteRequests: 4, submittedQuotes: 3, acceptedQuotes: 1, rejectedQuotes: 1, expiredQuotes: 1, pendingQuoteRequests: 2, awaitingClientResponse: 2, expiringQuotes: 1, previousBookingRequests: 3, previousQuoteRequests: 2 }];
    if (sql.includes('WITH calendar')) return [{ day: '2026-11-21', bookingRequests: 2, confirmedRequests: 1, completedBookings: 0, quoteRequests: 1 }];
    if (sql.includes('ServiceListing')) return [{ serviceId: 'listing-a', service: 'Plumbing', quoteRequests: 3, bookingRequests: 4, completedBookings: 1 }];
    assert.fail('unexpected metrics query');
  } };
  const result = await new ProviderBusinessInsightsService(db).get('provider-a', 7, new Date('2026-11-27T12:00:00+02:00'));
  assert.deepEqual(result.period, { days: 7, from: '2026-11-21', to: '2026-11-28', timezone: 'Africa/Johannesburg' });
  assert.equal(result.overview.bookingRequests, 6);
  assert.equal(result.overview.quoteAcceptanceRate, 33.3);
  assert.equal(result.overview.quoteOutcomeCount, 3);
  assert.equal(result.comparison.bookingRequestChangePercent, 100);
  assert.equal(result.services[0].service, 'Plumbing');
  assert.equal(result.trends.length, 1);
  assert.ok(result.recommendations.some(item => item.key === 'pending-bookings'));
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.ok(call.values.includes('provider-a'));
    assert.match(call.sql, /providerId/);
  }
  assert.doesNotMatch(JSON.stringify(result), /clientId|email|phone|address|bankName|accountNumber/);
});

test('business insight period accepts only 7, 30, or 90 days and rejects client IDs', () => {
  assert.equal(parseInsightsDays('7'), 7);
  assert.equal(parseInsightsBody({ days: 90 }).days, 90);
  assert.throws(() => parseInsightsDays('14'), error => error.getStatus() === 400);
  assert.throws(() => parseInsightsBody({ days: 30, providerId: 'provider-b' }), error => error.getStatus() === 400);
});

test('provider business metrics endpoint uses only the authenticated provider identity', async () => {
  const calls = [];
  const controller = new ProviderBusinessInsightsController(
    { requireProfile: async (token, role) => { assert.equal(token, 'session-a'); assert.equal(role, 'provider'); return { id: 'provider-a' }; } },
    { get: async (...args) => { calls.push(args); return { overview: {} }; } },
  );
  await controller.get({ cookies: { session: 'session-a' } }, '90');
  assert.deepEqual(calls, [['provider-a', 90]]);
});

test('AI insights route is provider-only and validates its body before delegating', async () => {
  const calls = [];
  const endpoint = new AiController({ observations: async (...args) => { calls.push(args); return { answer: 'Activity increased.' }; } });
  const request = { aiPrincipal: { userId: 'provider-a', role: 'provider' }, get: name => name === 'origin' ? 'http://localhost:3000' : undefined };
  await endpoint.providerInsights(request, { days: 7 });
  assert.deepEqual(calls, [[request.aiPrincipal, 7]]);
  assert.throws(() => endpoint.providerInsights(request, { days: 30, userId: 'provider-b' }), error => error.getStatus() === 400);
  assert.deepEqual(Reflect.getMetadata('ai:roles', AiController.prototype.providerInsights), ['provider']);
});

test('AI business observations receive aggregate metrics only and keep recommendations advisory', async () => {
  const calls = []; const events = [];
  const metrics = { period: { days: 30 }, overview: { bookingRequests: 4, quoteRequests: 3, completedBookings: 1, submittedQuotes: 2, acceptedQuotes: 1, quoteOutcomeCount: 1 }, recommendations: [{ title: 'Review pending work' }] };
  const service = new ProviderAssistantService(
    { getProviderConfiguration: () => ({ provider: 'openai', apiKey: 'server-key', model: 'test-model' }), selectedProvider: () => 'openai' },
    { complete: async (...args) => { calls.push(args); return { text: 'Booking requests increased in the selected period. Consider reviewing availability.', tokenUsage: 12 }; } },
    {}, new ProviderConversationService(), { record: item => events.push(item) }, { get: async (providerId, days) => { assert.equal(providerId, 'provider-a'); assert.equal(days, 30); return metrics; } },
  );
  const result = await service.observations({ userId: 'provider-a', role: 'provider' }, 30);
  assert.equal(result.answer, 'Booking requests increased in the selected period. Consider reviewing availability.');
  assert.match(calls[0][1], /Verified backend metrics JSON/);
  assert.match(calls[0][1], /Service Connect Provider Business Insights assistant/);
  assert.match(calls[0][1], /Do not claim causation/);
  assert.match(calls[0][1], /Never change prices/);
  assert.match(JSON.stringify(calls[0][1]), /quoteAcceptanceRate|bookingRequests/);
  assert.equal(events[0].success, true);
  await assert.rejects(service.observations({ userId: 'client-a', role: 'client' }, 30), error => error.getStatus() === 403);
});

test('empty activity skips AI and reports insufficient history honestly', async () => {
  const service = new ProviderAssistantService(
    { getProviderConfiguration: () => assert.fail('empty activity should skip AI'), selectedProvider: () => 'openai' },
    { complete: async () => assert.fail('empty activity should skip AI') },
    {}, new ProviderConversationService(), { record: () => {} },
    { get: async () => ({ overview: { bookingRequests: 0, quoteRequests: 0, completedBookings: 0, submittedQuotes: 0, pendingBookingRequests: 0, pendingQuoteRequests: 0, confirmedBookings: 0 } }) },
  );
  const result = await service.observations({ userId: 'provider-a', role: 'provider' }, 90);
  assert.match(result.answer, /not enough recorded activity/i);
});
