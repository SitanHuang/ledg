import { chainMaybesAsync } from "../core/types.ts";
import { getErrorMessages } from "../core/utils/debugErrorTools.ts";
import { HelpRequested } from "./argparse/argparse.ts";
import { RootCommand } from "./commands/root.ts";
import { DEBUG, ExitCode, LedgCLIContext } from "./context.ts";

(async () => {
  try {
    const root = new RootCommand();
    const result = root.build().exec(process.argv.slice(2));

    if (result instanceof HelpRequested) {
      root.help();
      LedgCLIContext.getCurrentContext().releaseConsoleBuffer();
      return;
    }

    if (result instanceof Error) {
      throw result;
    }

    const status = await chainMaybesAsync(
      () => root.run(result),
      () => root.cleanup(),
    );

    if (result instanceof HelpRequested) {
      root.help();
      LedgCLIContext.getCurrentContext().releaseConsoleBuffer();
      return;
    }

    if (status instanceof Error) {
      throw status;
    }
  } catch (e) {
    if (e instanceof ExitCode) {
      process.exit(e.exitCode);
    }
    if ((e as Error).message?.includes("Help requested.")) {
      process.exit(1);
    }
    // TODO: we need a CLI version for pretty printing errors
    console.error(getErrorMessages(e));

    if (DEBUG) {
      throw e;
    }

    process.exit(1);
  } finally {
    LedgCLIContext.getCurrentContext().releaseConsoleBuffer();
  }
})();
