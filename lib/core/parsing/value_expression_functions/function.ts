import { EvalValue } from "../valueExpressionParser.ts";


export abstract class ValueFunction {
  abstract evaluate(args: EvalValue[], input: string): EvalValue;
}