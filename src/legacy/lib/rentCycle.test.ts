import { describe, it, expect } from 'vitest';
import { nextRentDue } from './rentCycle';

describe('nextRentDue', () => {
  it('is 30 days after the rent payment', () => {
    const r = nextRentDue('2026-10-25T04:36:53Z', '2026-10-25T03:16:07Z', new Date('2026-10-25T05:00:00Z'))!;
    expect(r.due.toISOString()).toBe('2026-11-24T04:36:53.000Z');
    expect(r.daysLeft).toBe(30);
    expect(r.isDue).toBe(false);
  });
  it('becomes due on day 30', () => {
    expect(nextRentDue('2026-10-25T04:36:53Z', null, new Date('2026-11-24T05:00:00Z'))!.isDue).toBe(true);
  });
  it('falls back to last charge when never paid', () => {
    expect(nextRentDue(null, '2026-10-01T00:00:00Z', new Date('2026-10-02T00:00:00Z'))!.daysLeft).toBe(29);
  });
});
