import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRentDue } from './rentCycle';

test('next rent is 30 days after the rent payment', () => {
  const r = nextRentDue('2026-10-25T04:36:53Z', '2026-10-25T03:16:07Z', new Date('2026-10-25T05:00:00Z'))!;
  assert.equal(r.due.toISOString(), '2026-11-24T04:36:53.000Z');
  assert.equal(r.daysLeft, 30);
  assert.equal(r.isDue, false);
});

test('rent becomes due on day 30', () => {
  assert.equal(nextRentDue('2026-10-25T04:36:53Z', null, new Date('2026-11-24T05:00:00Z'))!.isDue, true);
});

test('falls back to last charge when never paid', () => {
  assert.equal(nextRentDue(null, '2026-10-01T00:00:00Z', new Date('2026-10-02T00:00:00Z'))!.daysLeft, 29);
});
