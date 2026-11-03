import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { broadcastRecipients, broadcastHtml } from './roleBroadcast';

const rows = [
  { email: 'a@x.com', role: 'rider', full_name: 'A' },
  { email: 'b@x.com', role: 'seller', full_name: 'B' },
  { email: 'c@x.com', role: 'buyer', full_name: 'C' },
  { email: '639@phone.gopalengke.net', role: 'rider' },
  { email: 'A@X.com', role: 'rider' },
];

describe('role broadcast recipients', () => {
  test('riders only receive rider emails', () => {
    assert.deepEqual(broadcastRecipients(rows, 'rider').map(r => r.email), ['a@x.com']);
  });
  test('sellers only receive seller emails', () => {
    assert.deepEqual(broadcastRecipients(rows, 'seller').map(r => r.email), ['b@x.com']);
  });
  test('buyers only receive buyer emails', () => {
    assert.deepEqual(broadcastRecipients(rows, 'buyer').map(r => r.email), ['c@x.com']);
  });
  test('message HTML is escaped', () => {
    assert.ok(!broadcastHtml('x', '<script>').includes('<script>'));
  });
});
