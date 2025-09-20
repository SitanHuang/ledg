import { Amount } from "../core/accounting/amount.ts";
import { Rational } from "../core/math/rational.ts";
import { isMinDepthHiddenKey, MultiperiodTableKey, MultiperiodTreeItem } from "../core/reports/multiperiodTreeAggregator.ts";
import { Maybe, Ok } from "../core/types.ts";
import { Currency } from "../core/valuation/currency.ts";
import { AmountDisplayPolicy, AmountSpan, PercentAmountSpan } from "./amount.ts";
import { renderable } from "./embeddable.ts";
import { Embeddable, RenderFormat } from "./renderable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";
import { RowOptions, Table } from "./table.ts";

export class MultiperiodReportError extends Error {
  protected readonly __MultiperiodReportErrorBrand = undefined;
}

export class MultiperiodTreeRenderer {
  static readonly PERCENT = new Currency("%");

  constructor(
    public displayPolicy: AmountDisplayPolicy
  ) {}

  renderBalances(rootItem: MultiperiodTreeItem, table: Table, displayAvg = false, displayPerc = false): Maybe<MultiperiodReportError> {
    const displayPolicy = this.displayPolicy.naiveCopy();

    if (displayPerc) {
      const copy = displayPolicy.getPolicy(MultiperiodTreeRenderer.PERCENT).naiveCopy();
      copy.currencyCodeLocation = 'none'; // hide currency so we can manually add and color the "%" in AmountSpan
      displayPolicy.overrideCurrency(MultiperiodTreeRenderer.PERCENT, copy);
    }

    try {
      rootItem.walkChildrenRecursive(node => {
        let rowSum = Amount.ZERO;

        const displayedAmounts = node.displayedAmounts;
        const colSumAmounts = rootItem.displayedAmounts;

        table.addRow([
          new AccountSpan(node.displayedName, node.depth),
          ...displayedAmounts.map((sum, colIndex) => {
            if (displayPerc) {
              const colSum = colSumAmounts[colIndex];
              const colSumEntries = colSum.getEntries();
              const entries = sum.getEntries();

              if (sum.isStrictlyZero() || colSum.isStrictlyZero() || colSumEntries[0]?.value.isZero()) {
                return new AmountSpan(Amount.ZERO, displayPolicy);
              }


              if (entries.length !== 1 || colSumEntries.length !== 1 ||
                entries[0]?.currency !== colSumEntries[0]?.currency) {
                throw new MultiperiodReportError(
                  "Cannot calculate on percentages on operation: div([" +
                  sum.toString() + "],[" + colSum.toString() +
                  "])");
              }

              sum = Amount.create([
                {
                  currency: MultiperiodTreeRenderer.PERCENT,
                  value: entries[0].value.div(colSumEntries[0].value).times(100)
                }
              ]);
            }

            rowSum = rowSum.plus(sum);
            return new (displayPerc ? PercentAmountSpan : AmountSpan)(sum, displayPolicy);
          }),
          ...(displayAvg ? [new (displayPerc ? PercentAmountSpan : AmountSpan)(
            rowSum.div(new Rational(BigInt(displayedAmounts.length), 1n)), displayPolicy)] : [])
        ]);
      });

      return Ok;
    } catch (e) {
      return e as MultiperiodReportError;
    }
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