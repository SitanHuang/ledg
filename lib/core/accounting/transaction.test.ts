import { beforeEach, describe, expect, it } from 'vitest';
import { ValuationConfiguration } from '../config/valuationConfigs.ts';
import { Rational } from '../math/rational.ts';
import { isOk } from '../types.ts';
import { Currency } from '../valuation/currency.ts';
import { CurrencyConversionService } from '../valuation/currencyConversionService.ts';
import { CurrencyProvider } from '../valuation/currencyProvider.ts';
import { ValuationPolicy } from '../valuation/policy.ts';
import { Account } from './account.ts';
import { AccountAssignmentError, DefaultAccountManager } from './accountManager.ts';
import { Amount } from './amount.ts';
import { PostingBuilder } from './posting.ts';
import { Transaction, TransactionBuilder } from './transaction.ts';
import { TransactionAutoBalanceError, TransactionAutoBalancer } from './transactionAutoBalancer.ts';
import { TransactionValidationError, TransactionValidationService } from './transactionValidationService.ts';

class ShamAccountManager extends DefaultAccountManager {
  requestAccountAssignment(identifier: string, _objContext: any) {
    // For test purposes, if the identifier is "fail", simulate an error.
    if (identifier === "fail") {
      return new AccountAssignmentError("Account assignment failed");
    }
    // Otherwise, simulate a successful assignment by returning a new Account.
    return new Account(identifier);
  }
}

