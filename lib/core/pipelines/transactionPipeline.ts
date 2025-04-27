import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { TransactionAutoBalancer } from "../accounting/transactionAutoBalancer.ts";
import { TransactionValidationService } from "../accounting/transactionValidationService.ts";
import { CommitRegistry } from "../data/commitRegistry.ts";
import { TransactionStore } from "../data/transactionStore.ts";
import { AccountManager, Amount, Transaction, TransactionBuilder } from "../namespace.ts";
import { Maybe, isOk, isSome } from "../types.ts";
import { TransactionProcessor } from "./transactionProcessor.ts";
import { ValueExpressionParser } from "../parsing/valueExpressionParser.ts";
import { Journal } from "../data/journal.ts";

export class DefaultTransactionPipeline extends TransactionProcessor {
  constructor(
    private readonly valueParser: ValueExpressionParser,
    private readonly autoBalancer: TransactionAutoBalancer,
    private readonly validator: TransactionValidationService,
    private readonly accountManager: AccountManager,
    private readonly commitRegistry: CommitRegistry,
    private readonly store: TransactionStore,
    private readonly currencyProvider: CurrencyProvider,
  ) { super(); }

  static fromJournal(journal: Journal): DefaultTransactionPipeline {
    return new DefaultTransactionPipeline(
      journal.valueExpressionParser,
      journal.transactionAutoBalancer,
      journal.transactionValidationService,
      journal.accountManager,
      journal.commitRegistry,
      journal.transactionStore,
      journal.currencyProvider
    );
  }

  override process(builder: TransactionBuilder): Maybe<Error> {
    builder.attachTransactionValidationService(this.validator);

    for (const pb of builder.getPostingBuilders()) {
      pb.attachAccountManager(this.accountManager);

      pb.genId();

      const amntString = pb.getAmountString();

      // convert [amountString] only if an explicit Amount is not yet set
      if (!pb.getAmount() && amntString) {
        const amtRes = this.valueParser.evaluateValueExpression(
          amntString,
          this.currencyProvider,
        );
        if (!isSome(amtRes))
          return amtRes;

        const amnt = amtRes as Amount;

        pb.withAmount(amnt);
      }
    }

    const balanceMaybe = builder.autoBalance(this.autoBalancer);
    if (!isOk(balanceMaybe)) {
      return balanceMaybe; // TransactionAutoBalanceError
    }

    // We must open accounts before calling build. Delaying until last moment so to minimize accountManager calls
    if (builder.accountOpened) {
      if (typeof builder.date === 'undefined') {
        return new Error("Account name to be opened cannot be empty.");
      }

      this.accountManager.openAccount(builder.accountOpened, builder.date);
    }

    const txnResult = builder.build();
    if (!isSome(txnResult)) {
      return txnResult; // Build‑time Error
    }
    const txn = txnResult as Transaction;

    builder.commitChanges(this.commitRegistry);

    return this.store.insertTransaction(txn);
  }
}
