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

async function readAll(file: string) {
  let journal = Journal.create();

  const journalReader = new InputStreamJournalReader({ filePath: file, sourceModifiable: false });
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}


describe.sequential('Integration: JournalReaderAdapter x Pricing', () => {
  it('uses UTC date for YYYY-MM-DD', async () => {
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
      '  \tAsset.Checking.BoA\t-1 * [1 USD] / 3',
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

  it('inherits parent reader\'s onPricing (include directive x pricing)', async () => {
      const dir = "~testout/InputStreamJournalReader_Pricing.1/";
      mkdirSync(dir, { recursive: true });

      const files = {
        main: join(dir, 'main.ledg'),
        inc1: join(dir, 'inc1.ledg'),
        inc1a: join(dir, 'inc1a.ledg'),
        inc2: join(dir, 'inc2.ledg')
      };

      writeFileSync(files.inc1a, 'P 2024-01-10 USD 13CNY');
      writeFileSync(files.inc1, `
include ./inc1a.ledg
2024-01-01 event inside inc1 #aaaaaaaa`);
      writeFileSync(files.inc2, '2024-01-05 event inc2 event #aaaaaaab\n');
      writeFileSync(files.main, `
include ./inc1.ledg
include inc2.ledg
2024-01-10 00:00:00 open TestAcc1
2024-01-10 00:00:00 open TestAcc2
2024-01-10 event main after include #aaaaaaad
  \tTestAcc1\t1USD
  \tTestAcc2\t-13CNY
`);

      expect(await readAll(files.main)).toBe(Ok);
    });

  it('throws error before calling commit (race condition fix)', async () => {
      let journal = Journal.create();
      let src = [
        '2025-01-01 open Equity.OpeningBalance',
        'P 2040-01-01 USD 3CNY',
        '2040-01-01 00:00:00 open Asset.Checking.BoA #ffddaazz',
        '  ;test:1',
        '  \tEquity.OpeningBalance\tCNY -1',
        '  \tAsset.Checking.BoA\t [1 USD] / 3', // 0.333
        '2040-01-01 00:00:01=2040-01-01 00:00:02 close  Asset.Checking.BoA   #ffddaaz2',
        '  \tAsset.Checking.BoA\t -1 * [1 EUR] / 3',
        '  \tEquity.OpeningBalance',
      ];
      expect(getErrorMessages(await parseSrc(src, journal))).toMatch("Account closing directives cannot have an auxiliary date");
    });
});