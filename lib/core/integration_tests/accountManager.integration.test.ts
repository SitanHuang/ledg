import { describe, expect, it } from 'vitest';
import { Journal } from '../data/journal.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { isOk, Ok } from '../types.ts';
import { getErrorMessages } from '../utils/debugErrorTools.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\r\n"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}

describe.sequential('Integration: JournalReaderAdapter x AccountManager.closeAccount', () => {
  it('parses most basic case', async () => {
    let journal = Journal.create();
    let src = [
      '2025-01-01 open Equity.OpeningBalance',
      '2039-01-01 00:00:00 open Asset.Checking.BoA',
      '2039-01-01 00:00:01   close     Asset.Checking.BoA    ',
      '2040-01-01 00:00:00      open      Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close  Asset.Checking.BoA   #ffddaaz2',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance',
      '2038-01-01 00:00:00 open      Asset.Checking.BoA    ',
      '2038-01-01 00:00:01   close     Asset.Checking.BoA    ',
      '2041-01-01 00:00:00 open Asset.Checking.BoA',
      '2041-01-01 00:00:01   close     Asset.Checking.BoA    ',
    ];
    expect(await parseSrc(src, journal)).toBe(Ok);

    expect(journal.transactionStore.size()).toEqual(9);

    const txn = journal.transactionStore.getTransactionById('ffddaazz')!;

    expect(txn.description).toEqual("open      Asset.Checking.BoA");
    expect(txn.accountOpened).toEqual("Asset.Checking.BoA");
    expect(txn.accountClosed).toBeUndefined();

    let amt = txn.postings[0].amount?.getEntries()[0]!;
    expect(txn.postings[0].account.identifier).toEqual("Equity.OpeningBalance");
    expect(amt.currency.id).toEqual("USD");
    expect(amt.value.reduce().numerator).toEqual(-1n);
    expect(amt.value.reduce().denominator).toEqual(3n);

    let amt2 = txn.postings[1].amount?.getEntries()[0]!;
    expect(txn.postings[1].account.identifier).toEqual("Asset.Checking.BoA");
    expect(amt2.currency.id).toEqual("USD");
    expect(amt2.value.reduce().numerator).toEqual(1n);
    expect(amt2.value.reduce().denominator).toEqual(3n);

    expect(txn.source.sourceText).toMatch(src.slice(3, 7).join("\r\n"));

    const txn2 = journal.transactionStore.getTransactionById('ffddaaz2')!;

    expect(txn2.description).toEqual("close  Asset.Checking.BoA");
    expect(txn2.accountClosed).toEqual("Asset.Checking.BoA");
    expect(txn2.accountOpened).toBeUndefined();

    journal = Journal.create();
    expect(getErrorMessages(await parseSrc([
      '2040-01-01 Expense',
      '  ;test:1',
      '  \tExpense\t',
    ], journal))).toMatch(/Expense[^\r\n]+open/);
    expect(journal.transactionStore.size()).toEqual(0);
  });

  it('throws on co-incident declaractions', async () => {
    expect(getErrorMessages(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:00 close Asset.Checking.BoA',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance',
    ]) as Error)).toMatch(/cannot be closed.+time/);
  });
  it('throws on closing an unopened account', async () => {
    expect(getErrorMessages(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2039-01-01 00:00:01 close Asset.Checking.BoA',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance',
    ]) as Error)).toMatch(/was never opened/);
    expect(getErrorMessages(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2039-01-01 00:00:01 close Asset.Checking.BoA',
    ]) as Error)).toMatch(/cannot be closed.+time/);
  });
  it('throws on non-zero balance', async () => {
    expect(getErrorMessages(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close Asset.Checking.BoA',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 2',
      '  \tEquity.OpeningBalance',
    ]) as Error)).toMatch(/Account "Asset.Checking.BoA" cannot be closed due to non-strictly-zero balance of .+-1 \/ 6 USD./);
  });
  // it('enforces account assignment in PARSE ORDER', async () => {
  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  ;=2003-01-01',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //   ]) as Error)).toMatch(/cannot be closed due to non-strictly-zero balance of .+-1 \/ 1 \$./);
  //   expect(isOk(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //   ]))).toBe(true);
  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2002-01-01 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]) as Error)).toMatch(/previous CLOSE directive are not allowed/i);

  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2001-05-01 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]) as Error)).toMatch(/previous CLOSE directive are not allowed/i);

  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2002-02-01 open test',
  //     '2002-02-02 close test',
  //     '2002-03-01 open test',
  //     '2002-03-02 close test',
  //     '2001-05-01 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]) as Error)).toMatch(/previous CLOSE directive are not allowed/i);

  //   expect(isOk(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2002-02-01 open test',
  //     '2002-05-01 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]))).toBe(true);

  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2002-02-01 open test',
  //     '2002-01-02 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]))).toMatch(/most recently parsed OPEN directive are not allowed/);

  //   expect(getErrorMessages(await parseSrc([
  //     '2000-01-01 open null',
  //     '2000-01-01 open test',
  //     '2001-01-01 00:00:00',
  //     '  \ttest\t1',
  //     '  \tnull',
  //     '2002-01-01 00:00:01 close test',
  //     '  \ttest\t-1',
  //     '  \tnull',
  //     '2002-02-01 open test',
  //     '2002-05-01=2001-01-02 00:00:00',
  //     '  \ttest\t0',
  //     '  \tnull',
  //   ]))).toMatch(/most recently parsed OPEN directive are not allowed/);
  // });

  describe('enforces chronological processing of transactions', () => {
    it('accepts a close that appears first in source but is last by date', async () => {
      const events = [
        // This close is first in the source, but date=2002-01-02 → runs last
        '2002-01-02 00:00:00 close test',
        '  \ttest\t-1',
        '  \tnull',
        // Credit at 2001-01-02 → runs second
        '2001-01-02 00:00:00',
        '  \ttest\t1',
        '  \tnull',
        // Opens at 2001-01-01 → runs first
        '2001-01-01 open null',
        '2001-01-01 open test',
      ];

      expect(isOk(await parseSrc(events))).toBe(true);
    });

    it('rejects a close when balance is not zero at that date', async () => {
      const events = [
        // Close on 2002-01-02
        '2002-01-02 00:00:00 close test',
        // Open and credit happen after, but by date the close runs before they cancel
        '2001-01-01 open null',
        '2001-01-01 open test',
        '2001-12-31 23:59:59',
        '  \ttest\t1',
        '  \tnull',
        // Late debit, but too late
        '2002-01-03 00:00:00',
        '  \ttest\t-1',
        '  \tnull',
      ];

      // At 2002-01-02 close, balance = +1 → should error
      const err = await parseSrc(events);
      expect(getErrorMessages(err as Error))
        .toMatch(/cannot be closed due to non-strictly-zero balance/i);
    });

    it('uses source order to break ties on identical timestamps', async () => {
      const events = [
        '2001-05-01 open test',
        '2001-05-01 open null',

        // Two postings at exactly the same moment:
        '2001-05-02 10:00:00',
        '  \ttest\t1',   // credit first
        '  \tnull',
        '2001-05-02 10:00:00',
        '  \ttest\t-1',  // debit second
        '  \tnull',

        // Close at same date again—should see balance zero
        '2001-05-02 10:00:00 close test',
        '  \ttest\t0',
        '  \tnull',
      ];

      expect(isOk(await parseSrc(events))).toBe(true);
    });

    it('rejects a close when identical-timestamp tiebreak ordering leaves nonzero', async () => {
      const events = [
        '2001-05-01 open test',
        '2001-05-01 open null',

        // Debit first, then credit, then close—all same timestamp:
        '2001-05-02 10:00:00',
        '  \ttest\t-1',  // debit first → -1
        '  \tnull',
        '2001-05-02 10:00:00',
        '  \ttest\t1',   // credit second → 0
        '  \tnull',
        '2001-05-02 10:00:00 close test',
        '  \ttest\t0',
        '  \tnull',
      ];

      // Source order: debit(-1) → credit(+1) → close sees balance 0 → OK
      expect(isOk(await parseSrc(events))).toBe(true);

      // Now swap credit/debit order so close sees -1:
      const bad = [
        '2001-05-01 open test',
        '2001-05-01 open null',
        '2001-05-02 10:00:00',
        '  \ttest\t-1',  // debit first → -1
        '  \tnull',
        '2001-05-02 10:00:00 close test',
        '  \ttest\t0',
        '  \tnull',
        '2001-05-02 10:00:00',
        '  \ttest\t1',   // credit second → 0
        '  \tnull',
      ];
      const err = await parseSrc(bad);
      expect(getErrorMessages(err as Error))
        .toMatch(/cannot be closed due to non-strictly-zero balance/i);
    });
  });

});