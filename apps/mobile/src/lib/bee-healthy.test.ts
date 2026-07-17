// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { expect, test } from 'bun:test';

import {
  dateFromLocalKey,
  localDateKey,
  shiftLocalDateKey,
} from './bee-healthy';

test('local date keys preserve the device calendar day', () => {
  expect(localDateKey(new Date(2026, 6, 17, 12))).toBe('2026-07-17');
  expect(localDateKey(dateFromLocalKey('2026-07-17'))).toBe('2026-07-17');
});

test('local date shifts cross calendar boundaries without UTC parsing', () => {
  expect(shiftLocalDateKey('2026-12-31', 1)).toBe('2027-01-01');
  expect(shiftLocalDateKey('2028-02-28', 1)).toBe('2028-02-29');
});

test('invalid local calendar keys are rejected', () => {
  expect(() => dateFromLocalKey('2026-02-29')).toThrow(RangeError);
  expect(() => dateFromLocalKey('2026-7-17')).toThrow(RangeError);
});
