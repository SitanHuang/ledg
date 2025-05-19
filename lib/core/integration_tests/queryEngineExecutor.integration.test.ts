import { describe, expect, it } from 'vitest';
import { Amount } from '../accounting/amount.ts';
import { Posting } from '../accounting/posting.ts';
import { Journal } from '../data/journal.ts';
import { Rational } from '../math/rational.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { QueryEngine } from '../reports/query/queryEngine.ts';
import { QueryPolicy } from '../reports/query/queryPolicy.ts';
import { ReportPolicy } from '../reports/reportPolicy.ts';
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

[QueryPolicy, ReportPolicy].forEach(policyClass => {
  describe.sequential('Integration: QueryEngineExecutor: ' + policyClass.name, () => {
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
        '  \t[Asset.Checking.BoA]\t -[2 USD] / 3',
        '  \t[Equity.OpeningBalance]\t[1 EUR] / 3',
        '  ; testDat: "5555"',
      ];
      expect(await parseSrc(src, journal)).toBe(Ok);

      expect(journal.transactionStore.size()).toEqual(4);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("ast..boa")
        .withFrom(Date.parse('2040-01-01 00:00:00Z'))
        .withTo(Date.parse('2040-01-01 00:00:02Z'))
        .withUseDate('date2'))).toFractionString()).toEqual("1 / 3 USD");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("ast..boa")
        .withFrom(-Infinity)
        .withTo(Infinity)
        .withUseDate('date').copy())).isStrictlyZero()).toBe(true);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("et.obal")
        .withFrom(-Infinity).copy()
        .withTo(Infinity)
        .withUseDate('date')))
        .minus(Amount.create([
          { currency: journal.currencyProvider.getOrCreateCurrencyById("CNY"), value: new Rational(-2n, 1n) },
          { currency: journal.currencyProvider.getOrCreateCurrencyById("EUR"), value: new Rational(1n, 3n) },
        ])).isStrictlyZero()).toBe(true);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("ast..boa").copy()
        .withFrom(Date.parse('2040-01-01 00:00:00Z'))
        .withTo(Date.parse('2040-01-01 00:00:02Z'))
        .withUseDate('date'))).toFractionString()).toEqual("2 / 3 USD");

      expect(sumQuery(journal, QueryEngine.create(new policyClass().copy()
        .withAccount("ast..boa")
        .withFrom(Date.parse('2040-01-01 00:00:00Z'))
        .withTo(Date.parse('2040-01-01 00:00:04Z'))
        .withUseDate('date2'))).toFractionString()).toEqual("");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("*obal")
        .withFrom(Date.parse('2040-01-01 00:00:00Z')).copy()
        .withTo(Date.parse('2040-01-01 00:00:02Z'))
        .withUseDate('date'))).toFractionString()).toEqual("-2 / 1 CNY");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("*obal").copy())).toFractionString()).toEqual("-2 / 1 CNY, 1 / 3 EUR");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withAccount("*obal")
        .withModifier("id", /abcdefgh/).copy())).toFractionString()).toEqual("1 / 3 EUR");

      expect(sumQuery(journal, QueryEngine.create(new policyClass())).toFractionString()).toEqual("-2 / 1 CNY, 1 / 3 EUR");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("description", /^MyTransaction$/).copy()))
        .minus(Amount.create([
          { currency: journal.currencyProvider.getOrCreateCurrencyById("CNY"), value: new Rational(-1n, 1n) },
          { currency: journal.currencyProvider.getOrCreateCurrencyById("USD"), value: new Rational(1n, 3n) },
        ])).isStrictlyZero()).toBe(true);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("description", /^MyPosting$/)))
        .minus(Amount.create([
          { currency: journal.currencyProvider.getOrCreateCurrencyById("CNY"), value: new Rational(-1n, 1n) },
          { currency: journal.currencyProvider.getOrCreateCurrencyById("USD"), value: new Rational(1n, 3n) },
        ])).isStrictlyZero()).toBe(false);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("description", false).copy())).isStrictlyZero()).toBe(true);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("id", false))).isStrictlyZero()).toBe(true);

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("description", /^MyPosting$/))).toFractionString()).toBe("-1 / 1 CNY");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("testDat", /^fdsa$/))).toFractionString()).toEqual("-2 / 3 USD");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("testDat", /^5555$/))).toFractionString()).toEqual("1 / 3 EUR");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("testDat", /^5555$/)
        .withRealOnly(false))).toFractionString()).toEqual("1 / 3 EUR");

      expect(sumQuery(journal, QueryEngine.create(new policyClass()
        .withModifier("testDat", /^5555$/).copy()
        .withRealOnly(true).copy())).toFractionString()).toEqual("");
    });

    it('sums only real postings when realOnly is true', async () => {
      const realJournal = Journal.create();
      const realSrc = [
        '2040-01-01 open Equity.Test',
        '2040-01-01 open Asset.Test',
        '2040-01-01 open devnull',
        '2040-01-01 "Real and Virtual"',
        '  \tEquity.Test\t10 USD',
        '  \t[Asset.Test]\t-10 CNY',
        '  \tdevnull\t-10 USD',
        '  \t[devnull]\t10 CNY',
      ];
      await parseSrc(realSrc, realJournal);

      const sumReal = sumQuery(realJournal, QueryEngine.create(new policyClass()
        .withAccount("*Test")
        .withRealOnly(true).copy()));
      expect(sumReal.toFractionString()).toBe("10 / 1 USD");

      const sumAll = sumQuery(realJournal, QueryEngine.create(new policyClass()
        .withAccount("*Test")
        .withRealOnly(false).copy()));
      expect(
        ["10 / 1 USD, -10 / 1 CNY", "-10 / 1 CNY, 10 / 1 USD"].includes(sumAll.toFractionString())
      ).toBe(true);
    });

    it('sums cleared postings when clearedOnly is true', async () => {
      const clearedJournal = Journal.create();
      const clearedSrc = [
        '2040-01-01 open Equity.Test',
        '2040-01-01 open Asset.Test',
        '2040-01-01 "Cleared Transaction"',
        '  \tEquity.Test\t10 CNY',
        '  \tAsset.Test\t-10 CNY',
        '2040-01-02 ! "Uncleared Transaction"',
        '  \tEquity.Test\t5 USD',
        '  \tAsset.Test\t-5 USD',
      ];
      await parseSrc(clearedSrc, clearedJournal);

      const sumCleared = sumQuery(clearedJournal, QueryEngine.create(new policyClass()
        .withAccount("Asset.Test")
        .withClearedOnly(true).copy()));
      expect(sumCleared.toFractionString()).toBe("-10 / 1 CNY");
      const sumAll = sumQuery(clearedJournal, QueryEngine.create(new policyClass()
        .withAccount("Asset.Test")
        .withClearedOnly(false).copy()));
      expect(
        ["-5 / 1 USD, -10 / 1 CNY", "-10 / 1 CNY, -5 / 1 USD"].includes(sumAll.toFractionString())
      ).toBe(true);
    });

    it('sums pending postings when pendingOnly is true', async () => {
      const pendingJournal = Journal.create();
      const pendingSrc = [
        '2040-01-01 open Equity.Test',
        '2040-01-01 open Asset.Test',
        '2040-01-01 ! "Pending Transaction"',
        '  \tEquity.Test\t5 USD',
        '  \tAsset.Test\t-5 USD',
        '2040-01-02 "Normal Transaction"',
        '  \tEquity.Test\t10 CNY',
        '  \tAsset.Test\t-10 CNY',
      ];
      await parseSrc(pendingSrc, pendingJournal);

      const sumPending = sumQuery(pendingJournal, QueryEngine.create(new policyClass()
        .withAccount("Asset.Test")
        .withPendingOnly(true).copy()));
      expect(sumPending.toFractionString()).toBe("-5 / 1 USD");
    });
  });
})