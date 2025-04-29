import { describe, expect, it } from 'vitest';
import { Journal } from '../../data/journal.ts';
import { InputStreamJournalReader } from '../../parsing/journal/inputStreamJournalReader.ts';
import { Ok } from '../../types.ts';
import { getErrorMessages } from '../../utils/debugErrorTools.ts';
import { DefaultTransactionPipeline } from '../transactionPipeline.ts';
import { JournalReaderAdapter } from './journalReaderAdapter.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\r"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}

describe.sequential('JournalReaderAdapter', () => {
  it('parses most basic case', async () => {
    let journal = Journal.create();
    let src = [
      '2025-01-01 open Equity.OpeningBalance',
      '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close Asset.Checking.BoA',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance',
    ];
    expect(await parseSrc(src, journal)).toBe(Ok);

    expect(journal.transactionStore.size()).toEqual(3);

    const txn = journal.transactionStore.getTransactionById('ffddaazz')!;

    let amt = txn.postings[0].amount?.getEntries()[0]!;
    expect(txn.postings[0].account.identifier).toMatch("Equity.OpeningBalance");
    expect(amt.currency.id).toMatch("USD");
    expect(amt.value.reduce().numerator).toEqual(-1n);
    expect(amt.value.reduce().denominator).toEqual(3n);

    let amt2 = txn.postings[1].amount?.getEntries()[0]!;
    expect(txn.postings[1].account.identifier).toMatch("Asset.Checking.BoA");
    expect(amt2.currency.id).toMatch("USD");
    expect(amt2.value.reduce().numerator).toEqual(1n);
    expect(amt2.value.reduce().denominator).toEqual(3n);

    expect(txn.source.sourceText).toMatch(src.slice(1, 5).join("\r"));

    journal = Journal.create();
    expect(getErrorMessages(await parseSrc([
      '2040-01-01 Expense',
      '  ;test:1',
      '  \tExpense\t',
    ], journal))).toMatch(/Expense[^\r\n]+open/);
    expect(journal.transactionStore.size()).toEqual(0);
  });
});