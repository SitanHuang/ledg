import { DateSquashFlags, differenceBetweenDates, getUTCTodayMidnight, serializeTransactionDate, Transaction } from "../../../core/namespace.ts";
import { QueryEngine } from "../../../core/reports/query/queryEngine.ts";
import { hasResult, isOk, Maybe, Ok, timestamp } from "../../../core/types.ts";
import { renderable, Stylable, Table } from "../../../render/namespace.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../context.ts";
import { QueryCommand } from "../query.ts";

export class EventsCommand extends QueryCommand {

  protected readonly squashOption = new Option({
    name: "squash",
    type: "string",
    description: "Show year, month, week, day, and/or hour differences between --today and event date, which follows the --date / --date2 options.",
    defaultValueDisplay: "tags",
    inputStringRegex: /^[ymwdh]+$/,
  });

  protected readonly todayOption = new Option({
    name: "today",
    type: "datetime",
    description: "Specify today's date.",
    defaultValueDisplay: "today midnight",
  });

  private squashVal = "ymd";
  private todayVal: timestamp = getUTCTodayMidnight();

  constructor() {
    super("events", "Lists events. The \"event:.\" modifier filter is set by default.");
  }

  override build(): void {
    super.build();

    this.setOption(this.squashOption);
    this.setOption(this.todayOption);
  }

  protected override consumeOption(opt: Option, val: OptionValue): Maybe<ArgParseError> {
    const result = super.consumeOption(opt, val);
    if (!isOk(result)) return result;

    this.squashVal = this.squashOption.extractValue(opt, val) ?? this.squashVal;
    this.todayVal = this.todayOption.extractValue(opt, val) ?? this.todayVal;

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) return result;

    const context = await this.getCLIContext();
    if (!hasResult(context)) return context;

    const { journal } = context;

    const policy = this.getQueryPolicy()
      .withDefaultModifier("event", /./);

    if (DEBUG) {
      console.debug(policy);
    }

    this.squashVal = [...new Set(this.squashVal)].join("");

    const executor = QueryEngine.create(policy).compile();

    const events: Transaction[] = [];

    executor.executeTransactionsAndRelated(journal, (txn) => {
      events.push(txn);
    });

    events.sort((a, b) => policy.useLedgObjDate(a) - policy.useLedgObjDate(b));

    const table = new Table({
      justify: [
        'left',
        'left',
        'left',
        'left',
        ...Array(this.squashVal.length).fill('right')
      ]
    });
    table.addRow([
      policy.useDate === 'date' ? 'Date' : 'Aux. Date',
      'UUID', 'Type', 'Description',
      'Since ',
      ...Array(this.squashVal.length - 1).fill('')
    ], { header: true });

    for (const event of events) {
      const date = policy.useLedgObjDate(event);

      const pendingMark = new Stylable('!').color('redBright').bold(true);
      const desc = new Stylable(event.description).color('whiteBright');

      const {
        y, m, w, d, h
      } = date > this.todayVal ?
        differenceBetweenDates(date, this.todayVal, this.squashVal as DateSquashFlags) :
        differenceBetweenDates(this.todayVal, date, this.squashVal as DateSquashFlags);

      table.addRow([
        new Stylable(serializeTransactionDate(date)).color('cyanBright'),
        new Stylable(event.id).color('cyan'),
        new Stylable(event.metadata.event ?? '').color('yellowBright'),
        event.metadata.pending === true ?
          renderable`${pendingMark} ${desc}` :
          desc,
        ...[
          this.squashVal.includes('y') ? y ? y.toString().padStart(2, " ") + ' years' : '' : undefined,
          this.squashVal.includes('m') ? m ? m.toString().padStart(2, " ") + ' months' : '' : undefined,
          this.squashVal.includes('w') ? w ? w.toString().padStart(2, " ") + ' weeks' : '' : undefined,
          this.squashVal.includes('d') ? d ? d.toString().padStart(2, " ") + ' days' : '' : undefined,
          this.squashVal.includes('h') ? h ? h.toString().padStart(2, " ") + ' hours' : '' : undefined
        ].filter(x => typeof x === 'string').map((x, id) => id === 0 ? (date > this.todayVal ? '-' : '' + x) : x),
      ]);
    }

    context.printlnRenderable(table);

    return Ok;
  }
}