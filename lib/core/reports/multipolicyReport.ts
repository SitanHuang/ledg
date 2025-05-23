import { Amount } from "../accounting/amount.ts";
import { Journal } from "../data/journal.ts";
import { hasResult, Result } from "../types.ts";
import { MultiperiodTreeAggregator } from "./multiperiodTreeAggregator.ts";
import { QueryEngine } from "./query/queryEngine.ts";
import { QueryEngineExecutor } from "./query/queryEngineExecutor.ts";
import { Period, ReportPolicy } from "./reportPolicy.ts";

export class MultipolicyReport {
  protected readonly periods: readonly Period[];
  public readonly rootPolicy: ReportPolicy;
  public readonly originalPolicies: readonly ReportPolicy[];
  public readonly childPolicies: readonly ReportPolicy[];

  public readonly childExecutors: readonly QueryEngineExecutor[];

  constructor(
    public readonly journal: Journal,
    rootPolicy: Readonly<ReportPolicy>,
    childPolicies: readonly Readonly<ReportPolicy>[],
  ) {
    this.periods = rootPolicy.periods();

    this.rootPolicy = rootPolicy.copy();
    this.originalPolicies = childPolicies;
    this.childPolicies = childPolicies.map(x =>{
      const child = x.copy();

      child.reportFrom = this.rootPolicy.reportFrom;
      child.reportTo = this.rootPolicy.reportTo;
      child.reportPeriodInterval = this.rootPolicy.reportPeriodInterval;

      // optimize away the things we don't need
      child.tree = false;
      child.sumParent = false;
      child.minDepth = 0;
      child.maxDepth = Infinity;
      child.hideZero = false;

      return child;
    });

    this.childExecutors = this.childPolicies.map(childPolicy =>
      QueryEngine.and(
        this.rootPolicy,
        childPolicy
      )
    );
  }

  execute(): Result<MultipolicyReportResult> {
    const rows = this.periods.length;
    const cols = this.childPolicies.length;

    const table: Amount[][] = Array.from({ length: rows }, () =>
      Array<Amount>(cols)
    );

    for (let col = 0; col < cols; col++) {
      const rootCopy = this.rootPolicy.copy();
      const policy = this.childPolicies[col];
      const executor = this.childExecutors[col];

      const aggr = new MultiperiodTreeAggregator(
        this.journal,
        executor,
        Object.assign(rootCopy, policy),
      );

      const res = aggr.execute();
      if (!hasResult(res)) return res;

      const colVector = res.displayedAmounts;
      if (colVector.length !== rows) {
        throw new Error("Aggregator returned wrong number of periods");
      }
      for (let row = 0; row < rows; row++) {
        table[row][col] = colVector[row];
      }
    }


    return new MultipolicyReportResult(
      this.periods,
      this.originalPolicies,
      table,
    );
  }
}

export type AmountTable = readonly (readonly Amount[])[];

export class MultipolicyReportResult {
  /** Row headers (period buckets) */
  readonly periods: readonly Period[];
  /** User-provided policies */
  readonly originalQueries: readonly ReportPolicy[];
  /** periods × queries amounts */
  readonly table: AmountTable;

  // --- constructor is package-private: users only get instances via execute() ---
  constructor(
    periods: readonly Period[],
    queries: readonly ReportPolicy[],
    table: AmountTable,
  ) {
    this.periods = periods;
    this.originalQueries = queries;
    this.table = table;
  }

  at(periodIdx: number, queryIdx: number): Amount {
    return this.table[periodIdx][queryIdx];
  }

  /** Row-major view: iterate periods → queries */
  *byPeriods(): IterableIterator<{
    period: Period;
    amounts: readonly Amount[];
    queries: readonly ReportPolicy[];
  }> {
    for (let i = 0; i < this.periods.length; i++) {
      yield { period: this.periods[i], amounts: this.table[i], queries: this.originalQueries };
    }
  }

  /** Column-major view: iterate queries → periods */
  *byQueries(): IterableIterator<{
    query: ReportPolicy;
    amounts: readonly Amount[]; // length === periods.length
  }> {
    for (let j = 0; j < this.originalQueries.length; j++) {
      const col = this.table.map(row => row[j]);
      yield { query: this.originalQueries[j], amounts: col };
    }
  }
}