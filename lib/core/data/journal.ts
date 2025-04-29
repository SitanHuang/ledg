// import { Transaction } from "../accounting/transaction.ts";
import { BalanceAssertionService } from "../accounting/balanceAssertionService.ts";
import { AccountManager, DefaultAccountManager } from "../accounting/accountManager.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { DefaultTransactionStore, TransactionStore } from "./transactionStore.ts";
import { TransactionAutoBalancer } from "../accounting/transactionAutoBalancer.ts";
import { Configuration } from "../config/config.ts";
import { CommitRegistry } from "./commitRegistry.ts";
import { ValueExpressionParser } from "../parsing/valueExpressionParser.ts";
import { TransactionValidationService } from "../accounting/transactionValidationService.ts";

export class Journal {

  commitRegistry: CommitRegistry;

  accountManager: AccountManager;

  currencyProvider: CurrencyProvider;
  currencyConversionService: CurrencyConversionService;

  transactionStore: TransactionStore;

  balanceAssertionService: BalanceAssertionService;
  transactionAutoBalancer: TransactionAutoBalancer;
  transactionValidationService: TransactionValidationService;

  valueExpressionParser: ValueExpressionParser;


  configuration: Configuration = new Configuration();


  static create() {
    return new Journal();
  }


  protected constructor() {
    this.commitRegistry = new CommitRegistry();

    this.accountManager = new DefaultAccountManager();

    this.currencyProvider = new CurrencyProvider(this.configuration.valuationConfig);
    this.currencyConversionService = new CurrencyConversionService();

    this.transactionStore = new DefaultTransactionStore();

    this.balanceAssertionService = new BalanceAssertionService(this.transactionStore);
    this.transactionAutoBalancer = new TransactionAutoBalancer(
      this.currencyConversionService,
      this.currencyProvider,
      this.configuration.valuationConfig
    );
    this.transactionValidationService = new TransactionValidationService(
      this.currencyConversionService,
      this.configuration.valuationConfig
    );

    this.valueExpressionParser = new ValueExpressionParser();
  }
}