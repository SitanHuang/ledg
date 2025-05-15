import { None, Ok, OkType, Option, Result, timestamp, unwrap } from "../types.ts";
import { Account, AccountIdentifier } from "./account.ts";
import { BalanceAssertionService } from "./balanceAssertionService.ts";

export class AccountAssignmentError extends Error {
  protected readonly __accountAssignmentErrorBrand = undefined;
};

export type AccountStatus = "closed" | "open" | "unopen";
export const ACCOUNT_CLOSED: AccountStatus = "closed";
export const ACCOUNT_OPEN: AccountStatus = "open";
export const ACCOUNT_UNOPEN: AccountStatus = "unopen";

export interface AccountAssignableObject {
  date?: timestamp;
  date2?: timestamp;
}

export class AccountClosureAssertionError extends Error {
  protected readonly __accountClosureAssertionErrorBrand = undefined;
}

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
  abstract getAccountsList(): readonly Account[];

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
  ): Result<Option<OkType>, AccountClosureAssertionError>;

  getOrOpenAccount(identifier: AccountIdentifier, time: timestamp): Account {
    this.openAccount(identifier, time);
    return unwrap(this.getAccount(identifier));
  }

  /**
   * Return every account that is **ever** OPEN at any instant in the
   * half‑open interval [from, to) (to defaults to from when omitted).
   *
   * Importantly, account is OPEN if `to` co-incides with a closure event; this
   * is so that reports such as incomestatements still show the closure posting
   * amounts.
   */
  abstract getAccountsEverOpenedDuringRange(from: timestamp, to?: timestamp): readonly Account[];

  /**
   * Returns account status for a specific date/date2 range of a single
   * AccountAssignableObject. If an account is partially CLOSED during `from` to `to`, then
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
    objContext: AccountAssignableObject
  ): AccountStatus {
    if (objContext.date === undefined)
      return ACCOUNT_UNOPEN;

    objContext.date2 ??= objContext.date;

    if (objContext.date < objContext.date2)
      return this.getAccountStatusByDateRange(identifier, objContext.date, objContext.date2);
    else
      return this.getAccountStatusByDateRange(identifier, objContext.date2, objContext.date);
  }

  /**
   * Requests assignment of an Account onto a AccountAssignableObject. Returns error if:
   *   - Account has yet to be opened
   *   - Account has been closed
   *
   * The above validations make maximally conservative assumptions based on date
   * and date2; that is:
   *   - Account closure must be after the latest of date/date2
   *   - Account opening must be before the earliest of date/date2
   *
   * Because account balance assertions are evaluated at parse time, any
   * postings written after a previous close directive, regardless of posting
   * dates, are disallowed. Postings with date/date2 before the previous open
   * directive are also disallowed for the same reason.
   */
  abstract requestAccountAssignment(
    identifier: AccountIdentifier,
    objContext: AccountAssignableObject
  ): Result<Account, AccountAssignmentError>;
}


interface DefaultAccountRecord {
  time: timestamp,
  type: "open" | "close"
}

export class DefaultAccountManager extends AccountManager {
  // For each account identifier, store the Account instance and a timeline of events.
  // Each event is an object: { time, type } where type is "open" or "close".
  //
  // The events MUST be in insertion order at parse time for requestAccountAssignment to work.
  protected accounts: Map<AccountIdentifier, { account: Account; events: DefaultAccountRecord[] }>;
  protected knownAccounts: Account[];

  constructor() {
    super();
    this.accounts = new Map();
    this.knownAccounts = [];
  }

  override getAccountsList(): readonly Account[] {
    return this.knownAccounts;
  }

  override getAccount(identifier: AccountIdentifier): Option<Account> {
    const entry = this.accounts.get(identifier);
    return entry ? entry.account : None;
  }

