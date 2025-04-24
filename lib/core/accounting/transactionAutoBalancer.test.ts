/// core/accounting/transactionAutoBalancer.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { ValuationConfiguration } from '../config/valuationConfigs.ts';
import { CommitRegistry } from '../data/commitRegistry.ts';
import { nanoid } from '../legacy/nanoid.ts';
import { Rational } from '../math/rational.ts';
import { isNone } from '../types.ts';
import { Currency } from '../valuation/currency.ts';
import { CurrencyConversionService } from '../valuation/currencyConversionService.ts';
import { CurrencyProvider } from '../valuation/currencyProvider.ts';
import { Account } from './account.ts';
import { AccountAssignmentError, AccountManager, DefaultAccountManager } from './accountManager.ts';
import { Amount } from './amount.ts';
import { Posting, PostingBuilder } from './posting.ts';
import { TransactionAutoBalanceError, TransactionAutoBalancer } from './transactionAutoBalancer.ts';

class ShamAccountManager extends DefaultAccountManager {
  requestAccountAssignment(identifier: string, _objContext: any) {
    if (identifier === "fail") {
      return new AccountAssignmentError("Account assignment failed");
    }
    return new Account(identifier);
  }
}

describe('TransactionAutoBalancer', () => {
  let conversionService: CurrencyConversionService;
  let currencyProvider: CurrencyProvider;
  let config: ValuationConfiguration;
  let autoBalancer: TransactionAutoBalancer;
  let accountManager: AccountManager;

  beforeEach(() => {
    conversionService = new CurrencyConversionService();
    currencyProvider = new CurrencyProvider(new ValuationConfiguration());
    config = new ValuationConfiguration();
    // For tests that do not require conversion, we’ll override autoBalanceTargetCurrency.
    // For tests that need conversion, we will set it to a target currency string.
    accountManager = new DefaultAccountManager();
    autoBalancer = new TransactionAutoBalancer(conversionService, currencyProvider, config);
  });

  it('should do nothing when no posting has inferred amount', () => {
    // Both postings have defined amounts.
    const pb1 = new PostingBuilder(accountManager);
    // For simplicity we use USD for both
    pb1.withAmount(Amount.create([{ currency: new Currency("USD"), value: Rational.fromNumber(100) }]));
    pb1.date = 1000;

    const pb2 = new PostingBuilder(accountManager);
    pb2.withAmount(Amount.create([{ currency: new Currency("USD"), value: Rational.fromNumber(-100) }]));
    pb2.date = 1000;

    const postingBuilders = [pb1, pb2];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);
    // Expect no inferred posting was found, so result is None.
    expect(isNone(result)).toBe(true);
  });

  it('should error when more than one posting is inferred', () => {
    const pb1 = new PostingBuilder(accountManager);
    // Defined amount
    pb1.withAmount(Amount.create([{ currency: new Currency("USD"), value: Rational.fromNumber(100) }]));
    pb1.date = 1000;

    const pb2 = new PostingBuilder(accountManager);
    // Missing amount (inferred)
    pb2.date = 1000;

    const pb3 = new PostingBuilder(accountManager);
    // Also missing amount (inferred) → should trigger error.
    pb3.date = 1000;

    const postingBuilders = [pb1, pb2, pb3];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);
    expect(result).toBeInstanceOf(TransactionAutoBalanceError);
    if (result instanceof TransactionAutoBalanceError) {
      expect(result.message).toContain("Only one posting with inferred amount can exist in a transaction.");
    }
  });

  it('should auto-balance a single inferred posting without conversion', () => {
    // Set configuration to NOT use any currency conversion.
    config.autoBalanceTargetCurrency = false;

    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([{ currency: new Currency("USD"), value: Rational.fromNumber(100) }]));
    pb1.date = 1000;

    const pbInferred = new PostingBuilder(accountManager);
    // Inferred posting: do NOT set an amount.
    pbInferred.date = 1000; // Date is set, so conversion branch won't check it.

    const postingBuilders = [pb1, pbInferred];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);
    // Should return the posting builder for the inferred posting.
    expect(isNone(result)).toBe(false);
    // Type narrowing
    const postingBuilder = result as PostingBuilder;
    // The computed balance equals negative of the defined sum: -100 USD.
    const inferredAmount = postingBuilder.getAmount();
    expect(inferredAmount).not.toBeUndefined();
    // Check that the amount has an entry in USD.
    const entries = inferredAmount!.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    // Using toNumber() for comparison (allowing for potential rational representation nuances).
    expect(entries[0].value.toNumber()).toBeCloseTo(-100);

    // Also verify that the posting builder was marked as modified.
    const commitRegister = new CommitRegistry();
    postingBuilder.withTransactionID(nanoid(8)).withDate(0).withDate2(0).genId().withAccountIdentifier("asdf").attachAccountManager(new ShamAccountManager());
    expect(postingBuilder.build()).instanceOf(Posting);
    postingBuilder.commitChanges(commitRegister);
    expect(commitRegister.getCurrentCommits()![0].messages[0]).toContain("automatically inferred");
  });

  it('should auto-balance a single inferred posting with conversion', () => {
    // Set configuration to use conversion: target currency "USD".
    config.autoBalanceTargetCurrency = "USD";

    // Create a posting with an explicit amount in EUR.
    const pb1 = new PostingBuilder(accountManager);
    const eurCurrency = new Currency("EUR");
    pb1.withAmount(Amount.create([{ currency: eurCurrency, value: Rational.fromNumber(50) }]));
    pb1.date = 1000;

    // Create an inferred posting without amount.
    const pbInferred = new PostingBuilder(accountManager);
    pbInferred.date = 1000;

    // Register a conversion rate from EUR to USD.
    // Use a timestamp before the valuation date (e.g. 500).
    const usdCurrency = currencyProvider.getOrCreateCurrencyById("USD");
    conversionService.registerConversion(eurCurrency, usdCurrency, Rational.fromNumber(2), 500);
    // The reciprocal conversion is automatically registered by the service.

    const postingBuilders = [pb1, pbInferred];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);
    expect(isNone(result)).toBe(false);

    const postingBuilder = result as PostingBuilder;

    // The computed sum of defined amounts is 50 EUR, so the inferred amount is -50 EUR.
    const inferredAmount = postingBuilder.getAmount();
    expect(inferredAmount).not.toBeUndefined();
    const entries = inferredAmount!.getEntries();
    expect(entries.length).toBe(1);
    // The inferred amount retains the original currency ("EUR").
    expect(entries[0].currency.id).toBe("EUR");
    expect(entries[0].value.toNumber()).toBeCloseTo(-50);

    // Also verify that the posting builder was marked as modified.
    const commitRegister = new CommitRegistry();
    postingBuilder.withTransactionID(nanoid(8)).withDate(0).withDate2(0).genId().withAccountIdentifier("asdf").attachAccountManager(new ShamAccountManager());
    expect(postingBuilder.build()).instanceOf(Posting);
    postingBuilder.commitChanges(commitRegister);
    expect(commitRegister.getCurrentCommits()![0].messages[0]).toContain('converted to "USD"');
  });

  it('should error if conversion fails when autoBalanceTargetCurrency is set', () => {
    // Set configuration to use conversion: target currency "USD".
    config.autoBalanceTargetCurrency = "USD";

    // Create a posting with an explicit amount in EUR.
    const pb1 = new PostingBuilder(accountManager);
    const eurCurrency = new Currency("EUR");
    pb1.withAmount(Amount.create([{ currency: eurCurrency, value: Rational.fromNumber(75) }]));
    pb1.date = 1000;

    // Create an inferred posting without amount.
    const pbInferred = new PostingBuilder(accountManager);
    pbInferred.date = 1000;

    // Do NOT register any conversion rate from EUR to USD.
    const postingBuilders = [pb1, pbInferred];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);

    // Expect an error because the conversion should fail.
    expect(result).toBeInstanceOf(TransactionAutoBalanceError);
    if (result instanceof TransactionAutoBalanceError) {
      expect(result.message).toContain('Unable to convert inferred amount to the request currency "USD".');
    }
  });

  it('should error if inferred posting is missing a date when conversion is required', () => {
    // Set configuration to use conversion.
    config.autoBalanceTargetCurrency = "USD";

    // Create a posting with an explicit amount.
    const pb1 = new PostingBuilder(accountManager);
    pb1.withAmount(Amount.create([{ currency: new Currency("USD"), value: Rational.fromNumber(120) }]));
    pb1.date = 1000;

    // Create an inferred posting without a date.
    const pbInferred = new PostingBuilder(accountManager);
    // Notice: pbInferred.date is not set!

    const postingBuilders = [pb1, pbInferred];
    const result = autoBalancer.autoBalanceTransaction(postingBuilders);

    expect(result).toBeInstanceOf(TransactionAutoBalanceError);
    if (result instanceof TransactionAutoBalanceError) {
      expect(result.message).toContain("Attempting to auto balance a posting without date attribute.");
    }
  });
});
