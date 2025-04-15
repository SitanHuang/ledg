import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionValidationService, TransactionValidationError } from './transactionValidationService.ts';
import { TransactionBuilder } from './transaction.ts';
import { PostingBuilder } from './posting.ts';
import { CurrencyConversionService } from '../valuation/currencyConversionService.ts';
import { CurrencyProvider } from '../valuation/currencyProvider.ts';
import { ValuationPolicy } from '../valuation/policy.ts';
import { ValuationConfiguration } from '../config/valuationConfigs.ts';
import { Amount } from './amount.ts';
import { Rational } from '../math/rational.ts';
import { Ok, isOk } from '../types.ts';
import { Currency } from '../valuation/currency.ts';
import { DefaultAccountManager } from './accountManager.ts';

describe('TransactionValidationService', () => {
  let conversionService: CurrencyConversionService;
  let currencyProvider: CurrencyProvider;
  let config: ValuationConfiguration;
  let valuationPolicy: ValuationPolicy;
  let validationService: TransactionValidationService;
  let accountManager: DefaultAccountManager;

  beforeEach(() => {
    conversionService = new CurrencyConversionService();
    currencyProvider = new CurrencyProvider();
    config = new ValuationConfiguration();
    // Use a zero tolerance by default to catch even the smallest errors.
    config.transactionBalanceTolerance = Rational.ZERO;
    // The valuation date is arbitrary for testing.
    valuationPolicy = new ValuationPolicy(1000);
    validationService = new TransactionValidationService(conversionService, valuationPolicy, config);
    accountManager = new DefaultAccountManager();
  });

  it('should validate a balanced transaction with two equal and opposite amounts in the same currency', () => {
    const txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx1");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    const pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(-100) }
    ]));
    pb2.withDate(1000);

    // Append postings to the transaction.
    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);

    const result = validationService.validate(txBuilder);
    expect(result).toBe(Ok);
    expect(isOk(result)).toBe(true);
  });

  it('should fail validation if a posting has an undefined amount', () => {
    const txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx2");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    const pb1 = new PostingBuilder(accountManager);
    // Omit amount assignment for pb1 to simulate an undefined posting amount.
    pb1.withDate(1000);

    const pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(-100) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    const result = validationService.validate(txBuilder);
    expect(result).toBeInstanceOf(TransactionValidationError);
    if (result instanceof TransactionValidationError) {
      expect(result.message).toContain("undefined amounts");
    }
  });

  it('should fail validation if transaction amounts sum to a non-zero value with zero tolerance', () => {
    const txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx3");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    const pb2 = new PostingBuilder(accountManager);
    // Imbalance: -90 instead of -100.
    pb2.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(-90) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    const result = validationService.validate(txBuilder);
    expect(result).toBeInstanceOf(TransactionValidationError);
    if (result instanceof TransactionValidationError) {
      expect(result.message).toContain("is not zero");
    }
  });

  it('should validate the transaction if the imbalance is within the tolerance', () => {
    // Set a small nonzero tolerance.
    config.transactionBalanceTolerance = Rational.parse("0.01"); // tolerance = 0.01
    let txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx4");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    let pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    let pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(-100.01) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    let result = validationService.validate(txBuilder);
    expect(result).toBe(Ok);
    expect(isOk(result)).toBe(true);

    config.transactionBalanceTolerance = Rational.parse("0.01"); // tolerance = 0.01
    txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx4");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([
      { currency: new Currency("USD"), value: Rational.fromNumber(-100.0101) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    result = validationService.validate(txBuilder);
    expect(isOk(result)).toBe(false);
    expect((result as Error).message).toContain("is not zero");
  });

  it('should validate a balanced transaction with different currencies using registered conversions', () => {
    const usd = new Currency("USD");
    const eur = new Currency("EUR");
    conversionService.registerCurrency(usd);
    conversionService.registerCurrency(eur);
    conversionService.registerConversion(usd, eur, Rational.fromNumber(7), 500);

    const txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx5");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: usd, value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    const pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([
      { currency: eur, value: Rational.fromNumber(-700) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    const result = validationService.validate(txBuilder);
    expect(result).toBe(Ok);
    expect(isOk(result)).toBe(true);
  });

  it('should fail validation for different currencies that do not balance after conversion', () => {
    // Register USD and EUR and define a conversion rate where 1 USD = 0.9 EUR.
    const usd = new Currency("USD");
    const eur = new Currency("EUR");
    conversionService.registerCurrency(usd);
    conversionService.registerCurrency(eur);
    conversionService.registerConversion(usd, eur, Rational.fromNumber(0.9), 500);

    const txBuilder = new TransactionBuilder(validationService);
    txBuilder.withId("tx6");
    txBuilder.withDate(1000);
    txBuilder.withDate2(1000);

    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([
      { currency: usd, value: Rational.fromNumber(100) }
    ]));
    pb1.withDate(1000);

    const pb2 = new PostingBuilder(accountManager);
    // Although the numbers match in magnitude, conversion makes 100 EUR not equivalent to 100 USD.
    pb2.withAmount(Amount.create([
      { currency: eur, value: Rational.fromNumber(-100) }
    ]));
    pb2.withDate(1000);

    txBuilder.appendPostingBuilder(pb1).appendPostingBuilder(pb2);
    const result = validationService.validate(txBuilder);
    expect(result).toBeInstanceOf(TransactionValidationError);
    if (result instanceof TransactionValidationError) {
      expect(result.message).toContain("is not zero");
    }
  });
});
