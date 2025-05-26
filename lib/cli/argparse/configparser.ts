import { readFileSync } from "fs";
import { SourceableError } from "../../core/errors.ts";
import { hasResult, Maybe, Ok, Result } from "../../core/types.ts";

type ConfigGroupKey = string | symbol;
type ConfigGroup = Map<string, string>;

export class ConfigParser {
  static readonly DEFAULT_GROUP_KEY: unique symbol = Symbol("DEFAULT");

  private readonly configGroups = new Map<ConfigGroupKey, ConfigGroup>();

  load(path: string): Maybe<SourceableError> {
    return this.readLines(
      readFileSync(path, 'utf-8')
      .split(/\r\n|\n|\r/)
      .filter(Boolean)
    );
  }

  getConfigGroup(key: ConfigGroupKey) {
    const defaults = new Map(this.configGroups.get(ConfigParser.DEFAULT_GROUP_KEY) ?? new Map());

    const result = this.getOrCreateGroupMap(key);

    return new Map([...defaults, ...result]);
  }

  private getOrCreateGroupMap(key: ConfigGroupKey) {
    let result = this.configGroups.get(key);
    if (!result) {
      this.configGroups.set(key, result = new Map());
    }
    return result;
  }

  walkEntries(key: ConfigGroupKey): [string, string][] {
    const defaultIterator = this.getConfigGroup(ConfigParser.DEFAULT_GROUP_KEY).entries();

    if (key !== ConfigParser.DEFAULT_GROUP_KEY) {
      const group = this.configGroups.get(key);

      if (group) {
        return [...defaultIterator, ...group.entries()];
      }
    }

    return [...defaultIterator];
  }

  private readLines(lines: string[]): Maybe<SourceableError> {
    let currentGroupKey: ConfigGroupKey = ConfigParser.DEFAULT_GROUP_KEY;
    let currentGroup = this.getOrCreateGroupMap(currentGroupKey);

    for (let i = 0;i < lines.length;i++) {
      const line = lines[i].replace(/(?:#|\/\/|;)[^"']*$/g, '').trim();

      if (!line) {
        continue;
      }

      const groupMatch = /^\[([^[\]]+)\]$/.exec(line);
      if (groupMatch?.[1]) {
        currentGroupKey = groupMatch[1];
        currentGroup = this.getOrCreateGroupMap(currentGroupKey);
        continue;
      }

      const matches = /^([^=]+)=(.*)$/.exec(line);

      if (!matches?.[2]) {
        return new SourceableError("Invalid configuration syntax.", lines.join("\n"), i);
      }

      const val = this.parseValue(matches[2].trim());

      if (!hasResult(val)) {
        const error = new SourceableError("Invalid value syntax. Use either raw string OR JSON string.", lines.join("\n"), i);
        error.cause = val;
        return error;
      }

      currentGroup.set(matches[1].trim(), val);
    }

    return Ok;
  }

  private parseValue(raw: string): Result<string> {
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        return e as Error;
      }
    }
    return raw;
  }
}