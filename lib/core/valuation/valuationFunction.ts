import { Amount } from "../accounting/amount.ts";
import { Transaction } from "../accounting/transaction.ts";
import { Optional } from "../types.ts";

export type ValuationFunction = (txn: Transaction, amt: Amount) => Optional<Amount>;