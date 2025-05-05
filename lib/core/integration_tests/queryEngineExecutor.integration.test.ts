import { describe, expect, it } from 'vitest';
import { Journal } from '../data/journal.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { isOk, Ok } from '../types.ts';
import { getErrorMessages } from '../utils/debugErrorTools.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TransactionBuilder } from '../accounting/transaction.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\r\n"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}

describe.sequential('Integration: QueryEngineExecutor', () => {
  it('works', async () => {
    let journal = Journal.create();
    let src = [
      '2025-01-01 open Equity.OpeningBalance',
      '2039-01-01 00:00:00 open Asset.Checking.BoA',
      '2039-01-01 00:00:01   close     Asset.Checking.BoA    ',
      'P 2040-01-01 USD 3CNY',
      '2040-01-01 00:00:00      open      Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance\tCNY -1',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close  Asset.Checking.BoA   #ffddaaz2',
      '  \tAsset.Checking.BoA\t -1 * [1 EUR] / 3',
      '  \tEquity.OpeningBalance',
    ];
    expect(await parseSrc(src, journal)).toBe(Ok);

    expect(journal.transactionStore.size()).toEqual(5);

    expect(getErrorMessages(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2039-01-01 00:00:00 open Asset.Checking.BoA',
      '2039-01-01 00:00:01   close     Asset.Checking.BoA    ',
      'P 2040-01-01 00:00:01 USD 2CNY',
      'P 2040-01-01 USD 3CNY',
      '2040-01-01 00:00:00      open      Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance\tCNY -1',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close  Asset.Checking.BoA   #ffddaaz2',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance\t1CNY', // 1 - 2/3 = 1/3
    ], Journal.create()))).toMatch(/Unresolved balance of: 0.3333333333 CNY = 1 \/ 3 CNY/);

    expect(await parseSrc([
      '2025-01-01 open Equity.OpeningBalance',
      '2039-01-01 00:00:00 open Asset.Checking.BoA',
      '2039-01-01 00:00:01   close     Asset.Checking.BoA    ',
      'P 2040-01-01 00:00:01 USD 2CNY',
      'P 2040-01-01 USD 3CNY',
      '2040-01-01      open      Asset.Checking.BoA #ffddaazz',
      '  ;test:1',
      '  \tEquity.OpeningBalance\tCNY -1',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
      '2040-01-01 00:00:01 close  Asset.Checking.BoA   #ffddaaz2',
      '  \tAsset.Checking.BoA\t -1 * [1 USD] / 3',
      '  \tEquity.OpeningBalance\t2/3*[1CNY]',
    ], Journal.create())).toBe(Ok);
  });
});