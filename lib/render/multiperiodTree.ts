import { MultiperiodTreeItem } from "../core/reports/multiperiodTreeAggregator.ts";
import { AmountDisplayPolicy, AmountSpan } from "./amount.ts";
import { RenderFormat } from "./renderable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";
import { Table } from "./table.ts";

export class MultiperiodTreeRenderer {
  constructor(
    public displayPolicy: AmountDisplayPolicy
  ) {}

  renderBalances(rootItem: MultiperiodTreeItem, table: Table): void {
    rootItem.walkChildrenRecursive(node => {
      table.addRow([
        new AccountSpan(node.displayedName, node.depth),
        ...node.additiveSums.map(sum => new AmountSpan(sum, this.displayPolicy))
      ]);
    });
  }

  renderSum(rootItem: MultiperiodTreeItem, table: Table): void {
    table.addRow([
      "Sum",
      ...rootItem.additiveSums.map(sum => {
        return new AmountSpan(sum, this.displayPolicy)
      })
    ], { topline: true, underline: true, header: true });
  }

}

export class AccountSpan extends Stylable {
  constructor(
    public accountDisplayName: string,
    public depth: number,
  ) {
    super(new Span(accountDisplayName));

    this.appendStyle("text-indent: 2em");
  }

  // only used for ascii so we can safely assume there's space in that span
  override get displayWidth(): number {
    return super.displayWidth + 2 * (this.depth - 1);
  }

  override render(format: RenderFormat): string {
    if (["csv", "ascii"].includes(format.target)) {
      this.target = new Span("  ".repeat(this.depth - 1) + this.accountDisplayName);
    }
    return super.render(format);
  }
}