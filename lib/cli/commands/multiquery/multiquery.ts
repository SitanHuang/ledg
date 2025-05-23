import { hasResult, isOk, Maybe, MultipolicyReport, Ok, toUTCDatetimeString } from "../../../core/namespace.ts";
import { AmountSpan, Table } from "../../../render/namespace.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { parseArgvFromShellString } from "../../argparse/argvparse.ts";
import { HelpFormatter } from "../../argparse/helpFormatter.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../context.ts";
import { ReportCommand } from "../report.ts";
import { NamedReportPolicy, SubreportCommand } from "./subreport.ts";

export class MultiqueryCommand extends ReportCommand {

  protected readonly queryHelpOption = new Option({
    name: "query-help",
    type: "boolean",
    description: "Show help message for subreport arguments.",
  });

  protected queryHelpRequested = false;

  constructor() {
    super(
      "query",
      "Create multiperiod, multiquery reports.",
      `<subreport query> [ [<subreport query>] ... ]`,
      [
        "For each positional argument, pass in a string containing CLI reporting flags to create a subreport. ",
        "To see which query flags are available for a subreport, use the --query-help.",
        "The subreports inherit the `query` command options.",
        "",
        "Example:",
        `  ledg query -- \\ # <- use "--" to escape the following positionals`,
        `      "--name 'Assets' -a '{asset}.*' --cumulative" \\`,
        `      "--name 'Income' -a '{income}.*' --invert"`,
      ].join("\n"),
    );
  }

  override build(): void {
    super.build();

    this.setOption(this.queryHelpOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.queryHelpRequested = this.queryHelpOption.extractValue(option, value) ?? this.queryHelpRequested;

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (this.queryHelpRequested) {
      const sham = new SubreportCommand("");
      sham.build();
      console.log(HelpFormatter.format(sham));
      return Ok;
    }

    if (!positionals.length) {
      return new ArgParseError("Expected positional arguments.");
    }

    const context = await this.getCLIContext();
    if (!hasResult(context)) return context;

    const { journal } = context;

    const rootPolicy = this.getReportPolicy();

    const subreportCmds: SubreportCommand[] = [];
    const childPolicies: NamedReportPolicy[] = [];

    for (let reportNum = 0; reportNum < positionals.length; reportNum++) {
      const raw = positionals[reportNum].raw;
      const argv = parseArgvFromShellString(raw);

      const subCmd = new SubreportCommand(`Query ${reportNum + 1}`);
      subCmd.build();
      subCmd.inheritPolicy(rootPolicy);

      subreportCmds.push(subCmd);

      const result = subCmd.exec(argv);
      if (!hasResult(result)) {
        const error = new ArgParseError("Unable to parse subreport arguments.");
        error.cause = result;
        return error;
      }
      const result2 = await subCmd.run(result);
      if (!isOk(result2)) {
        const error = new ArgParseError("Unable to parse subreport arguments.");
        error.cause = result2;
        return error;
      }

      childPolicies.push(subCmd.getReportPolicy());
    }

    const report = new MultipolicyReport(
      journal,
      rootPolicy,
      childPolicies
    );

    if (DEBUG) {
      console.debug(rootPolicy);
      if (rootPolicy.from) console.debug(toUTCDatetimeString(rootPolicy.from));
      if (rootPolicy.to) console.debug(toUTCDatetimeString(rootPolicy.to));

      for (const child of report.childPolicies) {
        console.debug(child);
      }
    }

    const result = report.execute();
    if (!hasResult(result)) return result;

    const table = new Table({
      justify: [
        'left',
        ... Array(result.originalQueries.length).fill('right')
      ],
      firstRowIsHeader: true,
    });

    table.addRow([
      '',
      ...childPolicies.map(x => x.name)
    ]);

    for (const { period, amounts } of result.byPeriods()) {
      table.addRow([
        context.dateFormat.formatDate(period.to ?? Infinity),
        ...amounts.map(x => new AmountSpan(x, context.amountDisplayPolicy))
      ]);
    }

    context.printlnRenderable(table);

    return Ok;
  }
}
