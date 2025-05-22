import { RootCommand } from "../out/cli/commands/root.js";

const lines = [];
const emit = (line) => lines.push(line);

function traverse(cmd, pathNames) {
  if (cmd.getLongOptions) {

    const longOpts = cmd.getLongOptions();

    for (const opt of longOpts.values()) {
      let line = `complete -c ledg`;
      if (pathNames.length) {
        line += ` -n '__fish_seen_subcommand_from ${pathNames.join(" ")}'`;
      }
      line += ` -l ${opt.name}`;
      if (opt.alias?.length === 1) line += ` -s '${opt.alias}'`;
      if (opt.type !== "boolean") line += ` -r`;
      if (opt.description) line += ` -d '${opt.description.replace(/'/g, "\\'")}'`;
      emit(line);

      if (opt.alias?.length > 1) {
        line = `complete -c ledg`;
        if (pathNames.length) {
          line += ` -n '__fish_seen_subcommand_from ${pathNames.join(" ")}'`;
        }
        line += ` -l ${opt.alias}`;
        if (opt.type !== "boolean") line += ` -r`;
        if (opt.description) line += ` -d '${opt.description.replace(/'/g, "\\'")}'`;
        emit(line);
      }
    }
  }

  if (cmd.getSubcommands) {
    const subs = [...cmd.getSubcommands().entries(), ...cmd.subcommandAliases.entries().map(([x, lg]) => [x, cmd.subcommands.get(lg)])];

    for (const [name, subCmd] of subs) {
      // Completion entry for the sub‑command itself at the current level
      let line = `complete -c ledg`;
      if (pathNames.length) {
        line += ` -n '__fish_seen_subcommand_from ${pathNames.join(" ")}'`;
      } else {
        line += ` -n '__fish_use_subcommand'`;
      }
      line += ` -f -a ${name}`;
      if (subCmd.description) line += ` -d '${subCmd.description.replace(/'/g, "\\'")}'`;
      emit(line);

      // Recurse deeper
      traverse(subCmd, [...pathNames, name]);
    }
  }
}

const root = new RootCommand();
root.build();
traverse(root, []);

console.log(`
# disable file completions
complete -c ledg -f`)
console.log(lines.join("\n"));
console.log(`complete -c ledg -n "__fish_seen_subcommand_from git" \\
    -a "checkout add commit push pull merge cherry-pick $ledg_options $ledg_modifiers"`)