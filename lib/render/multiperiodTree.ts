import { Amount } from "../core/accounting/amount.ts";
import { Rational } from "../core/math/rational.ts";
import { isMinDepthHiddenKey, MultiperiodTableKey, MultiperiodTreeItem } from "../core/reports/multiperiodTreeAggregator.ts";
import { AmountDisplayPolicy, AmountSpan } from "./amount.ts";
import { renderable } from "./embeddable.ts";
import { Embeddable, RenderFormat } from "./renderable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";
import { RowOptions, Table } from "./table.ts";

export class MultiperiodTreeRenderer {
  constructor(
    public displayPolicy: AmountDisplayPolicy
  ) {}

  renderBalances(rootItem: MultiperiodTreeItem, table: Table, displayAvg = false): void {
    rootItem.walkChildrenRecursive(node => {
      let rowSum = Amount.ZERO;

      const displayedAmounts = node.displayedAmounts;

      table.addRow([
        new AccountSpan(node.displayedName, node.depth),
        ...displayedAmounts.map(sum => {
          rowSum = rowSum.plus(sum);
          return new AmountSpan(sum, this.displayPolicy);
        }),
        ...(displayAvg ? [new AmountSpan(rowSum.div(new Rational(BigInt(displayedAmounts.length), 1n)), this.displayPolicy)] : [])
      ]);
    });
  }

  renderSum(rootItem: MultiperiodTreeItem | Amount[], table: Table, legendText = "Sum", rowOpts: RowOptions = {}, displayAvg = false): void {

    let rowSum = Amount.ZERO;

    const amounts = (rootItem instanceof MultiperiodTreeItem ? rootItem.displayedAmounts : rootItem);

    table.addRow([
      legendText,
      ...amounts.map(sum => {
        rowSum = rowSum.plus(sum);
        return new AmountSpan(sum, this.displayPolicy);
      }),
      ...(displayAvg ? [new AmountSpan(rowSum.div(new Rational(BigInt(amounts.length), 1n)), this.displayPolicy)] : [])
    ], Object.assign({ topline: true, underline: true, header: true }, rowOpts));
  }

}

export class AccountSpan extends Stylable {
  protected readonly actualTarget: Embeddable;

  constructor(
    public readonly accountDisplayName: MultiperiodTableKey,
    public readonly depth: number,
  ) {
    super(new Span(""));

    if (isMinDepthHiddenKey(accountDisplayName)) {
      this.target = this.actualTarget = new Span("(Upper-level accounts)");

      this.italic(true);
    } else {
      this.target = this.actualTarget = new Span(accountDisplayName);

      this.appendStyle(`text-indent: ${2 * (this.depth - 1)}em`);
    }

    // let actualTarget;
    // if (isMinDepthHiddenKey(accountDisplayName)) {
    //   this.target = this.actualTarget = new Span("(Upper-level accounts)");

    //   this.italic(true);
    // } else {
    //   this.target = this.actualTarget = new Span(accountDisplayName);

    //   this.appendStyle(`text-indent: ${2 * (this.depth - 1)}em`);
    // }
  }

  // only used for ascii so we can safely assume there's space in that span
  override get displayWidth(): number {
    return this.actualTarget.displayWidth + 2 * (this.depth - 1) + 1;
  }

  override render(format: RenderFormat): string {
    if (["csv", "ascii"].includes(format.target)) {
      this.target = renderable` ${"  ".repeat(this.depth - 1)}${this.actualTarget}`;
    }
    return super.render(format);
  }
}