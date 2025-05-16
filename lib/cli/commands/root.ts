import { ExtensibleCommand } from "../argparse/command.ts";
import { AccountsCommand } from "./accounts/accounts.ts";

export class RootCommand extends ExtensibleCommand {
  readonly accountsSubcommand = new AccountsCommand();

  constructor() {
    super("ledg", "Accounting software.");
  }

  override build() {
    this.setSubcommand("accounts", ["acc"], this.accountsSubcommand);

    this.defaultSubcommand = this.accountsSubcommand;

    return super.build();
  }
}