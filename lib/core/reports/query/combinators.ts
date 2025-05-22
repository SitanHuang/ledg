import { Account } from "../../accounting/account.ts";
import { LedgObject } from "../../data/ledgObject.ts";
import { Query } from "./query.ts";

export class AndQuery implements Query {
  constructor(private readonly left: Query, private readonly right: Query) { }

  acceptLedgObject(o: LedgObject): boolean {
    return this.left.acceptLedgObject(o) && this.right.acceptLedgObject(o);
  }
  acceptAccount(a: Account): boolean {
    return this.left.acceptAccount(a) && this.right.acceptAccount(a);
  }
}