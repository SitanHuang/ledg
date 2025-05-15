import { describe, it, expect } from 'vitest';
import { relabelLocalDateAsUtc } from './dateUtils.ts';

describe('relabelLocalDateAsUtc', () => {
  it('swaps only the timezone not the datetime', () => {
    expect(relabelLocalDateAsUtc(new Date('2024-02-28 12:02:30.129')))
      .toEqual(Date.parse('2024-02-28 12:02:30.129 UTC'));
  });
});