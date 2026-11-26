const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/upcomingAppointments.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module('upcomingAppointments'); mod._compile(js, 'upcomingAppointments.js');
const { upcomingAppointments } = mod.exports;
const booking = (id, start, end, status = 'Confirmed') => ({ id, startsAt: start, endsAt: end, status });
test('prioritizes all appointments on the nearest day in South African time, keeping all upcoming', () => {
  const now = Date.parse('2026-11-26T20:30:00Z');
  const items = [booking('later', '2026-11-29T10:00:00Z', '2026-11-29T11:00:00Z'), booking('first', '2026-11-27T07:00:00Z', '2026-11-27T08:00:00Z'), booking('second', '2026-11-27T09:00:00Z', '2026-11-27T10:00:00Z'), booking('cancelled', '2026-11-27T05:00:00Z', '2026-11-27T06:00:00Z', 'Cancelled')];
  const result = upcomingAppointments(items, now);
  assert.equal(result.label, 'Tomorrow');
  assert.deepEqual(result.priority.map(item => item.id), ['first', 'second']);
  assert.deepEqual(result.upcoming.map(item => item.id), ['first', 'second', 'later']);
});
test('keeps an appointment in progress on today and excludes finished appointments', () => {
  const now = Date.parse('2026-11-26T22:30:00Z'); // 00:30 on the 27th in South Africa
  const items = [booking('ongoing', '2026-11-26T22:00:00Z', '2026-11-26T23:00:00Z'), booking('ended', '2026-11-26T20:00:00Z', '2026-11-26T21:00:00Z')];
  const result = upcomingAppointments(items, now);
  assert.equal(result.label, 'Today');
  assert.deepEqual(result.upcoming.map(item => item.id), ['ongoing']);
});
test('shows no priority when there are no upcoming bookings', () => {
  const result = upcomingAppointments([], Date.now());
  assert.deepEqual(result.priority, []); assert.equal(result.label, '');
});
