import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSellerPeso,
  sellerFreezeNotice,
  SELLER_FREEZE_NOTICE_TITLE,
} from './sellerFreezeNotice';

test('no notice when the seller has no fee row', () => {
  assert.equal(sellerFreezeNotice(null), null);
  assert.equal(sellerFreezeNotice(undefined), null);
});

test('no notice when the account is not frozen', () => {
  assert.equal(sellerFreezeNotice({ frozen_at: null, total_payable: 1500 }), null);
});

test('notice appears once frozen_at is set', () => {
  const notice = sellerFreezeNotice({ frozen_at: '2026-10-01T00:00:00Z', total_payable: 1234.5 });
  assert.notEqual(notice, null);
  assert.equal(notice!.title, SELLER_FREEZE_NOTICE_TITLE);
  assert.equal(notice!.amount, 1234.5);
});

test('notice tells the seller to pay before selling again', () => {
  const notice = sellerFreezeNotice({ frozen_at: '2026-10-01T00:00:00Z', total_payable: 1000 })!;
  assert.match(notice.title, /Pansamantalang na-freeze/);
  assert.match(notice.body, /hindi pa bayad/);
  assert.match(notice.body, /patuloy kang makapagtitinda/);
  assert.equal(notice.cta, 'Magbayad');
});

test('missing payable amount is treated as zero, never NaN', () => {
  assert.equal(sellerFreezeNotice({ frozen_at: '2026-10-01T00:00:00Z', total_payable: null })!.amount, 0);
  assert.equal(formatSellerPeso(0), '₱0.00');
  assert.equal(formatSellerPeso(1234.5), '₱1234.50');
});
