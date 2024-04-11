import { expect, test } from '@jest/globals';
import { reverse } from './string';

test('reverse', () => {
  expect(reverse('tacocat')).toEqual('tacocat');
});