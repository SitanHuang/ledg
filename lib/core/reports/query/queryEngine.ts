import { Account } from "../../accounting/account.ts";
import { BoundPosting, Posting } from "../../accounting/posting.ts";
import { LedgObject } from "../../data/ledgObject.ts";
import { Query } from "./query.ts";
import { QueryEngineExecutor } from "./queryEngineExecutor.ts";
import { ModifierQuery, QueryPolicy } from "./queryPolicy.ts";

export class QueryEngine {
  protected constructor(
    protected readonly queryPolicy: QueryPolicy,
  ) { }

  static create(queryPolicy: QueryPolicy): QueryEngine {
    return new QueryEngine(queryPolicy);
  }

  compile(): QueryEngineExecutor {
    // Array has faster iteration
    const modifierList: [string, ModifierQuery][] = Array.from(this.queryPolicy.modifiers.entries());
    const { from, to, accountGlob: account, realOnly } = this.queryPolicy;
    const useLedgObjDate = this.queryPolicy.useLedgObjDate.bind(this.queryPolicy);

    const testModQuery = (modQuery: ModifierQuery, target: unknown): boolean =>
      modQuery === false
        ? target === undefined
        : modQuery.exec(target?.toString() ?? '') !== null; // `g` / `y` flags cause hysterisis of `test()`, must use `exec`

    const query: Query = {
      acceptLedgObject: (ledgObject: LedgObject): boolean => {
        const date = useLedgObjDate(ledgObject);

        if (
          (Number.isFinite(from) && date < from!) ||
          (Number.isFinite(to) && date >= to!)
        ) {
          return false;
        }

        if (ledgObject instanceof Posting && account?.execute(ledgObject.account) === false) {
          return false;
        }

        if (realOnly && ledgObject.metadata.virt === true) {
          return false;
        }

        for (let i = 0; i < modifierList.length;i++) {
          const modId = modifierList[i][0];
          const modQuery = modifierList[i][1];

          let target: unknown;

          if (modId == 'description') {
            // if it's a posting, we also need to check using OR condition on
            // the transaction's description
            if (ledgObject instanceof BoundPosting) {
              if (testModQuery(modQuery, ledgObject.transaction.description)) {
                continue;
              }
            }
            target = ledgObject.description;
          } else if (modId == 'id') {
            target = ledgObject instanceof Posting ? ledgObject.transactionID : ledgObject.id;
          } else {
            target = ledgObject.metadata[modId];
          }

          if (!testModQuery(modQuery, target)) {
            return false;
          }
        }

        return true;
      },
      acceptAccount: (account: Account): boolean => {
        return this.queryPolicy.accountGlob ? this.queryPolicy.accountGlob.execute(account) : true;
      }
    };
    return new QueryEngineExecutor(query);
  }
}