import { Amount, AmountFormatOptions } from "../core/accounting/amount.ts";
import { Rational, RationalFormatOptions } from "../core/math/rational.ts";
import { Currency } from "../core/valuation/currency.ts";
import { CurrencyProvider } from "../core/valuation/currencyProvider.ts";
import { JoinedEmbeddable } from "./embeddable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";

export class AmountDisplayPolicy extends AmountFormatOptions {
  showDefaultCurrency = false;

  positiveIsGreen = true;

  constructor(
    public readonly currencyProvider: CurrencyProvider,
    opts: RationalFormatOptions = {}
  ) {
    super(Object.assign({ nullPlaceholder: '0' }, opts));
    Object.assign(this, opts);
  }

  override getPolicy(currency: Currency): AmountFormatOptions {
    const opts = super.getPolicy(currency);
    if (
      this.showDefaultCurrency === false &&
      currency.id == this.currencyProvider.valuationConfig.defaultCurrencyCode
    ) {
      opts.currencyCode = 'none';
    }
    return opts;
  }
}

export class AmountSpan extends JoinedEmbeddable {
  constructor(
    public readonly amount: Amount,
    public displayPolicy: AmountDisplayPolicy,
  ) {
    super([...JoinedEmbeddable.join(
      amount.toContentsArray(displayPolicy).map(content => {
        const stylable = new Stylable(new Span(content.displayedString));

        if (content.rational.gt(Rational.ZERO)) {
          stylable.color(displayPolicy.positiveIsGreen ? 'green' : 'redBright');
        } else if (content.rational.lt(Rational.ZERO)) {
          stylable.color(displayPolicy.positiveIsGreen ? 'redBright' : 'green');
        }

        return stylable;
      })
    ).join(", ").deconstruct()]);
  }
}