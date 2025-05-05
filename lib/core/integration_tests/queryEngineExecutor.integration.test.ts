import { describe, expect, it } from 'vitest';
import { Amount } from '../accounting/amount.ts';
import { Posting } from '../accounting/posting.ts';
import { Journal } from '../data/journal.ts';
import { Rational } from '../math/rational.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { QueryEngine } from '../reports/query/queryEngine.ts';
import { Ok } from '../types.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\r\n"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  const result = await journalReaderAdapter.promisifyAndBegin();
  if (result instanceof Error) {
    throw result;
  }

  return result;
}

function sumQuery(journal: Journal, engine: QueryEngine) {
  let sum = Amount.ZERO;
  engine
    .compile()
    .executePostings(journal, (posting: Posting) => {
      sum = sum.plus(posting.amount);
    });
  return sum;
}

describe.sequential('Integration: QueryEngineExecutor', () => {
  it('works', async () => {
    let journal = Journal.create();
    let src = [
      '2025-01-01 open Equity.OpeningBalance',
      'P 2040-01-01 EUR 2USD',
      'P 2040-01-01 USD 3CNY',
      '2040-01-01 00:00:00 open Asset.Checking.BoA',
      '  ;test:1',
      '  \tEquity.OpeningBalance\tCNY -1',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // BoA=1/3 USD
      '2040-01-01 00:00:01=2040-01-01 00:00:02 MyTransaction',
      '  MyPosting\tEquity.OpeningBalance\tCNY -1',
      '  \tAsset.Checking.BoA\t [1 USD] / 3', // BoA=2/3 USD
      '2040-01-01 00:00:03 close  Asset.Checking.BoA #abcdefgh',
      '  ; testDat: "fdsa"',
      '  \tAsset.Checking.BoA\t -[2 USD] / 3',
      '  \tEquity.OpeningBalance\t[1 EUR] / 3',
      '  ; testDat: "5555"',
    ];
    expect(await parseSrc(src, journal)).toBe(Ok);

    expect(journal.transactionStore.size()).toEqual(4);

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("ast..boa")
      .withFrom(Date.parse('2040-01-01 00:00:00Z'))
      .withTo(Date.parse('2040-01-01 00:00:02Z'))
      .withUseDate('date2')).toFractionString()).toMatch("1 / 3 USD");

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("ast..boa")
      .withFrom(Date.parse('2040-01-01 00:00:00Z'))
      .withTo(Date.parse('2040-01-01 00:00:02Z'))
      .withUseDate('date')).toFractionString()).toMatch("2 / 3 USD");

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("ast..boa")
      .withFrom(Date.parse('2040-01-01 00:00:00Z'))
      .withTo(Date.parse('2040-01-01 00:00:04Z'))
      .withUseDate('date2')).toFractionString()).toMatch("");

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("*obal")
      .withFrom(Date.parse('2040-01-01 00:00:00Z'))
      .withTo(Date.parse('2040-01-01 00:00:02Z'))
      .withUseDate('date')).toFractionString()).toMatch("-2 / 1 CNY");

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("*obal")).toFractionString()).toMatch("");

    expect(sumQuery(journal, QueryEngine.create()
      .withAccount("*obal")
      .withModifier("id", /abcdefgh/)).toFractionString()).toMatch("1 / 3 EUR");

    expect(sumQuery(journal, QueryEngine.create()).toFractionString()).toMatch("");

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("description", /^MyTransaction$/))
      .minus(Amount.create([
        { currency: journal.currencyProvider.getOrCreateCurrencyById("CNY"), value: new Rational(-1n, 1n) },
        { currency: journal.currencyProvider.getOrCreateCurrencyById("USD"), value: new Rational( 1n, 3n) },
      ])).isStrictlyZero()).toBe(true);

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("description", /^MyPosting$/))
      .minus(Amount.create([
        { currency: journal.currencyProvider.getOrCreateCurrencyById("CNY"), value: new Rational(-1n, 1n) },
        { currency: journal.currencyProvider.getOrCreateCurrencyById("USD"), value: new Rational( 1n, 3n) },
      ])).isStrictlyZero()).toBe(false);

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("description", false)).isStrictlyZero()).toBe(true);

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("id", false)).isStrictlyZero()).toBe(true);

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("description", /^MyPosting$/)).toFractionString()).toBe("-1 / 1 CNY");

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("testDat", /^fdsa$/)).toFractionString()).toMatch("-2 / 3 USD");

    expect(sumQuery(journal, QueryEngine.create()
      .withModifier("testDat", /^5555$/)).toFractionString()).toMatch("1 / 3 EUR");
  });
});