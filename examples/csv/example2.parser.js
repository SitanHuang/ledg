/*
 * a more complicated parser example
 */

delimeter = "|"

dateformat = "MM/DD/YYYY"

default_account = "Expense.Unknown"

bail = true

skip(7)

process(() => {
  if (col(2).match(/Beginning balance/)) {
    add(
      date(col(1)),
      description(col(2)),
      cleared(),
      transfer(
        account("Asset.Personal.Checking"),
        amount(col(4))
      ),
      transfer(
        account("Equity.OpeningBalances")
      )
    )
    return
  }
  if (row.length != 4)
    return
  if (!col(1).length)
    return
  trim()

  if (col(3).indexOf('-') != 0) {
    add(
      date(col(1)),
      description(col(2)),
      cleared(),
      col(1).indexOf('Zelle') ?
        `payee:${col(1).replace(/.+; ()$/, '$1')}` : '',
      transfer(
        account("Asset.Personal.Checking"),
        amount(col(3))
      ),
      transfer(
        account(
          col(2),
          {
            "Zelle": "Income.Zelle",
            "Square Inc": "Income.Square",
            "atm.+deposit": "Income.Deposit.Cash",
            "^check|(mobile.+deposit)": "Income.Deposit.Check",
            "CASHREWARD": "Income.CashReward",
            "Paypal": "Income.Unknown.Paypal",
            "Online Banking": "Income.Unknown.Transfer",
            "KEEP THE CHANGE TRANSFER": "Asset.Personal.Saving",
          },
          "Income.Unknown"
        )
      )
    )
  } else {
    /// TODO: ...
  }
});
