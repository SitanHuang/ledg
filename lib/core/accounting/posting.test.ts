import { describe, it, expect, beforeEach } from 'vitest';
import { Posting, PostingBuilder } from './posting.ts';
import { Account } from './account.ts';
import { Amount } from './amount.ts';
import { Rational } from '../math/rational.ts';
import { AccountManager, AccountAssignmentError, DefaultAccountManager } from './accountManager.ts';
import { None, Ok } from '../types.ts';
import { CommitRegistry } from '../data/commitRegistry.ts';
import { Metadata } from '../data/ledgObject.ts';

// A minimal sham implementation of AccountManager for testing PostingBuilder.
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

// A dummy commit registry that simply records commits for inspection.
class DummyCommitRegistry extends CommitRegistry {
  public _commits: { messages: string[]; object: any }[] = [];
  commitChange(commit: { messages: string[]; object: any }) {
    this._commits.push(commit);
  }
}

describe('PostingBuilder', () => {
  let accountManager: ShamAccountManager;
  let builder: PostingBuilder;
  const dummySource = { sourceText: 'test source', modifiable: true };
  const dummyMetadata = { tag: 'unit-test' };
  const now = Date.now();
  const later = now + 1000; // just an example date later

  beforeEach(() => {
    accountManager = new ShamAccountManager();
    builder = new PostingBuilder(accountManager);
  });

  it('should build a Posting successfully when all required fields are provided', () => {
    builder
      .withId("posting1")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      .withTransactionID("tx-123")
      .withAccount(new Account("acct1"))
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(100) }
        ])
      );

    expect(builder.getTransactionID()).toBe("tx-123");
    expect(builder.getAccount()?.identifier).toBe("acct1");

    const result = builder.build();
    if (result instanceof Error) {
      throw result;
    }

    expect(result.id).toBe("posting1");
    expect(result.date).toBe(now);
    expect(result.date2).toBe(later);
    expect(result.transactionID).toBe("tx-123");
    expect(result.account.identifier).toBe("acct1");
    expect(result.amount!.toString()).toContain("100");
    expect(result.source).toEqual(dummySource);
    expect(result.metadata).toEqual(dummyMetadata);
  });

  it('should fail to build when a LedgObject required field is missing', () => {
    builder
      .withId("posting2")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata((null as unknown as Metadata)) // <-- required by LedgObject
      .withTransactionID("asdf")
      .withAccount(new Account("acct1"))
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(100) }
        ])
      );
    const result = builder.build();
    expect(result).toBeInstanceOf(Error);
  });

  it('should fail to build when transactionID is missing', () => {
    builder
      .withId("posting2")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      // transactionID not set
      .withAccount(new Account("acct1"))
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(100) }
        ])
      );
    const result = builder.build();
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("Attemping to build a Posting with empty transactionId.");
  });

  it('should fail to build when account is missing', () => {
    builder
      .withId("posting3")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      .withTransactionID("tx-123")
      // account not set
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(100) }
        ])
      );
    const result = builder.build();
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("Attemping to build a Posting with empty Account.");
  });

  it('should fail to build when amount is missing', () => {
    builder
      .withId("posting4")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      .withTransactionID("tx-123")
      .withAccount(new Account("acct1"));
    // amount not set
    const result = builder.build();
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("Attemping to build a Posting with empty Amount");
  });

  it('assignAccount should return Ok when assignment is successful', () => {
    // When a valid account identifier (other than "fail") is provided, assignment succeeds.
    const result = builder.assignAccount("validAcct");
    expect(result).toBe(Ok);
  });

  it('assignAccount should return AccountAssignmentError when assignment fails', () => {
    // When the identifier is "fail", the sham account manager returns an error.
    const result = builder.assignAccount("fail");
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toBe("Account assignment failed");
    }
  });

  it('commitChanges should commit modifications if the builder is built and modified', () => {
    // First, build a valid Posting.
    builder
      .withId("posting5")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      .withTransactionID("tx-555")
      .withAccount(new Account("acct5"))
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(50) }
        ])
      );
    const postResult = builder.build();
    if (postResult instanceof Error) {
      throw postResult;
    }
    // Mark the builder as modified.
    builder.setModified("Initial creation");
    // Create a dummy commit registry.
    const dummyRegistry = new DummyCommitRegistry();
    builder.commitChanges(dummyRegistry);
    expect(dummyRegistry._commits.length).toBe(1);
    expect(dummyRegistry._commits[0].messages).toEqual(["Initial creation"]);
    expect(dummyRegistry._commits[0].object).toBe(postResult);
  });

  it('commitChanges should not commit if the builder is not modified', () => {
    builder
      .withId("posting6")
      .withDate(now)
      .withDate2(later)
      .withSource(dummySource)
      .withMetadata(dummyMetadata)
      .withTransactionID("tx-666")
      .withAccount(new Account("acct6"))
      .withAmount(
        Amount.create([
          { currency: { id: "USD" }, value: Rational.fromNumber(75) }
        ])
      );
    const postResult = builder.build();
    if (postResult instanceof Error) {
      throw postResult;
    }
    // Do not mark the builder as modified.
    const dummyRegistry = new DummyCommitRegistry();
    builder.commitChanges(dummyRegistry);
    expect(dummyRegistry._commits.length).toBe(0);
  });
});
