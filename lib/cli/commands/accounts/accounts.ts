import { parseSmartDate } from "../../../core/utils/dateUtils.ts";
import { Maybe, Ok, unwrapResult } from "../../../core/types.ts";
import { Positionals } from "../../argparse/argparse.ts";
import { ReportCommand } from "../report.ts";

export class AccountsCommand extends ReportCommand {
  constructor() {
    super("accounts", "Show account balances.")
  }

  override build(): void {
    super.build();

    this.fromOption.defaultValue = unwrapResult(parseSmartDate('today midnight'));
    this.toOption.defaultValue = unwrapResult(parseSmartDate('tomorrow midnight'));
    this.cumulativeOption.defaultValue = true;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const journal = await this.getJournal();
    console.log(this.reportPolicy)
    console.log(new Date(this.reportPolicy.reportFrom!).toUTCString(), new Date(this.reportPolicy.reportTo!).toUTCString())
    return Ok;
  }
}