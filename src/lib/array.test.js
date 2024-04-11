import { expect, test } from '@jest/globals';
import { square } from './array';

test('reverse', () => {
  expect(square([2, 3, 4])).toEqual([4, 9, 16]);
});