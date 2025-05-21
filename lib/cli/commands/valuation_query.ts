import { hasResult, isOk, Maybe, Ok, parseSmartDate, toUTCDatetimeString, ValuationFunction, ValuationPolicy, ValuationStrategy } from "../../core/namespace.ts";
import { QueryCommand } from "./query.ts";

import { ArgParseError } from "../argparse/argparse.ts";
import { Option, OptionValue } from "../argparse/option.ts";
import { LedgCLIContext } from "../context.ts";
import { DEBUG } from "../entry.ts";

export abstract class ValuationQueryCommand extends QueryCommand {
  protected readonly currencyOption = new Option({
    name: "currency",
    alias: "c",
    type: "string",
    description: "Valuation currency (e.g., USD, EUR).",
  });

  protected currencyOptionVal?: string;

  protected readonly valuationStrategyOption = new Option({
    name: "valuation-strategy",
    alias: "vs",
    type: "string",
    description: "Valuation strategy: txnDate | <datetime>.",
    defaultValueDisplay: "txnDate",
  });

  protected valuationStrategyOptionVal: Exclude<ValuationStrategy, "eop"> = "txnDate";

  protected getValuationFunction(context: LedgCLIContext): ValuationFunction {
    const { currencyProvider, currencyConversionService } = context.journal;

    if (!this.currencyOptionVal || !this.valuationStrategyOptionVal) {
      return (_, x) => x;
    }

    const currency = currencyProvider.getOrCreateCurrencyById(this.currencyOptionVal);
    const policy = new ValuationPolicy(0);

    if (this.valuationStrategyOptionVal == "txnDate") {
      return (p, x) => {
        policy.valuationDate = p.date;
        return x.convertToAmount(currency, currencyConversionService, policy);
      };
    }

    policy.valuationDate = this.valuationStrategyOptionVal;

    return (_, x) => x.convertToAmount(currency, currencyConversionService, policy);
  }

  override build(): void {
    super.build();

    this.setOption(this.currencyOption);
    this.setOption(this.valuationStrategyOption);
  }

  protected consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const result = super.consumeOption(option, value);
    if (!isOk(result)) return result;

    this.currencyOption.extractValue(option, value, (cur: string) => {
      this.currencyOptionVal = cur.trim() || undefined;
    });

    let error: Error | undefined;
    this.valuationStrategyOption.extractValue(option, value, (strat: string) => {
      if (strat === "txnDate") {
        this.valuationStrategyOptionVal = strat;
      } else {
        const result = parseSmartDate(strat);

        if (!hasResult(result)) {
          error = new ArgParseError(`Option "--${option.name}" expects a valid smart date, or "txnDate".`);
          error.cause = result;
          return;
        }

        if (DEBUG) {
          console.debug("Valuate at:", toUTCDatetimeString(result));
        }

        this.valuationStrategyOptionVal = result;
      }
    });

    return error ?? Ok;
  }

}