import { getErrorMessages } from "../core/utils/debugErrorTools.ts";
import { RootCommand } from "./commands/root.ts";

try {
  const root = new RootCommand();
  const result = root.build().exec(process.argv.slice(2));

  if (result instanceof Error) {
    throw result;
  }

  const status = await root.run(result);

  if (status instanceof Error) {
    throw status;
  }
} catch (e) {
  // TODO: we need a CLI version for pretty printing errors
  console.error(getErrorMessages(e));
  process.exit(1);
}
