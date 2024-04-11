import { expect, test } from '@jest/globals';
import { divide } from './calculator';

test('calculator', () => {
  expect(divide(4, 2)).toEqual(2);
});