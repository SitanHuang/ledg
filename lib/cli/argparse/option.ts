import { parseSmartDate } from '../../core/utils/dateUtils.ts';
import { hasResult, Result, timestamp } from '../../core/types.ts';
import { ArgParseError } from './argparse.ts';

export type OptionType = 'string' | 'int' | 'decimal' | 'boolean' | 'datetime';
export type OptionValue = string | number | boolean | timestamp;

// Maps an OptionType to its corresponding runtime value type
export interface OptionTypeMap {
  string: string;
  int: number;
  decimal: number;
  boolean: boolean;
  datetime: timestamp;
}

/**
 * Configuration object used to create an {@link Option} instance.
 * @template T The compile‑time {@link OptionType} for this option.
 */
export interface OptionMetadata<T extends OptionType = OptionType> {
  /** Canonical long name without leading dashes (e.g. "file") */
  name: string;
  /** Optional short alias without dash (e.g. "f") */
  alias?: string;
  /** Expected data type at runtime. Determines the return type of {@link Option.parse}. */
  type: T;
  /** Description shown in generated help output. */
  description?: string;
  /** Default value if the option is omitted on the command line. */
  defaultValue?: OptionTypeMap[T];
  /** Indicates the option must be explicitly provided. */
  required?: boolean;
  /** Allow repeated appearances instead of overriding; the consumer decides how to aggregate. */
  multiple?: boolean;
}

/**
 * Typed representation of a single command‑line option. Handles validation and
 * conversion from a raw string (as received from argv) to a type‑safe value.
 *
 * @example
 * ```ts
 * const portOpt = new Option({
 *   name: 'port',
 *   alias: 'p',
 *   type: 'int',
 *   defaultValue: 8080,
 * });
 * const port = portOpt.parse('3000'); // port is number (3000)
 * ```
 */
export class Option<T extends OptionType = OptionType> {
  name: string;
  alias?: string;
  type: T;
  description?: string;
  required: boolean;
  multiple: boolean;
  defaultValue?: OptionTypeMap[T];

  constructor(config: OptionMetadata<T>) {
    this.name = config.name;
    this.alias = config.alias;
    this.type = config.type;
    this.description = config.description;
    this.required = config.required ?? false;
    this.multiple = config.multiple ?? false;
    this.defaultValue = config.defaultValue;
  }

  extractValue(option: Option, value: OptionValue, callback?: (val: OptionTypeMap[T]) => void): OptionTypeMap[T] | undefined {
    if (option === this) {
      if (callback) {
        callback(value as OptionTypeMap[T]);
      }
      return value as OptionTypeMap[T];
    }
    return;
  }

  /**
   * Converts a raw argument (or undefined if absent) into a typed value.
   * @param raw Raw string following the option in argv, or undefined if none.
   * @throws If parsing fails or a required option is missing.
   */
  parse(raw?: string): Result<OptionTypeMap[T], ArgParseError> {
    // Handle missing value
    if (raw === undefined) {
      if (this.defaultValue !== undefined) {
        return this.defaultValue;
      } else if (this.required) {
        return new ArgParseError(`Option "--${this.name}" is required.`);
      }
      return new ArgParseError(`Option "--${this.name}" expects a value.`);
    }

    switch (this.type) {
      case 'string':
        return raw as OptionTypeMap[T];

      case 'int': {
        const intVal = Number(raw);
        if (!Number.isInteger(intVal)) {
          return new ArgParseError(`Option "--${this.name}" expects an integer but got "${raw}".`);
        }
        return intVal as OptionTypeMap[T];
      }

      case 'decimal': {
        const numVal = Number(raw);
        if (Number.isNaN(numVal)) {
          return new ArgParseError(`Option "--${this.name}" expects a number but got "${raw}".`);
        }
        return numVal as OptionTypeMap[T];
      }

      case 'boolean': {
        const normalized = raw.toLowerCase();
        if ([
          'true', '1', 'yes', 'on',
        ].includes(normalized)) {
          return true as OptionTypeMap[T];
        }
        if ([
          'false', '0', 'no', 'off',
        ].includes(normalized)) {
          return false as OptionTypeMap[T];
        }
        return new ArgParseError(`Option "--${this.name}" expects a boolean but got "${raw}".`);
      }

      case 'datetime': {
        const result = parseSmartDate(raw);

        if (!hasResult(result)) {
          const error = new ArgParseError(`Option "--${this.name}" expects a valid smart date.`);
          error.cause = result;
          return error;
        }

        return result as OptionTypeMap[T];
      }

      default: {
        // Exhaustiveness check ensures new types are handled.
        const _exhaustive: never = this.type;
        return new ArgParseError(`Unhandled option type: ${_exhaustive}`);
      }
    }
  }
}
