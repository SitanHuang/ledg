import { ValueExpressionEvalError } from "../parseErrors.ts";
import { EvalValue } from "../valueExpressionParser.ts";
import { ValueFunction } from "./function.ts";

/**
 * Implementation of the round function in value expressions:
 *   round([amount], dp?) -> [amount]
 *   round(scalar, dp?) -> scalar
 *   It expects the first argument to be an amount or scalar and the optional
 *   second argument to be a scalar representing the number of decimal places.
 */
export class RoundFunction extends ValueFunction {
  evaluate(args: EvalValue[], input: string): EvalValue {
    if (args.length < 1 || args.length > 2) {
      throw new ValueExpressionEvalError("round expects 1 or 2 arguments", input);
    }
    const arg0 = args[0];
    if (arg0.type !== "amount" && arg0.type !== "scalar") {
      throw new ValueExpressionEvalError("round expects first argument to be an amount or scalar", input);
    }
    let dp = 0;
    if (args.length === 2) {
      const arg1 = args[1];
      if (arg1.type !== "scalar" || !Number.isInteger(dp = arg1.value.toNumber())) {
        throw new ValueExpressionEvalError("round expects second argument to be an integer", input);
      }
    }


    // Below is typescript shenanigan: both amount/scalar has round method (Amount/Rational class)
    if (arg0.type == "amount")
      return { type: arg0.type, value: arg0.value.round(dp) };
    else // scalar
      return { type: arg0.type, value: arg0.value.round(dp) };
  }
}