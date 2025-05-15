import { Maybe } from "../../core/types.ts";
import { ArgParseError } from "../argparse/argparse.ts";
import { ExtensibleCommand } from "../argparse/command.ts";
import { AccountsCommand } from "./accounts/accounts.ts";

export class RootCommand extends ExtensibleCommand {
  readonly accountsSubcommand = new AccountsCommand();

  constructor() {
    super("ledg", "Accounting software.");
  }

  override build() {
    this.setSubcommand("accounts", ["acc"], this.accountsSubcommand);
    return super.build();
  }

  override async runDefault(): Promise<Maybe> {
    return new ArgParseError(`"${this.name}" requires a valid subcommand.`);
  }
}