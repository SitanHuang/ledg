import { SourceableError } from "../../core/errors.ts";
import { Result } from "../../core/types.ts";

/**
 * Parse a *spec argument string* (e.g. `"size:width=100,height=200;theme=dark"`)
 * into a structured array of {@link SpecGroup} objects.
 *
 * The grammar supports:
 *   • **Groups** separated by semicolons `;` – each optional group may start with
 *     a `groupName:` prefix.
 *   • **Mod assignments** inside every group – `<mod>=<value>` pairs separated
 *     by commas `,`.
 *     – `<value>` may be a number, a JSON-like boolean (`true|false`),
 *       or a quoted string (`"hello world"` or `'hello world'`).
 *
 * Hard errors are raised for:
 *   • Back-slashes `\\` (escaping is *not* supported).
 *   • New-line characters.
 *   • Unknown tokens or duplicate group names.
 *
 * @example
 * ```ts
 * const spec = `chart:type="bar",stacked=true; axes:left=true`;
 * const groups = specparse(spec);
 * // [
 * //   { groupName: "chart", modGroups: [ { mod: "type", val: "bar" }, { mod: "stacked", val: true } ] },
 * //   { groupName: "axes",  modGroups: [ { mod: "left", val: true } ] }
 * // ]
 * ```
 */
export function specparse(input: string): Result<SpecGroups, SpecParseError> {
  if (input.includes('\\')) {
    return new SpecParseError("Escaping is not supported in spec arguments.", input, 0, input.indexOf('\\'));
  }
  if (input.includes('\n') || input.includes('\r')) {
    return new SpecParseError("New lines cannot be in spec arguments.", input, 0, Math.max(input.indexOf('\n'), input.indexOf('\r')));
  }

  const groups: SpecGroups = [];
  const regex = GROUP_REGEX;

  regex.lastIndex = 0;

  let currentGroup: SpecGroup = { groupName: undefined, modGroups: [] };

  // Save the index before exec sets it to 0 for failed matches
  let lastValidIndex = regex.lastIndex;

  while (lastValidIndex < input.length) {
    regex.lastIndex = lastValidIndex;

    const next = regex.exec(input);
    const matched = next?.groups;

    // No match
    if (!matched?.mod || !matched.val) {
      if (WHITESPACE_REGEX.test(input[lastValidIndex])) {
        lastValidIndex++;
        continue;
      }

      if (input[lastValidIndex] === ';') {

        // Commit group
        commitGroup(); // consume ";"

        lastValidIndex++;
        continue;

      } else {
        return new SpecParseError("Invalid spec argument.", input, 0, lastValidIndex);
      }
    }

    lastValidIndex = regex.lastIndex;

    if (matched.groupName) {
      if (currentGroup.groupName === undefined) {
        currentGroup.groupName = matched.groupName;
      } else {
        return new SpecParseError("Cannot redeclare group name inside the same group.", input, 0, lastValidIndex);
      }
    }

    currentGroup.modGroups.push({
      mod: matched.mod,
      val: matched.val === "true" ? true : matched.val === "false" ? false : (
        matched.val.startsWith('"') ? matched.val.substring(1, matched.val.length - 1) : (
          Number(matched.val)
        )
      )
    });
  }

  commitGroup();

  return groups.filter(x => x.groupName !== undefined || x.modGroups.length);

  function commitGroup() {
    groups.push(currentGroup);
    currentGroup = { groupName: undefined, modGroups: [] };
  }
}

export class SpecParseError extends SourceableError {
  protected readonly __specParseErrorBrand = undefined;
}

export type ModValue = string | number | boolean;

export type ModGroup = { mod: string, val: ModValue }[];

export interface SpecGroup {
  groupName?: string;
  modGroups: ModGroup;
}

export type SpecGroups = SpecGroup[];

const GROUP_REGEX = /\s*(?:(?<groupName>[^\s:=;"]+)\s*:\s*)?(?<mod>[a-z_]+)\s*=\s*(?<val>\d+|['"][^'"]*['"]|true|false)\s*,?\s*/yigd;
const WHITESPACE_REGEX = /\s/;