  override openAccount(identifier: AccountIdentifier, time: timestamp): Option<OkType> {
    const entry = this.accounts.get(identifier);
    if (!entry) {
      // Create new account and record open event.
      const account = new Account(identifier);

      this.accounts.set(identifier, { account, events: [{ time: time, type: "open" }] });

      this.knownAccounts.push(account);
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

  override closeAccount(
    identifier: AccountIdentifier,
    time: timestamp,
    balanceAssertionService: BalanceAssertionService,
  ): Result<Option<OkType>, AccountClosureAssertionError> {
    const entry = this.accounts.get(identifier);
    if (!entry) return None; // never opened

    const events = entry.events;

    const status = this.getStatusAt(events, time);
    if (status !== ACCOUNT_OPEN){
      return None; // closed / unopened / coincident
    }

    const balance = balanceAssertionService.assertAccountStrictlyZero(entry.account, time);

    // balance must be *strictly* zero at the moment of closure
    if (balance !== true) {
      return new AccountClosureAssertionError(
        `Account "${identifier}" cannot be closed due to non-strictly-zero balance ` +
        `of [${balance.map(x => x[1].toFractionString() || "ZERO").join("; ")}] ` +
        `for evaluation methods [${balance.map(x => `"${x[0]}"`).join("; ")}].`
      );
    }

    events.push({ time, type: "close" });
    return Ok;
  }

  override getAccountsEverOpenedDuringRange(from: timestamp, to?: timestamp): Account[] {
    // Normalise the interval
    let start = from;
    let end = to ?? from;
    if (start > end) [start, end] = [end, start];

    const openAccounts: Account[] = [];

    for (const { account, events } of this.accounts.values()) {
      // Obviously unopened accounts
      if (events.length === 0) continue;

      // Work on a **time‑sorted** copy
      const sorted = [...events].sort((a, b) => a.time - b.time);

      let isOpen = false; // current state while scanning
      let currentOpenTime = Number.NaN; // the time of the last open

      for (const ev of sorted) {
        if (ev.type === "open") {
          isOpen = true;
          currentOpenTime = ev.time;
          continue;
        }

        if (!isOpen) continue;

        // We have an open interval: [currentOpenTime, ev.time)
        if (intervalsOverlap(currentOpenTime, ev.time, start, end)) {
          openAccounts.push(account);
          break; // no need to examine the rest of this account
        }

        isOpen = false; // we’ve consumed this open span
      }

      // Handle a final **open** with no matching “close”
      if (isOpen) {
        if (intervalsOverlap(currentOpenTime, Number.POSITIVE_INFINITY, start, end)) {
          openAccounts.push(account);
        }
      }
    }

    /**
     * Test two half‑open intervals [aStart, aEnd] and [bStart, bEnd) for
     * any overlap.
     */
    function intervalsOverlap(aStart: timestamp, aEnd: timestamp,
      bStart: timestamp, bEnd: timestamp): boolean {
      return aStart < bEnd && bStart <= aEnd;
    }

    return openAccounts;
  }

  override requestAccountAssignment(
    identifier: AccountIdentifier,
    objContext: AccountAssignableObject
  ): Result<Account, AccountAssignmentError> {

    const entry = this.accounts.get(identifier);
    if (!entry || objContext.date === undefined) {
      return new AccountAssignmentError(`Account "${identifier}" was never opened.`);
    }

    const lastEv = entry.events.at(-1)!; // last directive in parse order

    // refuse anything parsed after a CLOSE
    if (lastEv.type === "close") {
      return new AccountAssignmentError(
        "Any postings parsed after the previous CLOSE directive are not allowed. " +
        "This is because closure directives only enforce balance assertions AT PARSE TIME."
      );
    }

    // refuse dates earlier than the previous OPEN
    const earliest = objContext.date2 === undefined
        ? objContext.date
        : Math.min(objContext.date, objContext.date2);

    if (earliest !== undefined && earliest < lastEv.time /* lastEv is OPEN here */) {
      return new AccountAssignmentError(
        "Posting dates preceding the most recently parsed OPEN directive are not allowed. " +
        "This is because closure directives only enforce balance assertions AT PARSE TIME."
      );
    }

    return entry.account;
  }

  override getAccountStatusByDateRange(identifier: AccountIdentifier, from: timestamp, to?: timestamp): AccountStatus {
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