import { describe, it, expect } from 'vitest';
import { specparse } from './specparse.ts';
import { hasResult } from '../../core/types.ts';

describe('SpecParse', () => {
  it('works', () => {
    const result = specparse(
      ` ;;groupSeparator=","; CNY: useGrouping=4, true=true, true=1, false=false; decimalSeparator="." , asdf=2;$:a=1,a=4; group=1; CNY:a="asdf";`
    );

    expect(result).toEqual([
      {
        groupName: undefined,
        modGroups: [{ mod: "groupSeparator", val: "," } ]
      },
      {
        groupName: "CNY",
        modGroups: [
          { mod: "useGrouping", val: 4 },
          { mod: "true", val: true },
          { mod: "true", val: 1 },
          { mod: "false", val: false },
        ]
      },
      {
        groupName: undefined,
        modGroups: [
          { mod: "decimalSeparator", val: "." },
          { mod: "asdf", val: 2 },
        ]
      },
      {
        groupName: "$",
        modGroups: [
          { mod: "a", val: 1 },
          { mod: "a", val: 4 },
        ]
      },
      {
        groupName: undefined,
        modGroups: [
          { mod: "group", val: 1 },
        ]
      },
      {
        groupName: "CNY",
        modGroups: [
          { mod: "a", val: "asdf" },
        ]
      },
    ]);
  });

  it('rejects newlines', () => {
    expect(specparse(`groupSeparator=",";`)).not.toBeInstanceOf(Error);
    expect((specparse(`groupSeparator=",";\n`) as Error).message).toMatch(/line/i);
    expect((specparse(`groupSeparator=",";\r`) as Error).message).toMatch(/line/i);
    expect((specparse(`groupSeparator=",";\r\n`) as Error).message).toMatch(/line/i);
  });

  it('works on whitespace only string', () => {
    expect(hasResult(specparse(``))).toBe(true);
    expect(hasResult(specparse(`   `))).toBe(true);
    expect(hasResult(specparse(` \t  `))).toBe(true);
    expect(hasResult(specparse(`\t`))).toBe(true);
  });

  it('disalllows redeclaration of group names inside same group', () => {
    expect(specparse(`CNY: useGrouping=4, decimalSeparator="."; CNY:a="asdf";`)).not.toBeInstanceOf(Error);
    expect((specparse(`CNY: useGrouping=4, CNY2: decimalSeparator="."; CNY:a="asdf";`) as Error).message).toMatch(/redeclare/i);
    expect((specparse(`CNY: useGrouping=4, CNY: decimalSeparator="."; CNY:a="asdf";`) as Error).message).toMatch(/redeclare/i);
  })
});