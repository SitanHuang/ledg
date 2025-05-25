// accountManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultAccountManager,
  AccountAssignmentError,
  ACCOUNT_OPEN,
  ACCOUNT_CLOSED,
  ACCOUNT_UNOPEN,
} from './accountManager.ts';
import { Optional, Ok, None, OkType } from '../types.ts';
import { Account } from '../accounting/account.ts';
import { BalanceAssertionService } from '../accounting/balanceAssertionService.ts';
import { LedgObject } from '../data/ledgObject.ts';
import { DefaultTransactionStore } from '../data/transactionStore.ts';

// ShamAccountManager overrides closeAccount to simply add a close event based
// solely on time-based validation. We'll test closeAccount with
// BalanceAssertionService probably in the future.
class ShamAccountManager extends DefaultAccountManager {
  closeAccount(
    identifier: string,
    time: number,
    _balanceAssertionService: BalanceAssertionService
  ): Optional<OkType> {
    const accounts = this.accounts as Map<
      string,
      { account: Account; events: { time: number; type: "open" | "close" }[] }
    >;
    const entry = accounts.get(identifier);
    if (!entry) {
      return new AccountAssignmentError(`Account "${identifier}" was never opened.`);
    }
    const currentStatus = this.getAccountStatusByDateRange(identifier, time);
    if (currentStatus === ACCOUNT_CLOSED) {
      return None;
    }
    entry.events.push({ time, type: "close" });
    return Ok;
  }
}

