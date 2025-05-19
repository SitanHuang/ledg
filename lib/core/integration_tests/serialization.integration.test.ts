import { describe, expect, it } from 'vitest';
import { Journal } from '../data/journal.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { isOk, Ok } from '../types.ts';
import { getErrorMessages } from '../utils/debugErrorTools.ts';
import { QueryEngine, QueryPolicy } from '../reports/query/namespace.ts';
import { serializeTransaction } from '../serialize/transaction.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\r"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}

describe.sequential('Serialization', () => {
  it('serializes with nominal functionality', async () => {
    let journal = Journal.create();
    let src = [
      '2025-01-01 open Equity.Opening:Balance #ffddaaz2',
      '2040-01-01 open Asset.Checking.BoA #ffddaazz',
      '  ; test:1',
      '  asdf\tEquity.Opening:Balance\t-0.3333333', // 7 dps
      '  \tAsset.Checking.BoA\t[1 $] / 3',
      '  ; !',
      '',
      '2040-01-01=2040-02-05 ! event type stuff #ffddaaz3',
      '  ; tags:"test"',
      '  \tAsset.Checking.BoA\t-1',
      '  ; ! =2040-02-05 00:00:01',
      '  ; event:"type"',
      '  \tAsset.Checking.BoA\t+1',
      '  ; pending:false',
      '  ; event:"type2"',
      '',
      '2040-01-01=2060-02-02 00:00:01 stuff2 #ffdda1z3',
      '  ; test:"posting"',
      '  asdf\t[Equity.Opening:Balance]\t[0 $]',
      '  ; 2040-01-02',
      '  \tEquity.Opening:Balance\t[0 $]',
      '  ; 2040-01-02=2040-02-03',
      '  ; test:"posting"',
      '',
      '2050-01-01 close Asset.Checking.BoA #ffddaaz4',
      '  \tAsset.Checking.BoA\t-1 * [1 $] / 3',
      '  \tEquity.Opening:Balance',
      '\n',
    ];
    const result = await parseSrc(src, journal);
    if (result instanceof Error) {
      expect(getErrorMessages(result) + '\n' + result.stack).toBeFalsy();
      return;
    }

    const outs: string[] = [];
    const inferredOuts: string[] = [];
    const ledgerCompatOuts: string[] = [];

    QueryEngine.create(
      new QueryPolicy().withFrom(Date.parse('2030-01-01Z'))
    ).compile().executeTransactions(journal, (txn) => {
      outs.push(serializeTransaction(txn, {
        lineDelimiter: '\n'
      }));
      inferredOuts.push(serializeTransaction(txn, {
        lineDelimiter: '\r\n',
        useSourceText: false,
      }));
      ledgerCompatOuts.push(serializeTransaction(txn, {
        lineDelimiter: '\r\n',
        ledgerCompatible: true,
        useSourceText: false,
      }));
    });

    expect(outs.join("")).toBe(src.slice(1).toSpliced(10, 1).toSpliced(20, 1).join("\n").replace("; ! =2040-02-05", "; =2040-02-05"));
    expect(inferredOuts.join("")).toBe([
      '2040-01-01 open Asset.Checking.BoA #ffddaazz',
      '  ; test:1',
      '  asdf\tEquity.Opening:Balance\t-0.3333333 $', // 7 dps
      '  \tAsset.Checking.BoA\t0.3333333333 $', // 10 dps
      '  ; !',
      '',
      '2040-01-01=2040-02-05 ! event type stuff #ffddaaz3',
      '  ; tags:"test"',
      '  \tAsset.Checking.BoA\t-1 $',
      '  ; =2040-02-05 00:00:01',
      '  \tAsset.Checking.BoA\t1 $',
      '  ; pending:false',
      '  ; event:"type2"',
      '',
      '2040-01-01=2060-02-02 00:00:01 stuff2 #ffdda1z3',
      '  ; test:"posting"',
      '  asdf\t[Equity.Opening:Balance]\t', // NONE = empty string
      '  ; 2040-01-02',
      '  \tEquity.Opening:Balance\t', // NONE = empty string
      '  ; 2040-01-02=2040-02-03',
      '',
      '2050-01-01 close Asset.Checking.BoA #ffddaaz4',
      '  \tAsset.Checking.BoA\t-0.3333333333 $',
      '  \tEquity.Opening:Balance\t0.3333333333 $',
      '\r\n',
    ].join("\r\n"));
    expect(ledgerCompatOuts.join("")).toBe([
      '2040-01-01 open Asset:Checking:BoA #ffddaazz',
      '  ; test:1',
      '  Equity:Opening.Balance                       -0.3333333 $', // 7 dps
      '  ; asdf',
      '  Asset:Checking:BoA                           0.3333333333 $', // 10 dps
      '  ; !',
      '',
      '2040-01-01=2040-02-05 ! event type stuff #ffddaaz3',
      '  ; tags:"test"',
      '  Asset:Checking:BoA                           -1 $',
      '  ; =2040-02-05 00:00:01',
      '  Asset:Checking:BoA                           1 $',
      '  ; pending:false',
      '  ; event:"type2"',
      '',
      '2040-01-01=2060-02-02 00:00:01 stuff2 #ffdda1z3',
      '  ; test:"posting"',
      '  [Equity:Opening.Balance]                     ', // NONE = empty string
      '  ; asdf',
      '  ; 2040-01-02',
      '  Equity:Opening.Balance                       ', // NONE = empty string
      '  ; 2040-01-02=2040-02-03',
      '',
      '2050-01-01 close Asset:Checking:BoA #ffddaaz4',
      '  Asset:Checking:BoA                           -0.3333333333 $',
      '  Equity:Opening.Balance                       0.3333333333 $',
      '\r\n',
    ].join("\r\n"));
  });
});