import { ValueExpressionEvalError } from "../parseErrors.ts";
import { EvalValue } from "../valueExpressionParser.ts";
import { ValueFunction } from "./function.ts";

export class DebugIdentityFunction extends ValueFunction {
  evaluate(args: EvalValue[], input: string): EvalValue {
    if (args.length !== 1) {
      throw new ValueExpressionEvalError("DEBUG_IDENTITY() expects exactly one argument", input);
    }
    return args[0];
  }
};