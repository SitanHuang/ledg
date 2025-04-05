import { Currency } from "./currency.ts";

export class CurrencyProvider {
  public defaultCurrencyCode = '$';

  private currencies: Map<string, Currency> = new Map();

  public getOrCreateCurrencyById(code: string): Currency {
    if (!code)
      code = this.defaultCurrencyCode;

    if (this.currencies.has(code))
      return this.currencies.get(code) as Currency;

    const newCurrency = new Currency(code);
    this.currencies.set(code, newCurrency);

    return newCurrency;
  }
}