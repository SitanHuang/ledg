import { ValuationConfiguration } from "../config/valuationConfigs.ts";
import { Currency } from "./currency.ts";

export class CurrencyProvider {
  constructor(
    public valuationConfig: ValuationConfiguration
  ) {}

  private currencies = new Map<string, Currency>();

  public getOrCreateCurrencyById(code: string): Currency {
    if (!code)
      code = this.valuationConfig.defaultCurrencyCode;

    const currency = this.currencies.get(code);
    if (currency !== undefined)
      return currency;

    const newCurrency = new Currency(code);
    this.currencies.set(code, newCurrency);

    return newCurrency;
  }
}