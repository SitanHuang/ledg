import { LedgObject } from "../../../core/data/ledgObject.ts";
import { PostingAcceptor, TransactionAcceptor } from "../../../core/namespace.ts";
import { extractUserSpecifiedModifierVal, QueryEngine } from "../../../core/reports/query/queryEngine.ts";
import { hasResult, isOk, Maybe, Ok } from "../../../core/types.ts";
import { Table } from "../../../render/namespace.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../context.ts";
import { QueryCommand } from "../query.ts";

export class TagsCommand extends QueryCommand {

  protected readonly fieldOption = new Option({
    name: "field",
    type: "string",
    description: "The metadata field to perform split(\",\") and groupBy on. {description, desc, id} are valid too. `id` refers to transaction ID.",
    defaultValueDisplay: "tags",
  });

  protected readonly countOption = new Option({
    name: "count",
    type: "string",
    description: "Specify to count transactions/postings.",
    defaultValueDisplay: "txn",
    inputStringRegex: /^txn|posting$/
  });

  private fieldVal = "tags";
  private countVal = "txn";

  constructor() {
    super("tags", "Tabulate tags with number of postings/transactions.");
  }

  override build(): void {
    super.build();

    this.setOption(this.fieldOption);
    this.setOption(this.countOption);
  }

  protected override consumeOption(opt: Option, val: OptionValue): Maybe<ArgParseError> {
    const result = super.consumeOption(opt, val);
    if (!isOk(result)) return result;

    this.fieldVal = this.fieldOption.extractValue(opt, val) ?? this.fieldVal;
    this.countVal = this.countOption.extractValue(opt, val) ?? this.countVal;

    if (this.fieldVal === "desc") this.fieldVal = "description";

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) return result;

    const context = await this.getCLIContext();
    if (!hasResult(context)) return context;

    const { journal } = context;

    const policy = this.getQueryPolicy();

    if (DEBUG) {
      console.debug(policy);
    }

    const executor = QueryEngine.create(policy).compile();

    const aggr = new Map<string, number>();
    const add = (key: string, val = 1) => {
      aggr.set(key, (aggr.get(key) ?? 0) + val);
    };

    const acceptor: TransactionAcceptor & PostingAcceptor = (obj: LedgObject) => {
      const val = extractUserSpecifiedModifierVal(obj, this.fieldVal);
      if (!val) return;

      const split = String(val).split(",");

      for (let i = 0;i < split.length;i++) {
        add(split[i].toLocaleUpperCase());
      }
    };

    if (this.countVal === "txn") {
      executor.executeTransactionsAndRelated(journal, acceptor);
    } else {
      executor.executePostings(journal, acceptor);
    }

    const table = new Table({
      justify: ["left", "right"]
    });
    table.addRow([
      "Tag",
      this.countVal === "txn" ? "Txns" : "Postings"
    ], { header: true });

    Array.from(aggr.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).forEach(row => {
      table.addRow(row.map(String));
    });

    context.printlnRenderable(table);

    return Ok;
  }
}