describe('AccountManager', () => {
  let accountManager: ShamAccountManager;
  const dummyBalanceService = new BalanceAssertionService(new DefaultTransactionStore());

  beforeEach(() => {
    accountManager = new ShamAccountManager();
  });

  it('should create an account on openAccount if not exists', () => {
    const result = accountManager.openAccount("A", 100);
    expect(result).toBe(Ok);
    const account = accountManager.getAccount("A");
    expect(account).not.toBe(None);
    expect((account as Account).identifier).toBe("A");
  });

  it('should return None when opening an already open account', () => {
    const res1 = accountManager.openAccount("A", 100);
    expect(res1).toBe(Ok);
    const res2 = accountManager.openAccount("A", 150);
    expect(res2).toBe(None);
    expect(accountManager.getOrOpenAccount("A", 50)).toStrictEqual(accountManager.getOrOpenAccount("A", 125));
  });

  it('should allow non-monotonic event insertion and compute status correctly', () => {
    let res = accountManager.openAccount("A", 100);
    expect(res).toBe(Ok);
    res = accountManager.closeAccount("A", 500, dummyBalanceService);
    expect(res).toBe(Ok);
    res = accountManager.openAccount("A", 100);
    expect(res).toBe(None);
    res = accountManager.openAccount("A", 150);
    expect(res).toBe(None);
    res = accountManager.openAccount("A", 50);
    expect(res).toBe(Ok);
    res = accountManager.openAccount("A", 500);
    expect(res).toBe(None);
    res = accountManager.openAccount("A", 501);
    expect(res).toBe(Ok);
    res = accountManager.openAccount("A", -100);
    expect(res).toBe(Ok);
    res = accountManager.openAccount("A", 500.5);
    expect(res).toBe(Ok);
    // Timeline by timestamp: t=100 open, t=200 open, t=500 close.
    // At time 600, the latest event (t=500) is a close so the account should be closed.
    const status = accountManager.getAccountStatusByDateRange("A", 50, 600);
    expect(status).toBe(ACCOUNT_CLOSED);
  });

  it('should return UNOPEN status when account does not exist in the interval', () => {
    // For an account that has never been opened.
    const status = accountManager.getAccountStatusByDateRange("B", 100, 200);
    expect(status).toBe(ACCOUNT_UNOPEN);
  });

  it('should correctly evaluate getAccountStatusByDateRange over multiple events', () => {
    // Timeline: open at 100, close at 300, open at 400.
    accountManager.openAccount("A", 100);
    accountManager.closeAccount("A", 300, dummyBalanceService);
    accountManager.openAccount("A", 400);

    // Interval before any events occur.
    expect(accountManager.getAccountStatusByDateRange("A", 50, 90)).toBe(ACCOUNT_UNOPEN);
    expect(accountManager.getAccountStatusByDateRange("A", 90, 50)).toBe(ACCOUNT_UNOPEN);
    expect(accountManager.getAccountStatusByDateRange("A", 290, 50)).toBe(ACCOUNT_UNOPEN);
    expect(accountManager.getAccountStatusByDateRange("A", 500, 50)).toBe(ACCOUNT_UNOPEN);
    // Interval during the first open period.
    expect(accountManager.getAccountStatusByDateRange("A", 150, 250)).toBe(ACCOUNT_OPEN);
    expect(accountManager.getAccountStatusByDateRange("A", 250, 150)).toBe(ACCOUNT_OPEN);
    // Interval spanning a close and re-open: since part of the interval is not open,
    // the method should return ACCOUNT_CLOSED.
    expect(accountManager.getAccountStatusByDateRange("A", 350, 450)).toBe(ACCOUNT_CLOSED);
    expect(accountManager.getAccountStatusByDateRange("A", 450, 350)).toBe(ACCOUNT_CLOSED);
    // Interval entirely after re-opening.
    expect(accountManager.getAccountStatusByDateRange("A", 410, 500)).toBe(ACCOUNT_OPEN);
    expect(accountManager.getAccountStatusByDateRange("A", 500, 410)).toBe(ACCOUNT_OPEN);
  });

  it('should error on requestAccountAssignment if account was never opened', () => {
    // Create a dummy LedgObject with just date and date2 (order does not matter)
    let result = accountManager.requestAccountAssignment("C", { date: 100, date2: 100 });
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("never opened");
    }
    accountManager.openAccount("C", 100);
    result = accountManager.requestAccountAssignment("C", { date: 100, date2: 100 });
    expect(result).toBeInstanceOf(Account);

    result = accountManager.requestAccountAssignment("C", { date: 100 });
    expect(result).toBeInstanceOf(Account);

    result = accountManager.requestAccountAssignment("C", {});
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("never opened");
    }

    result = accountManager.requestAccountAssignment("C", { date2: 100 });
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("never opened");
    }
  });

  it('should error on requestAccountAssignment if account is closed', () => {
    accountManager.openAccount("A", 100);
    accountManager.closeAccount("A", 200, dummyBalanceService);
    let result = accountManager.requestAccountAssignment("A", { date: 0, date2: 150 } as LedgObject);
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("never opened");
    }
    result = accountManager.requestAccountAssignment("A", { date: 150, date2: 250 } as LedgObject);
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("closed");
    }
    result = accountManager.requestAccountAssignment("A", { date: 190, date2: 50 } as LedgObject);
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("never opened");
    }
    result = accountManager.requestAccountAssignment("A", { date: 200, date2: 200 } as LedgObject);
    expect(result).toBeInstanceOf(AccountAssignmentError);
    if (result instanceof AccountAssignmentError) {
      expect(result.message).toContain("closed");
    }
  });

  it('should return account on requestAccountAssignment if account is open', () => {
    accountManager.openAccount("A", 100);
    const dummyLedgObject = { date: 150, date2: 150 } as LedgObject;
    const result = accountManager.requestAccountAssignment("A", dummyLedgObject);
    expect(result).not.toBeInstanceOf(AccountAssignmentError);
    const account = result as Account;
    expect(account.identifier).toBe("A");
  });

  it('should handle non-monotonic open/close sequences properly', () => {
    // Create an account with events inserted out of order.
    accountManager.openAccount("A", 300);
    accountManager.closeAccount("A", 400, dummyBalanceService);
    accountManager.openAccount("A", 200);
    accountManager.closeAccount("A", 350, dummyBalanceService);
    // Timeline by timestamp:
    //   t=200: open, t=300: open, t=350: close, t=400: close.
    // At time 250: latest event is at 200 (open) → status open.
    expect(accountManager.getAccountStatusByDateRange("A", 250)).toBe(ACCOUNT_OPEN);
    // At time 360: latest event is at 350 (close) → status closed.
    expect(accountManager.getAccountStatusByDateRange("A", 360)).toBe(ACCOUNT_CLOSED);
    // At time 410: latest event is at 400 (close) → status closed.
    expect(accountManager.getAccountStatusByDateRange("A", 410)).toBe(ACCOUNT_CLOSED);
  });
});
