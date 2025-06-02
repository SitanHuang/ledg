import { beforeEach, describe, expect, it } from 'vitest';
import { Journal } from '../data/journal.ts';
import { InputStreamJournalReader } from '../parsing/journal/inputStreamJournalReader.ts';
import { Ok } from '../types.ts';
import { getErrorMessages } from '../utils/debugErrorTools.ts';
import { DefaultTransactionPipeline } from '../pipelines/transactionPipeline.ts';
import { JournalReaderAdapter } from '../pipelines/adapters/journalReaderAdapter.ts';
import { QueryEngine } from '../reports/query/queryEngine.ts';
import { MultiperiodTreeAggregator } from '../reports/multiperiodTreeAggregator.ts';
import { ReportPolicy } from '../reports/reportPolicy.ts';

async function parseSrc(src: string[], journal?: Journal) {
  journal = journal ?? Journal.create();

  const journalReader = InputStreamJournalReader.fromString(src.join("\n"));
  const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
  const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);

  return await journalReaderAdapter.promisifyAndBegin();
}

function getCSV(journal: Journal, reportPolicy: ReportPolicy, dp=Infinity) {
  const x = new MultiperiodTreeAggregator(journal, QueryEngine.create(reportPolicy).compile(), reportPolicy);
  x.execute();
  return x.debugCSV(dp);
}

