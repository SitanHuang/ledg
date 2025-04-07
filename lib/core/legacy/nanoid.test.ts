import { describe, it, expect, beforeEach } from 'vitest';
import { nanoid } from "./nanoid.ts";

describe('nanoid()', () => {
  it('should generate unique IDs', () => {
    const set = new Set<String>();
    const N = 1000;
    for (let i = 0;i < N;i++) {
      const id = nanoid();
      expect(id).toMatch(/^\w{8}$/);
      set.add(id);
    }
    expect(set.size).toBe(N);
  });
});