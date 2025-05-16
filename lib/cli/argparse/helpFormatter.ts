import { JoinedEmbeddable, renderable } from "../../render/embeddable.ts";
import { Embeddable } from "../../render/renderable.ts";
import { Span } from "../../render/span.ts";
import { Stylable } from "../../render/stylable.ts";
import { Command, ExtensibleCommand } from "./command.ts";
import { Option } from "./option.ts";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HelpFormatter {
  static format(cmd: Command, ancestors: string[] = []): string {
    const lines: Embeddable[] = [];

    const heading = (text: string) =>
      new Stylable(new Span(text))
        .bold(true)
        .color("cyan");

    const emphasis = (text: Embeddable) =>
      new Stylable(text).bold(true).color("yellowBright");

    const italic = (text: string) => new Stylable(new Span(text)).italic(true);

    const nameChain = [...ancestors, cmd.name].join(" ");

    const hasSub =
      cmd instanceof ExtensibleCommand && cmd.getSubcommands().size > 0;

    lines.push(
      renderable`${heading("Usage:")} ${nameChain}${hasSub ? " <command>" : ""} [options]`
    );

    if (cmd.description) {
      lines.push(new Span("\n"));
      lines.push(new Span(cmd.description.trim()));
    }

    const longOpts: ReadonlyMap<string, Option> = cmd.getLongOptions();
    const shortAlias: ReadonlyMap<string, string> = cmd.getShortOptions();

    if (longOpts.size) {
      lines.push(new Span("\n"));
      lines.push(heading("Options:"));

      // Build rows first so we can compute the flag column width.
      const rows = Array.from(longOpts.values()).map((opt) => {
        const alias = shortAlias
          ? [...shortAlias.entries()].find(([, long]) => long === opt.name)?.[0]
          : undefined;

        const placeholder = italic(opt.type === "boolean" ? "" : ` <${opt.type}>`);
        const longForm = renderable`--${opt.name}${placeholder}`;
        const shortForm = alias ? renderable`-${alias.length > 1 ? `-${alias}` : alias}${placeholder}` : "";
        const flag = shortForm ? renderable`${shortForm}, ${longForm}` : longForm;

        let extra = opt.description ?? "";
        if (opt.required) extra += " (required)";
        else if (opt.defaultValue !== undefined)
          extra += ` (default: ${opt.defaultValue})`;
        if (opt.multiple) extra += " (repeatable)";

        return { flag, extra: extra.trim() };
      });

      const colWidth = rows.reduce((w, { flag }) => Math.max(w, flag.displayWidth), 0);

      rows.forEach(({ flag, extra }) => {
        const flagStylised = emphasis(flag);
        const space = " ".repeat(colWidth - flag.displayWidth + 2);
        lines.push(renderable`  ${flagStylised}${space}${extra}`);
      });
    }

    if (hasSub) {
      lines.push(new Span("\n"));
      lines.push(heading("Subcommands:"));

      const subMap: ReadonlyMap<string, Command> = (
        cmd as ExtensibleCommand
      ).getSubcommands();

      const subs = Array.from(subMap.values()).map((sc) => ({
        name: sc.name,
        desc: sc.description ?? "",
      }));

      const subWidth = subs.reduce((w, s) => Math.max(w, s.name.length), 0);

      subs.forEach(({ name, desc }) => {
        const nameStyled = emphasis(new Span(name));
        const pad = " ".repeat(subWidth - name.length + 2);
        lines.push(renderable`  ${nameStyled}${pad}${desc.trimEnd()}`);

        const aliases = (cmd as ExtensibleCommand)
          .getAliasesForSubcommand(name)
          .join(", ");
        if (aliases) {
          lines.push(
            renderable`  ${" ".repeat(subWidth + 2)}${italic(`Aliases: ${aliases}`)}`
          );
        }
      });

      lines.push(new Span("\n"));
      lines.push(
        italic(`Run "${nameChain} <command> --help" for details on a subcommand.`)
      );
    }

    const doc = JoinedEmbeddable.join(
      lines.flatMap((l, i) => (i === 0 ? [l] : [new Span("\n"), l]))
    );

    return doc.render({
      target: "ascii",
      colorSpace: 16
    });
  }
}