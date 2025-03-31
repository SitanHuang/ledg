import { isSome, isNone, None, unwrap } from './types.ts';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Option type utilities', () => {
  it('should identify a regular value (Some) as Some', () => {
    const value = 42; // Option<number> as 42
    expect(isSome(value)).toBe(true);
    expect(isNone(value)).toBe(false);
  });

  it('should identify None correctly', () => {
    const value = None; // Option<number> as None
    expect(isSome(value)).toBe(false);
    expect(isNone(value)).toBe(true);
  });

  it('should work correctly with string values', () => {
    const value = "hello"; // Option<string> as "hello"
    expect(isSome(value)).toBe(true);
    expect(isNone(value)).toBe(false);
  });

  it('should treat any symbol different from None as Some', () => {
    const anotherSymbol = Symbol("another"); // Option<number> as some other Symbol
    expect(isSome(anotherSymbol)).toBe(true);
    expect(isNone(anotherSymbol)).toBe(false);
  });

  it('should handle edge case values like 0 and empty string', () => {
    const numValue = 0;
    const strValue = "";
    expect(isSome(numValue)).toBe(true);
    expect(isNone(numValue)).toBe(false);
    expect(isSome(strValue)).toBe(true);
    expect(isNone(strValue)).toBe(false);
  });

  describe('unwrap', () => {
    it('should return the inner value when given a valid Some value', () => {
      const someNumber = 42;
      expect(unwrap(someNumber)).toBe(42);

      const someString = "hello";
      expect(unwrap(someString)).toBe("hello");
    });

    it('should throw an error when given None', () => {
      expect(() => unwrap(None)).toThrow("Called unwrap on a None value");
    });
  });
});
