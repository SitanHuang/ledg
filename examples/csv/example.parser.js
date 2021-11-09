// this is a custom csv parser file
// to execute: ledg import --parser=example.parser.js --source=example.csv

// ======  optional settings =====
delimeter = ","

dateformat = "D/M/YY"
// or many formats such as ["YYYY-MM-DD", "M/D/YY"]

default_account = "Expense.Unknown"

// if error, stop
bail = true

skip(3)

process(() => {
  // or trim(colNumber)
  trim()

  // arguments to call `ledg add ...`
  if (row.length != 3)
    return
  if (!col(1).length) {
    skip(Infinity)
    return
  }

  add(
    date(col(1)),
    description(col(3)),
    cleared(), // or pending()
    modifier("tags", "IMPORTED"),
    transfer(
      /* categorize accounts
       *
       * Another useful example:
       * account(col(6) || default_account) // if col 6 is empty, use default
       */
      account(
        col(3),
        {
          // regex => acc
          "hats": "Expense.Clothes",
          "insurance": "Expense.Insurance"
        }
      ),
      amount(col(2))
    ),
    transfer(
      account("Asset.Bank.Foolbar"),
      invert(amount(col(2)))
    )
  )
})
