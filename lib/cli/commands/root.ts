import { ExtensibleCommand } from "../argparse/command.ts";
import { HelpFormatter } from "../argparse/helpFormatter.ts";
import { AccountsCommand } from "./accounts/accounts.ts";
import { LedgCommand } from "./ledg.ts";

export class RootCommand extends ExtensibleCommand {
  readonly accountsSubcommand = new AccountsCommand();

  constructor() {
    super("ledg", "Accounting software.");
  }

  override help() {
    this.clearOptions();
    const sham = new RootHelpCommand();
    Object.assign(this, sham);
    sham.build.bind(this)();
    console.log(HelpFormatter.format(this));
  }

  override build() {
    this.setSubcommand("accounts", ["acc"], this.accountsSubcommand);

    this.defaultSubcommand = this.accountsSubcommand;

    return super.build();
  }
}

class RootHelpCommand extends LedgCommand {
  constructor() { super("ledg", "Accounting software."); }
}