import { describe, expect, test } from 'bun:test';
import { isNoticeHiddenForViewer, latestVisibleMessage } from './chatNotices';

const seller = 'seller-1';
const buyer = 'buyer-1';
const accepted = { sender_id: seller, message_type: 'system', body: 'Tinanggap na ng seller ang order mo! Inihahanda na ang iyong paninda.', created_at: '2' };
const delivered = { sender_id: seller, message_type: 'system', body: 'Naihatid na ang order mo! Salamat sa pag-order sa GoPalengke.', created_at: '3' };
const buyerText = { sender_id: buyer, message_type: 'text', body: 'Salamat po', created_at: '1' };

describe('chat order notices', () => {
  test('seller does not see the buyer-directed notices it triggered', () => {
    expect(isNoticeHiddenForViewer(accepted, seller)).toBe(true);
    expect(isNoticeHiddenForViewer(delivered, seller)).toBe(true);
  });

  test('buyer still sees the notices', () => {
    expect(isNoticeHiddenForViewer(accepted, buyer)).toBe(false);
    expect(isNoticeHiddenForViewer(delivered, buyer)).toBe(false);
  });

  test('normal typed messages are never hidden', () => {
    expect(isNoticeHiddenForViewer({ sender_id: seller, message_type: 'text', body: 'Ready na po' }, seller)).toBe(false);
  });

  test('seller chat list preview skips its own notices', () => {
    expect(latestVisibleMessage([delivered, accepted, buyerText], seller)?.body).toBe('Salamat po');
    expect(latestVisibleMessage([delivered, accepted], seller)).toBeNull();
    expect(latestVisibleMessage([delivered, accepted, buyerText], buyer)?.body).toContain('Naihatid');
  });
});
