// import { Transaction } from "../accounting/transaction.ts";
import { BalanceAssertionService } from "../accounting/balanceAssertionService.ts";
import { AccountManager, DefaultAccountManager } from "../accounting/accountManager.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { DefaultTransactionStore, TransactionStore } from "./transactionStore.ts";
import { TransactionAutoBalancer } from "../accounting/transactionAutoBalancer.ts";
import { Configuration } from "../config/config.ts";
import { CommitRegistry } from "./commitRegistry.ts";

export class Journal {

  commitRegistry: CommitRegistry;

  accountManager: AccountManager;

  currencyProvider: CurrencyProvider;
  currencyConversionService: CurrencyConversionService;

  balanceAssertionService: BalanceAssertionService;
  transactionAutoBalancer: TransactionAutoBalancer;

  transactionStore: TransactionStore;

  configuration: Configuration = new Configuration();

  create() {
    return new Journal();
  }


  protected constructor() {
    this.commitRegistry = new CommitRegistry();

    this.accountManager = new DefaultAccountManager();

    this.currencyProvider = new CurrencyProvider();
    this.currencyConversionService = new CurrencyConversionService();

    this.balanceAssertionService = new BalanceAssertionService();
    this.transactionAutoBalancer = new TransactionAutoBalancer(
      this.currencyConversionService,
      this.currencyProvider,
      this.configuration.valuationConfig
    );

    this.transactionStore = new DefaultTransactionStore();
  }
}