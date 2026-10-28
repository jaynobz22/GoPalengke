import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNoticeHiddenForViewer, latestVisibleMessage } from './chatNotices';

const seller = 'seller-1';
const buyer = 'buyer-1';
const accepted = { sender_id: seller, message_type: 'system', body: 'Tinanggap na ng seller ang order mo! Inihahanda na ang iyong paninda.', created_at: '2' };
const delivered = { sender_id: seller, message_type: 'system', body: 'Naihatid na ang order mo! Salamat sa pag-order sa GoPalengke.', created_at: '3' };
const buyerText = { sender_id: buyer, message_type: 'text', body: 'Salamat po', created_at: '1' };

test('seller does not see the buyer-directed notices it triggered', () => {
  assert.equal(isNoticeHiddenForViewer(accepted, seller), true);
  assert.equal(isNoticeHiddenForViewer(delivered, seller), true);
});

test('buyer still sees the notices', () => {
  assert.equal(isNoticeHiddenForViewer(accepted, buyer), false);
  assert.equal(isNoticeHiddenForViewer(delivered, buyer), false);
});

test('normal typed messages are never hidden', () => {
  assert.equal(isNoticeHiddenForViewer({ sender_id: seller, message_type: 'text', body: 'Ready na po' }, seller), false);
});

test('seller chat list preview skips its own notices', () => {
  assert.equal(latestVisibleMessage([delivered, accepted, buyerText], seller)?.body, 'Salamat po');
  assert.equal(latestVisibleMessage([delivered, accepted], seller), null);
  assert.match(latestVisibleMessage([delivered, accepted, buyerText], buyer)?.body || '', /Naihatid/);
});