describe.sequential('Integration: MultiperiodTreeAggregator', () => {
  let journal: Journal;

  describe('Set 1: non-cumulative', () => {
    beforeEach(async () => {
      journal = Journal.create();
      let src = [
        '2020-01-01 open dev.null',
        '2020-01-01 open income.a.a',
        '2020-01-01 open income.b',
        '2020-01-01 open income.b.a',
        '2020-01-01 open income.z',
        '2020-01-01 open income.z.a',
        '2020-01-01 open expense.a',
        '2020-01-01 open expense.c',
        '2020-01-01 open asset.cash',
        'P 2021-01-01 R $1.11',
        'P 2021-12-31 R $2.22',
        'P 2022-01-01 R $4.44',
        'P 3000-01-01 R $5.55',
        'P 0000-01-01 r 1R',
        '2021-01-01 asdf',
        '  ;tags:"A2"',
        '  \tincome.z\t-1$',
        '  \texpense.a\t1$',
        '2021-02-01 asdf2',
        '  ;bookClose:true',
        '  ;tags:"A2"',
        '  \tincome.z\t-0.5$',
        '  \tincome.z.a\t-0.0011111$',
        '  \tincome.b\t-1$',
        '  \texpense.a\t1.4011111$',
        '  \tasset.cash\t0.1$',
        '2021-12-31 bar',
        '  ;virt:true',
        '  ;tags:"A1,A2"',
        '  \tincome.a.a\t-1r',
        '  \tincome.b.a\t-2r',
        '  \texpense.c\t3r',
        '  ; =2021-01-01',
        '2022-01-01 close income.a.a',
        '  \tincome.a.a\t1r',
        '  \tdev.null',
        '2022-01-01 close income.b',
        '  \tincome.b\t1$',
        '  \tdev.null',
        '2022-01-01 close income.b.a',
        '  \tincome.b.a\t2r',
        '  \tdev.null',
        '2022-01-01 close income.z',
        '  \tincome.z\t1$',
        '  \tincome.z\t0.5$',
        '  \tdev.null',
        '2022-01-01 close income.z.a',
        '  \tincome.z.a\t0.0011111$',
        '  \tdev.null',
        '2022-01-01 close expense.a',
        '  \texpense.a\t-1$',
        '  \texpense.a\t-1.4011111$',
        '  \tdev.null',
      ];
      expect(await parseSrc(src, journal)).toBe(Ok);
    })

    // Below tests are inspired by v1.0 `test/commands/incomestatement.js`

    it('should populate all open accounts in period', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2019-01-01Z'))
          .withReportTo(Date.parse("2020-01-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 6, 0)
      )).toEqual([
        '"Account","Depth","2019-01-01T00:00:00.000Z => 2019-07-01T00:00:00.000Z","2019-07-01T00:00:00.000Z => 2020-01-01T00:00:00.000Z"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2022-01-01Z'))
          .withReportTo(Date.parse("2023-01-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 6, 0)
        , 10
      )).toEqual([
        '"Account","Depth","2022-01-01T00:00:00.000Z => 2022-07-01T00:00:00.000Z","2022-07-01T00:00:00.000Z => 2023-01-01T00:00:00.000Z"',
        '"expense.a","1","-2.4011111 $",""',
        '"expense.c","1","",""',
        '"income.a.a","1","1.0 r",""',
        '"income.b","1","1.0 $",""',
        '"income.b.a","1","2.0 r",""',
        '"income.z","1","1.5 $",""',
        '"income.z.a","1","0.0011111 $",""',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2022-01-01T00:00:00.001Z'))
          .withReportTo(Date.parse("2023-01-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 6, 0)
        , 10
      )).toEqual([
        '"Account","Depth","2022-01-01T00:00:00.001Z => 2022-07-01T00:00:00.001Z","2022-07-01T00:00:00.001Z => 2023-01-01T00:00:00.000Z"',
        '"expense.c","1","",""',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2019-01-01T00:00:01Z'))
          .withReportTo(Date.parse("2020-01-01T00:00:01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 6, 0)
      )).toEqual([
        '"Account","Depth","2019-01-01T00:00:01.000Z => 2019-07-01T00:00:01.000Z","2019-07-01T00:00:01.000Z => 2020-01-01T00:00:01.000Z"',
        '"expense.a","1","",""',
        '"expense.c","1","",""',
        '"income.a.a","1","",""',
        '"income.b","1","",""',
        '"income.b.a","1","",""',
        '"income.z","1","",""',
        '"income.z.a","1","",""',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2019-01-01T00:00:01Z'))
          .withReportTo(Date.parse("2029-01-01T00:00:01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 0, 10)
        , 10
      )).toEqual([
        '"Account","Depth","2019-01-01T00:00:01.000Z => 2029-01-01T00:00:01.000Z"',
        '"expense.a","1",""',
        '"expense.c","1","3.0 r"',
        '"income.a.a","1",""',
        '"income.b","1",""',
        '"income.b.a","1",""',
        '"income.z","1",""',
        '"income.z.a","1",""',
      ].join("\n"));
    });

    it('should convert currency at date of entry, regardless of date/date2', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withModifier("bookClose", /^(?!true)/)
          .withHideZero(true)
          .withValuationCurrencyId("r")
          .withValuationStrategy("txnDate")
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","0.9009009009 r",""',
        '"income.z","1","-0.9009009009 r",""',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValuationCurrencyId("$")
          .withValuationStrategy("txnDate")
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","","6.66 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValuationCurrencyId("$")
          .withValuationStrategy("txnDate")
          .withUseDate("date2")
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","6.66 $",""',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValuationCurrencyId("$")
          .withValuationStrategy(Date.parse('2021-01-01Z'))
          .withUseDate("date2")
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","3.33 $","0.0 $"',
      ].join("\n"));
    });

    it('should convert currency at valuation date', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withModifier("bookClose", /^(?!true)/)
          .withHideZero(true)
          .withValuationCurrencyId("r")
          .withValuationStrategy(Date.parse('3000-01-01Z'))
        , 1
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","0.2 r","0.0 r"',
        '"income.z","1","-0.2 r","0.0 r"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValuationCurrencyId("$")
          .withValuationStrategy(Date.parse('2020-01-01Z'))
          .withUseDate("date2")
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","3.0 r","0.0 $"',
      ].join("\n"));
    });

    it('should implement max depth', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(2)
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","1 $","1 $"',
        '"income.b","1","","-1 $"',
        '"income.z","1","-1 $","-1 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(1)
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1 $","1 $"',
        '"income","1","-1 $","-2 $"',
      ].join("\n"));
    });

    it('should implement max depth and sum parent', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(1)
          .withSumParent(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1 $","1 $"',
        '"income","1","-1 $","-2 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(2)
          .withSumParent(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1 $","1 $"',
        '"expense.a","1","1 $","1 $"',
        '"income","1","-1 $","-2 $"',
        '"income.b","1","","-1 $"',
        '"income.z","1","-1 $","-1 $"',
      ].join("\n"));
    });

    it('should implement min depth', async () => {
      const expected = [
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","1.0 $","1.4011111 $"',
        '"income.b","1","","-1.0 $"',
        '"income.z","1","-1.0 $","-0.5 $"',
        '"income.z.a","1","","-0.0011111 $"',
      ].join("\n");

      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true),
          10,
        ),
      ).toEqual(expected);

      // minDepth = 1 (no sumParent / tree, so should be identical)
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withMinDepth(1),
          10,
        ),
      ).toEqual(expected);

      // minDepth = 2
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withMinDepth(2),
          10,
        ),
      ).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","1.0 $","1.4011111 $"',
        '"b","1","","-1.0 $"',
        '"z","1","-1.0 $","-0.5 $"',
        '"z.a","1","","-0.0011111 $"',
      ].join("\n"));

      // minDepth = 3
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withMinDepth(3),
          10,
        ),
      ).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","","-0.0011111 $"',
        '"Symbol((Upper-level accounts))","1","","-0.0988889 $"',
      ].join("\n"));
    });

    it('should respect minDepth with sumParent=true', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMinDepth(2)
          .withSumParent(true)
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","1.0 $","1.4011111 $"',
        '"b","1","","-1.0 $"',
        '"z","1","-1.0 $","-0.5011111 $"',
        '"z.a","1","","-0.0011111 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withSumParent(true)
          .withMinDepth(1)
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1.0 $","1.4011111 $"',
        '"expense.a","1","1.0 $","1.4011111 $"',
        '"income","1","-1.0 $","-1.5011111 $"',
        '"income.b","1","","-1.0 $"',
        '"income.z","1","-1.0 $","-0.5011111 $"',
        '"income.z.a","1","","-0.0011111 $"',
      ].join("\n"));
    });

    it('should produce same result when minDepth=1 & maxDepth=1 versus sumParent=true', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withSumParent(true)
          .withMinDepth(1)
          .withMaxDepth(1)
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1.0 $","1.4011111 $"',
        '"income","1","-1.0 $","-1.5011111 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withSumParent(false)
          .withMinDepth(1)
          .withMaxDepth(1)
        , 10
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1.0 $","1.4011111 $"',
        '"income","1","-1.0 $","-1.5011111 $"',
      ].join("\n"));
    });

    it('should aggregate correctly with sumParent only (minDepth = 0, maxDepth = ∞)', async () => {
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withSumParent(true),
          10,
        ),
      ).toEqual(
        [
          '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
          '"expense","1","1.0 $","1.4011111 $"',
          '"expense.a","1","1.0 $","1.4011111 $"',
          '"income","1","-1.0 $","-1.5011111 $"',
          '"income.b","1","","-1.0 $"',
          '"income.z","1","-1.0 $","-0.5011111 $"',
          '"income.z.a","1","","-0.0011111 $"',
        ].join('\n'),
      );
    });

    it('should respect minDepth = 1 and maxDepth = 2 with sumParent = true', async () => {
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withSumParent(true)
            .withMinDepth(1)
            .withMaxDepth(2),
          10,
        ),
      ).toEqual(
        [
          '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
          '"expense","1","1.0 $","1.4011111 $"',
          '"expense.a","1","1.0 $","1.4011111 $"',
          '"income","1","-1.0 $","-1.5011111 $"',
          '"income.b","1","","-1.0 $"',
          '"income.z","1","-1.0 $","-0.5011111 $"',
        ].join('\n'),
      );
    });

    it('should respect minDepth = 2 and maxDepth = 3 with sumParent = true', async () => {
      expect(
        getCSV(
          journal,
          new ReportPolicy()
            .withReportFrom(Date.parse('2021-01-01Z'))
            .withReportTo(Date.parse('2021-03-01Z'))
            .withAccount('\\v^income|expense')
            .withReportPeriodInterval(0, 1, 0)
            .withHideZero(true)
            .withSumParent(true)
            .withMinDepth(2)
            .withMaxDepth(3),
          10,
        ),
      ).toEqual(
        [
          '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
          '"a","1","1.0 $","1.4011111 $"',
          '"b","1","","-1.0 $"',
          '"z","1","-1.0 $","-0.5011111 $"',
          '"z.a","1","","-0.0011111 $"',
        ].join('\n'),
      );
    });

    it('should implement sort', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(2)
          .withSortStrategy("desc")
          .withInversion(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"income.z","1","1 $","1 $"',
        '"income.b","1","","1 $"',
        '"expense.a","1","-1 $","-1 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(2)
          .withSortStrategy("asc")
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"income.z","1","-1 $","-1 $"',
        '"income.b","1","","-1 $"',
        '"expense.a","1","1 $","1 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withMaxDepth(2)
          .withSortStrategy("accountId")
        , 0
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","1 $","1 $"',
        '"income.b","1","","-1 $"',
        '"income.z","1","-1 $","-1 $"',
      ].join("\n"));
    })
  });

  describe('Set 2: cumulative', () => {
    beforeEach(async () => {
      journal = Journal.create();
      let src = [
        "2021-01-01 open asset.cash",
        "2021-01-01 open liability.cc",
        "P 2021-01-01 R $1",
        "P 2021-01-02 R $2",
        "P 2021-02-01 R $3",
        "2021-01-01 2",
        "  ;bookClose:true",
        "  \tasset.cash\t1R",
        "  \tliability.cc\t-1$",
        "2021-01-01",
        "  \tasset.cash\t1R",
        "  \tliability.cc\t-1R",
      ];
      expect(await parseSrc(src, journal)).toBe(Ok);
    })

    // Below tests are inspired by v1.0 `test/commands/balancesheet.js`

    it('should bring up historical balance', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2022-01-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withReportPeriodInterval(0, 1, 0)
          .withModifier('bookClose', /^(?!true)/)
          .withCumulative(true)
        , 1
      )).toEqual([
        '"Account","Depth","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"asset.cash","1","1.0 R"',
        '"liability.cc","1","-1.0 R"',
      ].join("\n"));
    });

    it('should convert currency at date of entry', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2022-01-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withReportPeriodInterval(0, 1, 0)
          .withModifier('bookClose', /^(?!true)/)
          .withValuationCurrencyId("$")
          .withCumulative(true)
        , 1
      )).toEqual([
        '"Account","Depth","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"asset.cash","1","1.0 $"',
        '"liability.cc","1","-1.0 $"',
      ].join("\n"));
    });

    it('should convert currency at some valuation date', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2022-01-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withReportPeriodInterval(0, 1, 0)
          .withModifier('bookClose', /^(?!true)/)
          .withValuationCurrencyId("$")
          .withValuationStrategy(Date.parse("2021-01-02Z"))
          .withCumulative(true)
        , 1
      )).toEqual([
        '"Account","Depth","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"asset.cash","1","2.0 $"',
        '"liability.cc","1","-2.0 $"',
      ].join("\n"));
    });

    it('should convert currency at end of period', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withReportPeriodInterval(0, 1, 0)
          .withModifier('bookClose', /^(?!true)/)
          .withValuationCurrencyId("$")
          .withValuationStrategy("eop")
          .withCumulative(true)
        , 1
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"asset.cash","1","2.0 $","3.0 $"',
        '"liability.cc","1","-2.0 $","-3.0 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withReportPeriodInterval(0, 1, 0)
          .withModifier('description', /2/)
          .withValuationCurrencyId("$")
          .withValuationStrategy("eop")
          .withCumulative(true)
        , 1
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"asset.cash","1","2.0 $","3.0 $"',
        '"liability.cc","1","-1.0 $","-1.0 $"',
      ].join("\n"));
    });
  });

  describe('Set 2: tree', () => {
    beforeEach(async () => {
      journal = Journal.create();
      let src = [
        '2020-01-01 open dev.null',
        '2020-01-01 open income.a.a',
        '2020-01-01 open income.b',
        '2020-01-01 open income.b.a',
        '2020-01-01 open income.z',
        '2020-01-01 open income.z.a',
        '2020-01-01 open expense.a',
        '2020-01-01 open expense.c',
        '2020-01-01 open asset.cash',
        'P 2021-01-01 R $1.11',
        'P 2021-12-31 R $2.22',
        'P 2022-01-01 R $4.44',
        'P 3000-01-01 R $5.55',
        'P 0000-01-01 r 1R',
        '2021-01-01 asdf',
        '  ;tags:"A2"',
        '  \tincome.z\t-1$',
        '  \texpense.a\t1$',
        '2021-02-01 asdf2',
        '  ;bookClose:true',
        '  ;tags:"A2"',
        '  \tincome.z\t-0.5$',
        '  \tincome.z.a\t-0.0011111$',
        '  \tincome.b\t-1$',
        '  \texpense.a\t1.4011111$',
        '  \tasset.cash\t0.1$',
        '2021-12-31 bar',
        '  ;virt:true',
        '  ;tags:"A1,A2"',
        '  \tincome.a.a\t-1r',
        '  \tincome.b.a\t-2r',
        '  \texpense.c\t3r',
      ];
      expect(await parseSrc(src, journal)).toBe(Ok);
    })

    // Below tests are inspired by v1.0 `test/commands/incomestatement.js`

    it('should not fail', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","",""',
        '"a","2","1.0 $","1.4 $"',
        '"income","1","",""',
        '"b","2","","-1.0 $"',
        '"z","2","-1.0 $","-0.5 $"',
        '"a","3","","0.0 $"',
      ].join("\n"));
    });

    it('should implement min-depth', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withMinDepth(2)
          .withMaxDepth(11)
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","1.0 $","1.4 $"',
        '"b","1","","-1.0 $"',
        '"z","1","-1.0 $","-0.5 $"',
        '"a","2","","0.0 $"',
      ].join("\n"));
    });

    it('should implement min-depth and max-depth', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withMinDepth(2)
          .withMaxDepth(2)
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","1.0 $","1.4 $"',
        '"b","1","","-1.0 $"',
        '"z","1","-1.0 $","-0.5 $"',
      ].join("\n"));
    });

    it('should implement min-depth and sum parent', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSumParent(true)
          .withMinDepth(2)
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"a","1","1.0 $","1.4 $"',
        '"b","1","","-1.0 $"',
        '"z","1","-1.0 $","-0.5 $"',
        '"a","2","","0.0 $"',
      ].join("\n"));
    });

    it('should sum parent', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSumParent(true)
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense","1","1.0 $","1.4 $"',
        '"a","2","1.0 $","1.4 $"',
        '"income","1","-1.0 $","-1.5 $"',
        '"b","2","","-1.0 $"',
        '"z","2","-1.0 $","-0.5 $"',
        '"a","3","","0.0 $"',
      ].join("\n"));
    });

    it('should sort', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2021-03-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSortStrategy("asc")
        , 2
      )).toEqual([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"income","1","",""',
        '"z","2","-1.0 $","-0.5 $"',
        '"a","3","","0.0 $"',
        '"b","2","","-1.0 $"',
        '"expense","1","",""',
        '"a","2","1.0 $","1.4 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-12-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSortStrategy("desc")
          .withInversion(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-12-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"income","1","",""',
        '"b","2","",""',
        '"a","3","2 r",""',
        '"a","2","",""',
        '"a","3","1 r",""',
        '"expense","1","",""',
        '"c","2","-3 r",""',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-12-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSortStrategy("desc")
        , 0
      )).toEqual([
        '"Account","Depth","2021-12-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"expense","1","",""',
        '"c","2","3 r",""',
        '"income","1","",""',
        '"a","2","",""',
        '"a","3","-1 r",""',
        '"b","2","",""',
        '"a","3","-2 r",""',
      ].join("\n"));
    });

    it('should sort and sum parent', async () => {
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-12-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSortStrategy("desc")
          .withInversion(true)
          .withSumParent(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-12-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"income","1","3 r",""',
        '"b","2","2 r",""',
        '"a","3","2 r",""',
        '"a","2","1 r",""',
        '"a","3","1 r",""',
        '"expense","1","-3 r",""',
        '"c","2","-3 r",""',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-12-01Z'))
          .withReportTo(Date.parse("2022-02-01Z"))
          .withAccount("\\v^income|expense")
          .withReportPeriodInterval(0, 1, 0)
          .withHideZero(true)
          .withTree(true)
          .withSortStrategy("asc")
          .withInversion(true)
          .withSumParent(true)
        , 0
      )).toEqual([
        '"Account","Depth","2021-12-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z","2022-01-01T00:00:00.000Z => 2022-02-01T00:00:00.000Z"',
        '"expense","1","-3 r",""',
        '"c","2","-3 r",""',
        '"income","1","3 r",""',
        '"a","2","1 r",""',
        '"a","3","1 r",""',
        '"b","2","2 r",""',
        '"a","3","2 r",""',
      ].join("\n"));
    });
  });

  describe('Targeted bugs', () => {
    it('avoids double counting sum parent logics on inverted account opening order', async () => {
      journal = Journal.create();
      let src = [
        '2020-01-01 open dev.null',
        '2020-01-01 open Expense.Free.Retail.Fitness.b',
        '2020-01-01 open Expense.Free.Retail.Fitness.Cycling',
        '2020-01-01 open Expense.Free.Retail.Fitness.a',
        '2020-01-01 open Expense.Free.Retail.Fitness.Cycling.a',
        '2020-01-01 open Expense.Free.Retail.Fitness.d',
        '2020-01-01 open Expense.Free.Retail',
        '2020-01-01 open income.b.a',
        '2020-01-01 open income.b.a.d',
        '2022-04-06',
        '  \tExpense.Free.Retail.Fitness.Cycling\t1$',
        '  \tdev.null',
        '2023-05-24',
        '  \tExpense.Free.Retail\t741$',
        '  \tExpense.Free.Retail\t-741$',
        '  \tExpense.Free.Retail.Fitness.d\t0$',
        '  \tdev.null',
      ];
      expect(await parseSrc(src, journal)).toBe(Ok);

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Expense.Free.Retail.Fitness.Cycling","1","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Expense","1","1 $"',
        '"Expense.Free","1","1 $"',
        '"Expense.Free.Retail","1","1 $"',
        '"Expense.Free.Retail.Fitness","1","1 $"',
        '"Expense.Free.Retail.Fitness.Cycling","1","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withMinDepth(2)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Free","1","1 $"',
        '"Free.Retail","1","1 $"',
        '"Free.Retail.Fitness","1","1 $"',
        '"Free.Retail.Fitness.Cycling","1","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withMinDepth(2)
          .withMaxDepth(3)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Free","1","1 $"',
        '"Free.Retail","1","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withMinDepth(5)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Cycling","1","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withTree(true)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Expense","1","1 $"',
        '"Free","2","1 $"',
        '"Retail","3","1 $"',
        '"Fitness","4","1 $"',
        '"Cycling","5","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withTree(true)
          .withMinDepth(2)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Free","1","1 $"',
        '"Retail","2","1 $"',
        '"Fitness","3","1 $"',
        '"Cycling","4","1 $"',
      ].join("\n"));
      expect(getCSV(
        journal,
        new ReportPolicy()
          .withAccount("..{retail}*")
          .withHideZero(true)
          .withSumParent(true)
          .withTree(true)
          .withMinDepth(2)
          .withMaxDepth(2)
        , 0
      )).toEqual([
        '"Account","Depth","-inf => inf"',
        '"Free","1","1 $"',
      ].join("\n"));
    });
  });
});