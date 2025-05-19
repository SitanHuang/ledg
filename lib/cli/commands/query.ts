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
    description: "Exclude virtual txns/postings."
  });
  protected readonly clearedOption = new Option({
    name: "cleared",
    type: "boolean",
    description: "Exclude pending txns/postings."
  });
  protected readonly pendingOption = new Option({
    name: "pending",
    type: "boolean",
    description: "Exclude non-pending txns/postings."
  });

  protected readonly accountOption = new Option({
    name: "account",
    alias: "a",
    type: "string",
    description: "Account glob pattern.",
    longDescription: [
      'AccountGlob performs Unix-style globbing of account names.',
      '  ex: ..cash =~ Account.Current.Cash',
      '      .cash =~ Account.Cash',
      '      exp$ =~ Expense',
      '      exp|inc.sl =~ Expense | Income.Salary',
      '      exp. =~ Expense.*',
      '      exp. =~ Expense.*',
      '',
      '  anything in between dots matches any segments of account names that',
      '  contains the letters in that order',
      '    ex: .csh. matches *\\.[^.]*?c[^.]*?s[^.]*?h[^.]*?\\.* in regex',
      '',
      '  * matches across "." boundaries (zero or more segments)',
      '  . matches "." literally',
      '  {a,b,c} alternation of literal text, no nesting',
      '  \\ scapes the next character when you need it literal',
      '      ex:  acc\\*.cash   =~  Account*.Cash',
      '',
      '         regex literal mode',
      '           adding "\\v" to the beginning of an account filter switches',
      '           the whole pattern to regular‑expression matching exactly as typed',
      '',
      '           example to exclude all equity accounts:',
      '             \\v^(?!Equity)',
      '',
      '         string literal mode',
      '           adding "!" to the beginning of an account filter switches',
      '           the whole pattern to string matching exactly as typed',
      '',
      '           example to match "Equity" as-is',
      '             !Equity',
    ].join("\n")
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
    this.setOption(this.clearedOption);
    this.setOption(this.pendingOption);
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
    this.clearedOption.extractValue(option, value, (val: boolean) => {
      this.queryPolicy.withClearedOnly(val);
    });
    this.pendingOption.extractValue(option, value, (val: boolean) => {
      this.queryPolicy.withPendingOnly(val);
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