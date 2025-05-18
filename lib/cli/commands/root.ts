import { ExtensibleCommand } from "../argparse/command.ts";
import { HelpFormatter } from "../argparse/helpFormatter.ts";
import { AccountsCommand } from "./accounts/accounts.ts";
import { BalancesheetCommand } from "./compound_reports/balancesheet.ts";
import { BalancesheetequityCommand } from "./compound_reports/balancesheetequity.ts";
import { CashflowCommand } from "./compound_reports/cashflow.ts";
import { IncomestatementCommand } from "./compound_reports/incomestatement.ts";
import { LedgCommand } from "./ledg.ts";

// The ExtensibleCommand is a **NON-PROCESSING** command that does NOT raise any
// errors on option parsing. It simply takes the argv, guesses the subcommand,
// and sends that argv downstream.
export class RootCommand extends ExtensibleCommand {
  readonly accountsSubcommand = new AccountsCommand();
  readonly incomestatementSubcommand = new IncomestatementCommand();
  readonly balancesheetSubcommand = new BalancesheetCommand();
  readonly balancesheetequitySubcommand = new BalancesheetequityCommand();
  readonly cashflowSubcommand = new CashflowCommand();

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
    this.setSubcommand("incomestatement", ["is"], this.incomestatementSubcommand);
    this.setSubcommand("balancesheet", ["bs"], this.balancesheetSubcommand);
    this.setSubcommand("balancesheetequity", ["bse"], this.balancesheetequitySubcommand);
    this.setSubcommand("cashflow", ["cf"], this.cashflowSubcommand);

    this.defaultSubcommand = this.accountsSubcommand;

    return super.build();
  }
}

class RootHelpCommand extends LedgCommand {
  constructor() { super("ledg", "Accounting software."); }
}