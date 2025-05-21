import { Result } from "../../core/types.ts";
import { ArgParseError, Positionals } from "../argparse/argparse.ts";
import { Command, ExtensibleCommand } from "../argparse/command.ts";
import { HelpFormatter } from "../argparse/helpFormatter.ts";
import { AccountsCommand } from "./accounts/accounts.ts";
import { AddCommand } from "./add/add.ts";
import { BalancesheetCommand } from "./compound_reports/balancesheet.ts";
import { BalancesheetequityCommand } from "./compound_reports/balancesheetequity.ts";
import { CashflowCommand } from "./compound_reports/cashflow.ts";
import { IncomestatementCommand } from "./compound_reports/incomestatement.ts";
import { GitCommand } from "./git/git.ts";
import { InfoCommand } from "./info/info.ts";
import { LedgCommand } from "./ledg.ts";
import { PrintCommand } from "./print/print.ts";
import { RegisterCommand } from "./register/register.ts";
import { TagsCommand } from "./tags/tags.ts";

// The ExtensibleCommand is a **NON-PROCESSING** command that does NOT raise any
// errors on option parsing. It simply takes the argv, guesses the subcommand,
// and sends that argv downstream.
export class RootCommand extends ExtensibleCommand {
  readonly accountsSubcommand = new AccountsCommand();
  readonly addSubcommand = new AddCommand();
  readonly infoSubcommand = new InfoCommand();
  readonly registerSubcommand = new RegisterCommand();
  readonly incomestatementSubcommand = new IncomestatementCommand();
  readonly balancesheetSubcommand = new BalancesheetCommand();
  readonly balancesheetequitySubcommand = new BalancesheetequityCommand();
  readonly cashflowSubcommand = new CashflowCommand();
  readonly printSubcommand = new PrintCommand();
  readonly gitSubcommand = new GitCommand();
  readonly tagsSubcommand = new TagsCommand();

  constructor() {
    super("ledg", "Accounting software.");
  }

  override exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    const sham = new RootHelpCommand();
    sham.build();
    // We need LedgCommand to set the piping commands so that --help works
    sham.exec(argv);
    return super.exec(argv);
  }

  override help() {
    let target: Command;

    if (this.detectedSubcommand) {
      target = this.detectedSubcommand;
    } else {
      this.clearOptions();
      const sham = new RootHelpCommand();
      Object.assign(this, sham);
      sham.build.bind(this)();
      target = this;
    }

    console.log(HelpFormatter.format(target));
  }

  override build() {
    this.setSubcommand("accounts", ["acc"], this.accountsSubcommand);
    this.setSubcommand("add", [], this.addSubcommand);
    this.setSubcommand("info", ["inf"], this.infoSubcommand);
    this.setSubcommand("register", ["reg"], this.registerSubcommand);
    this.setSubcommand("incomestatement", ["is"], this.incomestatementSubcommand);
    this.setSubcommand("balancesheet", ["bs"], this.balancesheetSubcommand);
    this.setSubcommand("balancesheetequity", ["bse"], this.balancesheetequitySubcommand);
    this.setSubcommand("cashflow", ["cf"], this.cashflowSubcommand);
    this.setSubcommand("print", [], this.printSubcommand);
    this.setSubcommand("git", [], this.gitSubcommand);
    this.setSubcommand("tags", ["tag"], this.tagsSubcommand);

    this.defaultSubcommand = this.accountsSubcommand;

    return super.build();
  }
}

class RootHelpCommand extends LedgCommand {
  constructor() { super("ledg", "Accounting software."); }
}