import { AccountManager } from "../accounting/accountManager.ts";
import { Amount } from "../accounting/amount.ts";
import { BalanceAssertionService } from "../accounting/balanceAssertionService.ts";
import { Transaction, TransactionBuilder } from "../accounting/transaction.ts";
import { TransactionAutoBalancer } from "../accounting/transactionAutoBalancer.ts";
import { TransactionValidationService } from "../accounting/transactionValidationService.ts";
import { CommitRegistry } from "../data/commitRegistry.ts";
import { Journal } from "../data/journal.ts";
import { TransactionStore } from "../data/transactionStore.ts";
import { Rational } from "../math/rational.ts";
import { AmountParseError } from "../parsing/parseErrors.ts";
import { ValueExpressionParser } from "../parsing/valueExpressionParser.ts";
import { Maybe, Ok, isNone, isOk, isSome, timestamp } from "../types.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { PriceDirectiveProcessor } from "./priceDirectiveProcessor.ts";
import { TransactionProcessor } from "./transactionProcessor.ts";

export class DefaultTransactionPipeline implements TransactionProcessor, PriceDirectiveProcessor {
  constructor(
    private readonly valueParser: ValueExpressionParser,
    private readonly autoBalancer: TransactionAutoBalancer,
    private readonly validator: TransactionValidationService,
    private readonly accountManager: AccountManager,
    private readonly commitRegistry: CommitRegistry,
    private readonly store: TransactionStore,
    private readonly currencyProvider: CurrencyProvider,
    private readonly balanceAssertionService: BalanceAssertionService,
    private readonly currencyConversionService: CurrencyConversionService,
  ) { }

  static fromJournal(journal: Journal): DefaultTransactionPipeline {
    return new DefaultTransactionPipeline(
      journal.valueExpressionParser,
      journal.transactionAutoBalancer,
      journal.transactionValidationService,
      journal.accountManager,
      journal.commitRegistry,
      journal.transactionStore,
      journal.currencyProvider,
      journal.balanceAssertionService,
      journal.currencyConversionService,
    );
  }

  processTransaction(builder: TransactionBuilder): Maybe<Error> {
    builder.attachTransactionValidationService(this.validator);

    if (builder.accountOpened && builder.accountClosed) {
      return new Error("A transaction cannot open and close accounts at the same time.");
    }

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

    if (builder.accountClosed) {
      if (typeof builder.date === 'undefined') {
        return new Error("Account name to be opened cannot be empty.");
      }

      // We need to insert transaction first in case any postings inside this
      // transaction are required to balance the account to zero
      const result = this.store.insertTransaction(txn);

      if (!isOk(result)) {
        return result;
      }

      const result2 = this.accountManager.closeAccount(builder.accountClosed, builder.date, this.balanceAssertionService);

      if (result2 instanceof Error) {
        return result2;
      }

      if (isNone(result2)) {
        return new Error("Account cannot be closed at this time in history.");
      }

      return result2;
    } else {
      return this.store.insertTransaction(txn);
    }
  }

  processPriceDirective(date: timestamp, cur1Id: string, rateExpr: string): Maybe {
    const cur1 = this.currencyProvider.getOrCreateCurrencyById(cur1Id);

    let quantityStr: string;
    let cur2Id: string;
    const firstChar = rateExpr[0];

    if (firstChar === '+' || firstChar === '-' || firstChar === '.' || (firstChar >= '0' && firstChar <= '9')) {
      const quantityMatch = rateExpr.match(ValueExpressionParser.QUANTITY_REGEX);

      if (!quantityMatch) {
        return new AmountParseError(`Invalid amount format, expected quantity first in "${rateExpr}"`, rateExpr);
      }

      quantityStr = quantityMatch[0];
      cur2Id = rateExpr.slice(quantityStr.length).trim();

      if (cur2Id && !cur2Id.match(ValueExpressionParser.CURRENCY_REGEX_FULL)) {
        return new AmountParseError(`Invalid amount format, improper currency format in "${rateExpr}"`, rateExpr);
      }
    } else {
      const currencyMatch = rateExpr.match(ValueExpressionParser.CURRENCY_REGEX);

      if (!currencyMatch) {
        return new AmountParseError(`Invalid amount format, expected currency first in "${rateExpr}"`, rateExpr);
      }

      cur2Id = currencyMatch[0];

      const rest = rateExpr.slice(cur2Id.length).trim();
      if (!rest) {
        return new AmountParseError(`Missing quantity after currency in "${rateExpr}"`, rateExpr);
      }

      if (cur2Id.endsWith("+")) {
        // a "+" sign at the end of <currency> should stick with the quantity
        cur2Id = cur2Id.substring(0, cur2Id.length - 1);
      }

      const quantityMatch = rest.match(ValueExpressionParser.QUANTITY_REGEX_FULL);
      if (!quantityMatch) {
        return new AmountParseError(`Invalid quantity format in "${rateExpr}"`, rateExpr);
      }

      quantityStr = quantityMatch[0];
    }

    const cur2 = this.currencyProvider.getOrCreateCurrencyById(cur2Id);
    const rate = Rational.parse(quantityStr); // assume by this point the quantity string has valid syntax

    this.currencyConversionService.registerConversion(cur1, cur2, rate, date);

    return Ok;
  }
}
