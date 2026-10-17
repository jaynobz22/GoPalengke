import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCrop } from './imageCrop';

test('an untouched image keeps the entire image, regardless of shape', () => {
  for (const [width, height] of [[1200, 630], [600, 1000], [800, 800]]) {
    assert.deepEqual(makeCrop(width, height), { unit: '%', x: 0, y: 0, width: 100, height: 100 });
  }
});

test('choosing square cropping centers a square within a landscape image', () => {
  assert.deepEqual(makeCrop(1200, 600, 1), { unit: '%', x: 25, y: 0, width: 50, height: 100 });
});