import { QueryPolicy } from "../../core/reports/query/queryPolicy.ts";
import { Maybe, timestamp } from "../../core/types.ts";
import { LedgCommand } from "./ledg.ts";
import { ArgParseError } from "../argparse/argparse.ts";
import { Option, OptionValue } from "../argparse/option.ts";

export abstract class QueryCommand extends LedgCommand {

  protected readonly fromOption = new Option({
    name: "from",
    alias: "f",
    type: "datetime",
    description: "Inclusive start smart datetime."
  });

  protected readonly toOption = new Option({
    name: "to",
    alias: "t",
    type: "datetime",
    description: "Exclusive end smart datetime."
  });

  protected readonly useDateOption = new Option({
    name: "date",
    type: "boolean",
    description: "Use primary date."
  });
  protected readonly useDate2Option = new Option({
    name: "date2",
    type: "boolean",
    description: "Use auxiliary date."
  });

  protected readonly realOption = new Option({
    name: "real",
    type: "boolean",
    description: "Exclude virtual accounts."
  });

  protected readonly accountOption = new Option({
    name: "account",
    alias: "a",
    type: "string",
    description: "Account glob pattern"
  });

  protected readonly modifierOption = new Option({
    name: "modifier",
    alias: "m",
    type: "string",
    description: "modifierName:regex | modifierName:false"
  });

  protected queryPolicy = new QueryPolicy();

  override build(): void {
    super.build();

    this.queryPolicy = new QueryPolicy();

    this.setOption(this.fromOption);
    this.setOption(this.toOption);
    this.setOption(this.useDateOption);
    this.setOption(this.useDate2Option);
    this.setOption(this.realOption);
    this.setOption(this.accountOption);
    this.setOption(this.modifierOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    let error: ArgParseError | undefined;

    this.fromOption.extractValue(option, value, (from: timestamp) => {
      this.queryPolicy.withFrom(from);
    });
    this.toOption.extractValue(option, value, (to: timestamp) => {
      this.queryPolicy.withTo(to);
    });
    this.useDateOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) {
        error = new ArgParseError(`Option "--${this.useDateOption.name}" can only be of true value. Use "--${this.useDate2Option.name}" to negate.`)
      }
      this.queryPolicy.withUseDate("date");
    });
    this.useDate2Option.extractValue(option, value, (opt: boolean) => {
      if (!opt) {
        error = new ArgParseError(`Option "--${this.useDate2Option.name}" can only be of true value. Use "--${this.useDateOption.name}" to negate.`)
      }
      this.queryPolicy.withUseDate("date2");
    });
    this.accountOption.extractValue(option, value, (pattern: string) => {
      this.queryPolicy.withAccount(pattern);
    });
    this.realOption.extractValue(option, value, (val: boolean) => {
      this.queryPolicy.withRealOnly(val);
    });

    this.modifierOption.extractValue(option, value, (pattern: string) => {
      const colonIdx = pattern.indexOf(':');
      const modError = new ArgParseError(`Option "--${ this.useDate2Option.name }" requires "modifierName:regex | modifierName:false" syntax.`);

      if (colonIdx < 1) {
        error = modError;
        return;
      }

      const name = pattern.substring(0, colonIdx);
      const value = pattern.substring(colonIdx + 1);

      if (value === 'false') {
        this.queryPolicy.withModifier(name, false);
      } else {
        this.queryPolicy.withModifier(name, new RegExp(value, "i"));
      }
    });

    return error ?? super.consumeOption(option, value);
  }

  protected getQueryPolicy(): QueryPolicy {
    return this.queryPolicy;
  }
}