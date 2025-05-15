import { Maybe, Ok } from "../../../core/types.ts";
import { Positionals } from "../../argparse/argparse.ts";
import { QueryCommand } from "../query.ts";

export class AccountsCommand extends QueryCommand {
  constructor() {
    super("accounts", "Show account balances.")
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const journal = await this.getJournal();
    console.log(journal);
    return Ok;
  }
}