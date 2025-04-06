import { LedgObject } from "../data/ledgObject.ts";
import { isNone, Option, Result, timestamp, OkType, unwrap, None, Ok } from "../types.ts";
import { Account, AccountIdentifier } from "./account.ts";
import { BalanceAssertionService } from "./balanceAssertionService.ts";

export class AccountAssignmentError extends Error {};

export type AccountStatus = "closed" | "open" | "unopen";
export const ACCOUNT_CLOSED: AccountStatus = "closed";
export const ACCOUNT_OPEN: AccountStatus = "open";
export const ACCOUNT_UNOPEN: AccountStatus = "unopen";

/**
 * The AccountManager's primary purpose is to track an account's life cycle:
 *   UNOPENED -> OPENED -> CLOSED -> REOPENED -> CLOSED -> OPEN
 *
 * Account opening, closure, and re-opening are strictly controlled with the
 * PRIMARY purpose to not let users accidentally log a posting into an unopened
 * or closed account, with secondary purpose to hide the account in the
 * generated financial reports.
 *
 * Account events may be inserted in NON-MONOTONIC order.
 *
 * Co-incident events are illegal.
 */
export abstract class AccountManager {
  abstract getAccount(identifier: AccountIdentifier): Option<Account>;

  /**
   * Opens an unopened account or reopens a closed account. Returns None if
   * account is already open.
   */
  abstract openAccount(identifier: AccountIdentifier, time: timestamp): Option<OkType>;

  /**
   * An account can only be closed if the balance at the time of closure is
   * **strictly zero** (i.e., zero on all currencies without conversions),
   * regardless of whether using date/date2 and whether accounting virtual or
   * real transactions.
   */
  abstract closeAccount(
    identifier: AccountIdentifier,
    time: timestamp,
    balanceAssertionService: BalanceAssertionService
  ): Option<OkType>;

  getOrOpenAccount(identifier: AccountIdentifier, time: timestamp): Account {
    this.openAccount(identifier, time);
    return unwrap(this.getAccount(identifier));
  }

  /**
   * Returns account status for a specific date/date2 range of a single
   * LedgObject. If an account is partially CLOSED during `from` to `to`, then
   * the method returns CLOSED. The method returns UNOPEN if and only if the
   * entire duration is UNOPEN.
   */
  abstract getAccountStatusByDateRange(
    identifier: AccountIdentifier,
    from: timestamp,
    to?: timestamp
  ): AccountStatus;

  getAccountStatusByContext(
    identifier: AccountIdentifier,
    objContext: LedgObject
  ): AccountStatus {
    if (objContext.date < objContext.date2)
      return this.getAccountStatusByDateRange(identifier, objContext.date, objContext.date2);
    else
      return this.getAccountStatusByDateRange(identifier, objContext.date2, objContext.date);
  }

  /**
   * Requests assignment of an Account onto a LedgObject. Returns error if:
   *   - Account has yet to be opened
   *   - Account has been closed
   *
   * The above validations make maximally conservative assumptions based on date
   * and date2; that is:
   *   - Account closure must be after the latest of date/date2
   *   - Account opening must be before the earliest of date/date2
   */
  requestAccountAssignment(
    identifier: AccountIdentifier,
    objContext: LedgObject
  ): Result<Account, AccountAssignmentError> {
    const accountResult = this.getAccount(identifier);
    if (isNone(accountResult)) {
      return new AccountAssignmentError(`Account "${identifier}" was never opened.`);
    }

    const account: Account = accountResult;

    const status = this.getAccountStatusByContext(identifier, objContext);

    switch (status) {
      case ACCOUNT_UNOPEN:
        return new AccountAssignmentError(`Account "${identifier}" was never opened.`);
      case ACCOUNT_CLOSED:
        return new AccountAssignmentError(`Account "${identifier}" is closed.`);
    }

    return account;
  }
}


interface DefaultAccountRecord {
  time: timestamp,
  type: "open" | "close"
}

export class DefaultAccountManager extends AccountManager {

  // For each account identifier, store the Account instance and a timeline of events.
  // Each event is an object: { time, type } where type is "open" or "close".
  protected accounts: Map<AccountIdentifier, { account: Account; events: DefaultAccountRecord[] }>;

  constructor() {
    super();
    this.accounts = new Map();
  }

  getAccount(identifier: AccountIdentifier): Option<Account> {
    const entry = this.accounts.get(identifier);
    return entry ? entry.account : None;
  }

  openAccount(identifier: AccountIdentifier, time: timestamp): Option<OkType> {
    const entry = this.accounts.get(identifier);
    if (!entry) {
      // Create new account and record open event.
      const account = new Account(identifier);
      // For performance we store a single event for most cases.
      this.accounts.set(identifier, { account, events: [{ time: time, type: "open" }] });
      return Ok;
    }

    const events = entry.events;
    if (events.length === 1) {
      const ev = events[0];
      if (ev.time <= time) {
        if (ev.type === "open") {
          return None;
        }
      }
    } else {
      const curStatus = this.getStatusAt(events, time);
      if (curStatus === ACCOUNT_OPEN || curStatus == "coincident") {
        return None;
      }
    }

    events.push({ time: time, type: "open" });
    return Ok;
  }

  closeAccount(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _identifier: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _time: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _balanceAssertionService: BalanceAssertionService
  ): Option<OkType> {
    throw new Error("Unimplemented.");
  }

  getAccountStatusByDateRange(identifier: AccountIdentifier, from: timestamp, to?: timestamp): AccountStatus {
    const entry = this.accounts.get(identifier);
    if (!entry) {
      return ACCOUNT_UNOPEN;
    }
    let start = from;
    let end = to ?? from;

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const events = entry.events;
    let lastEvent: DefaultAccountRecord | undefined = undefined;

    // Find the latest event at or before 'start'
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.time <= start && (!lastEvent || ev.time > lastEvent.time)) {
        lastEvent = ev;
      }
    }
    if (!lastEvent) return ACCOUNT_UNOPEN;

    // If the last event before (or at) start is an open, check for a closing event in (start, end]
    if (lastEvent.type === "open") {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.time > start && ev.time <= end && ev.type === "close") {
          return ACCOUNT_CLOSED;
        }
      }
      return ACCOUNT_OPEN;
    }
    // If the last event was a close, then the account is closed for the duration.
    return ACCOUNT_CLOSED;
  }


  // Determine account status at a given time from the events timeline.
  private getStatusAt(events: DefaultAccountRecord[], time: timestamp): AccountStatus | "coincident" {
    const n = events.length;
    if (n === 0) return ACCOUNT_UNOPEN;

    // Fast path for a single event.
    if (n === 1) {
      const ev = events[0];
      if (ev.time === time) {
        return "coincident";
      }

      return (ev.time < time)
        ? (ev.type === "open" ? ACCOUNT_OPEN : ACCOUNT_CLOSED)
        : ACCOUNT_UNOPEN;
    }

    let candidateTime = -Infinity;
    let candidateStatus = ACCOUNT_UNOPEN;
    for (let i = 0; i < n; i++) {
      const ev = events[i];
      if (ev.time === time) {
        return "coincident";
      }
      if (ev.time < time && ev.time > candidateTime) {
        candidateTime = ev.time;
        candidateStatus = ev.type === "open" ? ACCOUNT_OPEN : ACCOUNT_CLOSED;
      }
    }
    return candidateStatus;
  }

}