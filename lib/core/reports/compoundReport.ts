import { Journal } from "../data/journal.ts";
import { hasResult, Result } from "../types.ts";
import { MultiperiodTreeAggregator, MultiperiodTreeItem } from "./multiperiodTreeAggregator.ts";
import { QueryEngine } from "./query/queryEngine.ts";
import { ReportPolicy } from "./reportPolicy.ts";

export interface CompoundReportMetadata {
  readonly journal: Journal;
  readonly title: string;
  readonly reportPolicy: ReportPolicy;
  readonly subreports: readonly CompoundSubReport[];
  readonly positiveIsGreen: boolean;
}

export class CompoundReport implements CompoundReportMetadata {
  public readonly journal!: Journal;
  public readonly title!: string;
  public readonly reportPolicy!: ReportPolicy;
  public readonly subreports!: readonly CompoundSubReport[];
  public readonly positiveIsGreen!: boolean;

  constructor(opts: CompoundReportMetadata) {
    Object.assign(this, opts);
  }

  execute(): Result<readonly MultiperiodTreeItem[]> {
    const trees: MultiperiodTreeItem[] = [];

    for (const subreport of this.subreports) {
      const result = subreport.execute(this.journal, this.reportPolicy);
      if (!hasResult(result)) {
        return result;
      }

      trees.push(result);
    }
    return trees;
  }
}

export interface CompoundSubReportMetadata {
  readonly title: string;
  readonly account: string;
  readonly invert: boolean;
  readonly positiveIsGreen: boolean;
  readonly netModifier: boolean;
}

export class CompoundSubReport implements CompoundSubReportMetadata {

  public readonly title!: string;
  public readonly account!: string;
  public readonly invert!: boolean;
  public readonly positiveIsGreen!: boolean;
  public readonly netModifier!: boolean;

  constructor(opts: CompoundReportMetadata) {
    Object.assign(this, opts);
  }

  execute(journal: Journal, parentReportPolicy: ReportPolicy): Result<MultiperiodTreeItem> {
    const policy = parentReportPolicy.clone()
      .withAccount(this.account)
      .withInversion(this.invert);

    return new MultiperiodTreeAggregator(
      journal,
      QueryEngine
        .create(policy)
        .compile(),
      policy
    ).execute()
  }
}