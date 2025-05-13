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
  return new MultiperiodTreeAggregator(journal, QueryEngine.create(reportPolicy).compile(), reportPolicy).execute().debugCSV(dp);
}

describe.sequential('Integration: MultiperiodTreeAggregator', () => {
  let journal: Journal;

  describe('Set 1', () => {
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("r"))
          .withValutionStrategy("txnDate")
        , 10
      )).toMatch([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","0.9009009009 r","0.0 r"',
        '"income.z","1","-0.9009009009 r","0.0 r"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("$"))
          .withValutionStrategy("txnDate")
        , 10
      )).toMatch([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","0.0 $","6.66 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("$"))
          .withValutionStrategy("txnDate")
          .withUseDate("date2")
        , 10
      )).toMatch([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-07-01T00:00:00.000Z","2021-07-01T00:00:00.000Z => 2022-01-01T00:00:00.000Z"',
        '"expense.c","1","6.66 $","0.0 $"',
      ].join("\n"));

      expect(getCSV(
        journal,
        new ReportPolicy()
          .withReportFrom(Date.parse('2021-01-01Z'))
          .withReportTo(Date.parse("2022-01-01Z"))
          .withAccount("!expense.c")
          .withReportPeriodInterval(0, 6, 0)
          .withHideZero(true)
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("$"))
          .withValutionStrategy(Date.parse('2021-01-01Z'))
          .withUseDate("date2")
        , 10
      )).toMatch([
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
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("r"))
          .withValutionStrategy(Date.parse('3000-01-01Z'))
        , 1
      )).toMatch([
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
          .withValutionCurrency(journal.currencyProvider.getOrCreateCurrencyById("$"))
          .withValutionStrategy(Date.parse('2020-01-01Z'))
          .withUseDate("date2")
        , 10
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      ).toMatch(expected);

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
      ).toMatch(expected);

      // minDepth = 2 (still identical)
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
      ).toMatch(expected);
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
      )).toMatch([
        '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
        '"expense.a","1","1.0 $","1.4011111 $"',
        '"income.b","1","","-1.0 $"',
        '"income.z","1","-1.0 $","-0.5011111 $"',
        '"income.z.a","1","","-0.0011111 $"',
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
      )).toMatch([
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
      )).toMatch([
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
      )).toMatch([
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
      ).toMatch(
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
      ).toMatch(
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
      ).toMatch(
        [
          '"Account","Depth","2021-01-01T00:00:00.000Z => 2021-02-01T00:00:00.000Z","2021-02-01T00:00:00.000Z => 2021-03-01T00:00:00.000Z"',
          '"expense.a","1","1.0 $","1.4011111 $"',
          '"income.b","1","","-1.0 $"',
          '"income.z","1","-1.0 $","-0.5011111 $"',
          '"income.z.a","1","","-0.0011111 $"',
        ].join('\n'),
      );
    });
  });
});