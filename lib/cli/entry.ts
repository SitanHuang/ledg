import { chainMaybesAsync } from "../core/types.ts";
import { getErrorMessages } from "../core/utils/debugErrorTools.ts";
import { RootCommand } from "./commands/root.ts";

export const DEBUG = process.argv.includes('--debug');

(async () => {
  try {
    const root = new RootCommand();
    const result = root.build().exec(process.argv.slice(2));

    if (result instanceof Error) {
      throw result;
    }

    const status = await chainMaybesAsync(
      () => root.run(result),
      () => root.cleanup(),
    );

    if (status instanceof Error) {
      throw status;
    }
  } catch (e) {
    if ((e as Error).message?.includes("Help requested.")) {
      process.exit(1);
    }
    // TODO: we need a CLI version for pretty printing errors
    console.error(getErrorMessages(e));

    if (DEBUG) {
      throw e;
    }

    process.exit(1);
  }
})();
