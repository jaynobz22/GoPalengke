import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stockLevel, daysLeft } from './inventoryStatus';

test('zero stock is out', () => assert.equal(stockLevel(0, 10), 'out'));
test('5 or fewer is low', () => assert.equal(stockLevel(5), 'low'));
test('fast seller with 3 days left is low', () => assert.equal(stockLevel(30, 300), 'low'));
test('slow seller with plenty is ok', () => assert.equal(stockLevel(30, 30), 'ok'));
test('days left from 30-day sales', () => assert.equal(daysLeft(20, 60), 10));
