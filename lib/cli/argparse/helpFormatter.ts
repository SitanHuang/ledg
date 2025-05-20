import { DateFormat } from "../../core/reports/dateFormat.ts";
import { timestamp } from "../../core/types.ts";
import { JoinedEmbeddable, renderable } from "../../render/embeddable.ts";
import { Embeddable } from "../../render/renderable.ts";
import { Span } from "../../render/span.ts";
import { Stylable } from "../../render/stylable.ts";
import { Command, ExtensibleCommand } from "./command.ts";
import { Option } from "./option.ts";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HelpFormatter {
  static format(cmd: Command, ancestors: string[] = []): string {
    const termCols = process.stdout.columns || 80;
    const margin = 4;
    const maxWidth = termCols - margin;

    const wrapLines = (text: string, targetWidth: number, indent = 0): string[] => {
      const origLines = text.split(/\r\n|\n|\r/);
      const lines: string[] = [];

      for (const line of origLines) {
        const leadingMatch = /^\s*/.exec(line);
        const leading = leadingMatch ? leadingMatch[0] : '';

        const content = line.slice(leading.length);

        const words = content.split(' ')

        let current = leading;
        for (const word of words) {
          if (indent + (current + word).length > targetWidth) {
            lines.push(current.trimEnd());
            current = word + ' ';
          } else {
            current += word + ' ';
          }
        }
        if (current) lines.push(current.trimEnd());
      }
      return lines.map((line) => line);
    };

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
      renderable`${heading("Usage:")} [options] ${nameChain}${hasSub ? " <command>" : ""} ${cmd.synopsis ?? ""}`
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

        let header = opt.description ?? "";
        if (opt.required) {
          header += " (required)";
        } else if (opt.defaultValueDisplay !== undefined) {
          header += ` (default: ${opt.defaultValueDisplay})`;
        } else if (opt.defaultValue !== undefined) {
          if (opt.type === 'datetime') {
            header += ` (default: ${DateFormat.utc().formatDate(opt.defaultValue as timestamp)})`;
          } else {
            header += ` (default: ${opt.defaultValue})`;
          }
        }

        if (opt.multiple) header += " (repeatable)";

        let extra = '';

        if (opt.longDescription) extra = opt.longDescription;

        return { flag, header, extra };
      });

      const colWidth = rows.reduce((w, { flag }) => Math.max(w, flag.displayWidth), 0);

      rows.forEach(({ flag, header, extra }) => {
        const flagStylised = emphasis(flag);
        const space = " ".repeat(colWidth - flag.displayWidth + 2);
        const line = renderable`  ${flagStylised}${space}`;

        const indent = line.displayWidth

        wrapLines(header, maxWidth, line.displayWidth).forEach((span, idx) => {
          if (idx > 0) line.append(new Span("\n" + ' '.repeat(indent)));
          line.append(new Span(span));
        });

        if (extra.length) {
          wrapLines(extra, maxWidth, 6).forEach((span) => {
            line.append(new Span("\n      "));
            line.append(new Stylable(new Span(span)).dim(true));
          });
        }

        lines.push(line);
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