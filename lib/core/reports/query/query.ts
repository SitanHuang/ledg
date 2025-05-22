import { Account } from "../../accounting/account.ts";
import { LedgObject } from "../../data/ledgObject.ts";

export interface Query {
  acceptLedgObject(obj: LedgObject): boolean;

  acceptAccount(account: Account): boolean;
}
