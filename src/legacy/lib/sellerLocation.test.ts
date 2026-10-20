import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellerMarketOptions, storedSellerLocationType, SELLER_LOCATION_TYPES } from './sellerLocation';

test('talipapa is supported and restored when editing a store', () => {
  assert.ok(SELLER_LOCATION_TYPES.includes('talipapa'));
  assert.equal(storedSellerLocationType('talipapa', null), 'talipapa');
});
test('market options place nearest GPS market first, including across city borders', () => {
  const options = sellerMarketOptions('City of Manila', '1300000000', { lat: 14.6300, lng: 121.0960 });
  assert.equal(options[0]?.name, 'Marikina Public Market');
  assert.equal(options[0]?.distanceKm, 0);
  assert.ok(!options.some(m => m.name === 'Bankerohan Public Market'));
});
test('without GPS markets use the selected city, including PSGC aliases', () => {
  const options = sellerMarketOptions('City of Davao', '1100000000');
  assert.ok(options.some(m => m.name === 'Bankerohan Public Market'));
  assert.ok(options.some(m => m.name === 'Mintal Public Market'));
  assert.ok(!options.some(m => m.name === 'Marikina Public Market'));
});
test('unknown locations safely allow an empty suggestion list', () => {
  assert.deepEqual(sellerMarketOptions('', ''), []);
});