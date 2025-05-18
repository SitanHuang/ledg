import { Amount } from "../core/accounting/amount.ts";
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

  renderBalances(rootItem: MultiperiodTreeItem, table: Table): void {
    rootItem.walkChildrenRecursive(node => {
      table.addRow([
        new AccountSpan(node.displayedName, node.depth),
        ...node.displayedAmounts.map(sum => new AmountSpan(sum, this.displayPolicy))
      ]);
    });
  }

  renderSum(rootItem: MultiperiodTreeItem | Amount[], table: Table, legendText = "Sum", rowOpts: RowOptions = {}): void {
    table.addRow([
      legendText,
      ...(rootItem instanceof MultiperiodTreeItem ? rootItem.displayedAmounts : rootItem).map(sum => {
        return new AmountSpan(sum, this.displayPolicy)
      })
    ], Object.assign({ topline: true, underline: true, header: true }, rowOpts));
  }

}

export class AccountSpan extends Stylable {
  protected readonly actualTarget: Embeddable;

  constructor(
    public readonly accountDisplayName: MultiperiodTableKey,
    public readonly depth: number,
  ) {
    let actualTarget;
    if (isMinDepthHiddenKey(accountDisplayName)) {
      super(actualTarget = new Span("(Upper-level accounts)"));

      this.italic(true);
    } else {
      super(actualTarget = new Span(accountDisplayName));

      this.appendStyle(`text-indent: ${2 * (this.depth - 1)}em`);
    }
    this.actualTarget = actualTarget;
  }

  // only used for ascii so we can safely assume there's space in that span
  override get displayWidth(): number {
    return super.displayWidth + 2 * (this.depth - 1);
  }

  override render(format: RenderFormat): string {
    if (["csv", "ascii"].includes(format.target)) {
      this.target = renderable`${"  ".repeat(this.depth - 1)}${this.actualTarget}`;
    }
    return super.render(format);
  }
}