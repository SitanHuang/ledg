import { Currency } from "./currency.ts";

export class CurrencyProvider {
  public defaultCurrencyCode = '$';

  private currencies = new Map<string, Currency>();

  public getOrCreateCurrencyById(code: string): Currency {
    if (!code)
      code = this.defaultCurrencyCode;

    const currency = this.currencies.get(code);
    if (currency !== undefined)
      return currency;

    const newCurrency = new Currency(code);
    this.currencies.set(code, newCurrency);

    return newCurrency;
  }
}