describe('TransactionBuilder', () => {
  let conversionService: CurrencyConversionService;
  let currencyProvider: CurrencyProvider;
  let valuationConfig: ValuationConfiguration;
  let valuationPolicy: ValuationPolicy;
  let validationService: TransactionValidationService;
  let autoBalancer: TransactionAutoBalancer;
  let accountManager: DefaultAccountManager;
  let transactionBuilder: TransactionBuilder;
  const now = Date.now();
  const later = now + 1000;

  beforeEach(() => {
    conversionService = new CurrencyConversionService();
    currencyProvider = new CurrencyProvider(new ValuationConfiguration());
    valuationConfig = new ValuationConfiguration();
    valuationPolicy = new ValuationPolicy(now);
    validationService = new TransactionValidationService(conversionService, valuationConfig, valuationPolicy);
    autoBalancer = new TransactionAutoBalancer(conversionService, currencyProvider, valuationConfig);
    accountManager = new DefaultAccountManager();

    transactionBuilder = new TransactionBuilder(validationService)
      .withId("tx-001")
      .withDate(now)
      .withDate2(later)
      .withSource({ sourceText: "test source", modifiable: true })
      .withMetadata({ test: "transaction" });
  });

  it('should successfully build a transaction with valid posting builders', () => {
    // Create two valid posting builders.
    const pb1 = new PostingBuilder(accountManager);
    pb1.withDate(now)
      .withDate2(now + 500)
      // Although the transaction ID is later injected, we pre-set one.
      .withTransactionID("tx-001")
      .withAccountIdentifier("acct-1")
      .attachAccountManager(new ShamAccountManager())
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(100) }
        ])
      );

    const pb2 = new PostingBuilder(accountManager);
    pb2.withDate(now)
      .withDate2(now + 500)
      .withTransactionID("tx-001")
      .withAccountIdentifier("acct-2")
      .attachAccountManager(new ShamAccountManager())
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(-100) }
        ])
      );

    // Append posting builders.
    transactionBuilder.appendPostingBuilder(pb1);
    transactionBuilder.appendPostingBuilder(pb2);

    expect(isOk(pb1.isBuildable())).toBe(false);
    expect(isOk(pb2.isBuildable())).toBe(false);
    expect(isOk(transactionBuilder.isBuildable())).toBe(false);

    pb1.genId();
    pb2.genId();

    expect(isOk(pb1.isBuildable())).toBe(true);
    expect(isOk(pb2.isBuildable())).toBe(true);
    expect(isOk(transactionBuilder.isBuildable())).toBe(true);

    // Check that each posting builder now carries the parent's transaction id.
    expect(pb1.getTransactionID()).toBe("tx-001");
    expect(pb2.getTransactionID()).toBe("tx-001");

    // Validate that the transaction is buildable.
    const buildable = transactionBuilder.isBuildable();
    expect(isOk(buildable)).toBe(true);

    // Auto balance should do nothing because no inferred posting is present.
    const autoBalanceResult = transactionBuilder.autoBalance(autoBalancer);
    expect(isOk(autoBalanceResult)).toBe(true);

    // Build the transaction and verify its properties.
    const result = transactionBuilder.build();
    expect(!(result instanceof Error)).toBe(true);
    if (!(result instanceof Error)) {
      expect(result.id).toBe("tx-001");
      expect(result.date).toBe(now);
      expect(result.date2).toBe(later);
      expect(result.source).toEqual({ sourceText: "test source", modifiable: true });
      expect(result.metadata).toEqual({ test: "transaction" });
      expect(result.postings.length).toBe(2);
      expect(result.postings[0].account.identifier).toBe("acct-1");
      expect(result.postings[1].account.identifier).toBe("acct-2");
    }
  });

  it('should fail build when required TransactionBuilder fields are missing', () => {
    // Create a transaction builder missing required fields (e.g. id is not set)
    const incompleteBuilder = new TransactionBuilder(validationService)
      .withDate(now)
      .withDate2(later)
      .withSource({ sourceText: "incomplete", modifiable: true })
      .withMetadata({});
    // isBuildable should return an error.
    const buildable = incompleteBuilder.isBuildable();
    expect(isOk(buildable)).toBe(false);

    // Attempt to build should yield an Error.
    const result = incompleteBuilder.build();
    expect(result instanceof Error).toBe(true);
  });

  it('should fail build if any posting builder is not buildable', () => {
    // Set a valid transaction id.
    transactionBuilder.withId("tx-002");

    // Create one valid posting builder.
    const validPb = new PostingBuilder(accountManager);
    validPb.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-valid")
      .attachAccountManager(new ShamAccountManager())
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(50) }
        ])
      );

    // Create an invalid posting builder (for instance, missing an account).
    const invalidPb = new PostingBuilder(accountManager);
    invalidPb.withDate(now)
      .withDate2(now + 500)
      // Notice: withAccount is not called.
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(-50) }
        ])
      );

    transactionBuilder.appendPostingBuilder(validPb);
    transactionBuilder.appendPostingBuilder(invalidPb);

    // Transaction builder should now be non-buildable.
    const buildable = transactionBuilder.isBuildable();
    expect(isOk(buildable)).toBe(false);

    const result = transactionBuilder.build();
    expect(result instanceof Error).toBe(true);
  });

  it('should successfully auto balance when exactly one posting has an inferred amount', () => {
    // Set a valid transaction id.
    transactionBuilder.withId("tx-003");

    // Create posting builder 1 with a defined amount.
    const pb1 = new PostingBuilder(accountManager);
    pb1.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-1")
      .attachAccountManager(new ShamAccountManager())
      .genId()
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(70) }
        ])
      );

    // Create posting builder 2 without an amount (i.e. inferred amount).
    const pb2 = new PostingBuilder(accountManager);
    pb2.withDate(now)
      .withDate2(now + 500)
      .genId()
      .withAccountIdentifier("acct-2")
      .attachAccountManager(new ShamAccountManager())
    // Note: withAmount is not called.

    transactionBuilder.appendPostingBuilder(pb1);
    transactionBuilder.appendPostingBuilder(pb2);

    // Before auto-balance, pb2 should not have an amount.
    expect(pb2.getAmount()).toBeUndefined();

    const autoBalanceResult = transactionBuilder.autoBalance(autoBalancer);
    expect(isOk(autoBalanceResult)).toBe(true);

    // After auto-balancing, build the transaction.
    const result = transactionBuilder.build();
    expect(!(result instanceof Error)).toBe(true);
    if (!(result instanceof Error)) {
      // In the built transaction the inferred posting should have an assigned amount.
      const autoBalancedPosting = result.postings[1];
      expect(autoBalancedPosting.amount).not.toBeNull();
      // Assuming the auto-balancing computes the negative of the other posting’s amount.
      expect(autoBalancedPosting.amount!.toString()).toContain("-70");
    }
  });

  it('should return an auto balance error when more than one posting has an inferred amount', () => {
    transactionBuilder.withId("tx-004");

    // Create two posting builders without amounts.
    const pb1 = new PostingBuilder(accountManager);
    pb1.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-1")
      .attachAccountManager(new ShamAccountManager())
    // Amount not set.

    const pb2 = new PostingBuilder(accountManager);
    pb2.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-2")
      .attachAccountManager(new ShamAccountManager())
    // Amount not set.

    transactionBuilder.appendPostingBuilder(pb1);
    transactionBuilder.appendPostingBuilder(pb2);

    // When more than one posting is inferred, auto balancing should return an error.
    const autoBalanceResult = transactionBuilder.autoBalance(autoBalancer);
    expect(autoBalanceResult instanceof TransactionAutoBalanceError).toBe(true);
  });
  it('should return an transaction validation error when there is a non-zero balance', () => {
    transactionBuilder.withId("tx-004");

    const pb1 = new PostingBuilder(accountManager);
    pb1.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-1")
      .attachAccountManager(new ShamAccountManager())
      .genId()
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(-1) }
        ])
      );

    const pb2 = new PostingBuilder(accountManager);
    pb2.withDate(now)
      .withDate2(now + 500)
      .withAccountIdentifier("acct-2")
      .attachAccountManager(new ShamAccountManager())
      .genId()
      .withAmount(
        Amount.create([
          { currency: new Currency("USD"), value: Rational.fromNumber(-1) }
        ])
      );

    transactionBuilder.appendPostingBuilder(pb1);
    transactionBuilder.appendPostingBuilder(pb2);

    expect(transactionBuilder.build()).toBeInstanceOf(TransactionValidationError);

    const pb3 = new PostingBuilder(accountManager);
    pb3.withDate(now)
      .withDate2(now)
      .withAccountIdentifier("acct-2")
      .attachAccountManager(new ShamAccountManager())
      .genId();

    transactionBuilder.appendPostingBuilder(pb3);

    const autoBalanceResult = transactionBuilder.autoBalance(autoBalancer);
    expect(autoBalanceResult instanceof TransactionAutoBalanceError).toBe(false);

    expect(transactionBuilder.build()).toBeInstanceOf(Transaction);
  });
});
