import { CompoundReport } from "../core/reports/compoundReport.ts";
import { DateFormat } from "../core/reports/dateFormat.ts";
import { MultiperiodTableBuckets, MultiperiodTreeItem } from "../core/reports/multiperiodTreeAggregator.ts";
import { AmountDisplayPolicy } from "./amount.ts";
import { JoinedEmbeddable, renderable } from "./embeddable.ts";
import { MultiperiodTreeRenderer } from "./multiperiodTree.ts";
import { Renderable } from "./renderable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";
import { Table, TextJustify } from "./table.ts";

export class CompoundTreeRenderer {
  constructor(
    public report: CompoundReport,
    public displayPolicy: AmountDisplayPolicy,
    public dateFormat: DateFormat,
  ) {}

  render(results: readonly MultiperiodTreeItem[]): Renderable {
    const { report, displayPolicy, dateFormat } = this;
    const { reportPolicy, subreports } = report;
    const { reportFrom, reportTo } = reportPolicy;

    const builder = JoinedEmbeddable.join([]);

    const periods = reportPolicy.periods();
    const fromDate = periods?.at(0)?.from ?? reportFrom;
    const toDate = periods?.at(-1)?.to ?? reportTo;

    builder.append(
      new Stylable(
        renderable`${new Stylable(new Span(report.title)).bold(true)} ${fromDate ? dateFormat.formatDate(fromDate) : ''} to ${toDate ? dateFormat.formatDate(toDate) : ''}`
      ).htmlTag('h3')
    );
    builder.append(new Span("\n\n"));

    const table = this.makeTable();

    builder.append(table);

    const treeRenderer = new MultiperiodTreeRenderer(displayPolicy);

    const grandTotal = new MultiperiodTableBuckets(periods, reportPolicy);

    for (let i = 0; i < subreports.length; i++) {
      const subreport = subreports[i];
      const subreportTree = results[i];

      table.addRow([subreport.title], { header: true });

      treeRenderer.displayPolicy = displayPolicy.naiveCopy();
      treeRenderer.displayPolicy.positiveIsGreen = subreport.positiveIsGreen;

      treeRenderer.renderBalances(subreportTree, table);
      treeRenderer.renderSum(subreportTree, table, "", { header: false, boldline: false, topline: true, underline: true });

      grandTotal.addBucketsFrom(
        subreportTree.displayedAmounts,
        subreport.netMultiplier,
      );
    }

    treeRenderer.displayPolicy = displayPolicy.naiveCopy();
    treeRenderer.displayPolicy.positiveIsGreen = report.positiveIsGreen;

    treeRenderer.renderSum(grandTotal.buckets, table, "  Net", { header: true, topline: true });

    return builder;
  }

  makeTable(): Table {
    const justify: TextJustify[] = ["left"];

    const titleRow = [""];

    for (const period of this.report.reportPolicy.periods()) {
      justify.push("right");
      titleRow.push(this.dateFormat.formatDate(period.to ?? Infinity));
    }

    return new Table({ justify }).addRow(titleRow, { header: true });
  }
}