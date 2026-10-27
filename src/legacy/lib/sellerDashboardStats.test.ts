import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellerDashboardStats } from './sellerDashboardStats';

test('Kita sums every non-cancelled order, not just the newest few', () => {
  const orders = [
    { total: 100.5, status: 'delivered' },
    { total: 200, status: 'pending' },
    { total: 50, status: 'cancelled' },
    { total: 49.5, status: 'picked_up' },
  ];
  assert.equal(sellerDashboardStats(orders).revenue, 350);
});

test('Pending counts only orders still waiting for the seller', () => {
  const orders = [
    { total: 100, status: 'pending' },
    { total: 100, status: 'pending' },
    { total: 100, status: 'accepted' },
    { total: 100, status: 'cancelled' },
  ];
  assert.equal(sellerDashboardStats(orders).pending, 2);
});

test('Missing or broken totals do not poison the Kita figure', () => {
  const orders = [
    { total: null, status: 'delivered' },
    { total: 'abc', status: 'delivered' },
    { total: '75.25', status: 'delivered' },
  ];
  assert.equal(sellerDashboardStats(orders).revenue, 75.25);
});

test('No orders means zero Kita and zero pending', () => {
  assert.deepEqual(sellerDashboardStats(null), { pending: 0, revenue: 0 });
  assert.deepEqual(sellerDashboardStats([]), { pending: 0, revenue: 0 });
});
