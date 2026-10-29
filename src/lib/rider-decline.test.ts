import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { releaseRiderAssignment } from './rider-decline.server';

type Row = { id: string; delivery_group_id: string | null; rider_id: string | null; rider_accepted_at: string | null; status: string; rider_lat: number | null; rider_lng: number | null };
const order = (id = 'o1', group: string | null = null): Row => ({ id, delivery_group_id: group, rider_id: 'r1', rider_accepted_at: null, status: 'ready_for_pickup', rider_lat: 7, rider_lng: 125 });

function fixture(rows: Row[], beforeWrite?: () => void, failWrite = false) {
  let writes = 0;
  const client = { from: () => {
    const filters: ((row: Row) => boolean)[] = [];
    let patch: Partial<Row> | null = null;
    let single = false;
    const q = {
      select: () => q,
      eq: (key: keyof Row, value: unknown) => { filters.push(row => row[key] === value); return q; },
      is: (key: keyof Row, value: unknown) => { filters.push(row => row[key] === value); return q; },
      in: (key: keyof Row, values: unknown[]) => { filters.push(row => values.includes(row[key])); return q; },
      update: (value: Partial<Row>) => { patch = value; return q; },
      maybeSingle: () => { single = true; return q; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        if (patch) { writes++; beforeWrite?.(); }
        const found = rows.filter(row => filters.every(filter => filter(row)));
        if (patch && !failWrite) found.forEach(row => Object.assign(row, patch));
        return Promise.resolve({ data: single ? found[0] ?? null : found.map(row => ({ ...row })), error: patch && failWrite ? { code: '42501' } : null }).then(resolve, reject);
      },
    };
    return q;
  } } as unknown as SupabaseClient;
  return { client, writes: () => writes };
}

test('decline clears assignment and GPS without cancelling or changing order status', async () => {
  const row = order(); const f = fixture([row]);
  assert.deepEqual(await releaseRiderAssignment(f.client, 'o1', 'r1'), { releasedIds: ['o1'] });
  assert.equal(row.rider_id, null); assert.equal(row.rider_lat, null); assert.equal(row.rider_lng, null);
  assert.equal(row.status, 'ready_for_pickup'); assert.equal(row.rider_accepted_at, null);
});
test('decline releases only the same rider in the persisted group', async () => {
  const rows = [order('o1', 'g1'), order('o2', 'g1'), order('o3', 'g2'), { ...order('o4', 'g1'), rider_id: 'r2' }];
  const f = fixture(rows);
  assert.deepEqual(await releaseRiderAssignment(f.client, 'o1', 'r1'), { releasedIds: ['o1', 'o2'] });
  assert.equal(rows[0]?.rider_id, null); assert.equal(rows[1]?.rider_id, null);
  assert.equal(rows[2]?.rider_id, 'r1'); assert.equal(rows[3]?.rider_id, 'r2');
});
test('another account cannot release the assigned rider', async () => {
  const row = order(); const f = fixture([row]);
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r2'));
  assert.equal(f.writes(), 0); assert.equal(row.rider_id, 'r1');
});
test('an accepted store blocks grouped decline before any write', async () => {
  const rows = [order('o1', 'g1'), { ...order('o2', 'g1'), rider_accepted_at: '2026-10-29T05:00:00Z' }];
  const f = fixture(rows);
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r1'));
  assert.equal(f.writes(), 0); assert.equal(rows[0]?.rider_id, 'r1');
});
test('acceptance during save is not overwritten or reported as successful', async () => {
  const row = order(); const f = fixture([row], () => { row.rider_accepted_at = '2026-10-29T05:00:00Z'; });
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r1'));
  assert.equal(row.rider_id, 'r1'); assert.equal(row.rider_accepted_at, '2026-10-29T05:00:00Z');
});
test('reassignment during save cannot release another rider', async () => {
  const row = order(); const f = fixture([row], () => { row.rider_id = 'r2'; });
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r1'));
  assert.equal(row.rider_id, 'r2');
});
test('database rejection cannot be reported as saved', async () => {
  const row = order(); const f = fixture([row], undefined, true);
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r1'));
  assert.equal(row.rider_id, 'r1');
});
test('delivered orders cannot be declined', async () => {
  const row = { ...order(), status: 'delivered' }; const f = fixture([row]);
  await assert.rejects(releaseRiderAssignment(f.client, 'o1', 'r1'));
  assert.equal(f.writes(), 0); assert.equal(row.status, 'delivered');
});