const { TestContext } = require("./utils/exec.js");
const assert = require("assert");

describe('ledg timeclock', () => {
  let ctx = new TestContext();

  before(() => {
    ctx.fw('book.config.ledg', `
      {
        "data": {
          "accounts": {},
          "defaultCurrency": "R",
          "timeclock": {
            "income": "Income.Time",
            "expense": "Expense.Test"
          }
        }
      }
    `);
  });

  it('should parse', () => {
    ctx
      .input(
`
i 2021-01-01 00:00:00
i 2021-01-01 00:01:00 Expense.A
o 2021-01-01 03:10:01 #aaaaaaaa

i 2021-01-01 00:01:00 Expense.B Description
O 2021-01-01 00:02:00
  ;tags:"TAG"
`
)
      .ledg('accounts', '-F-', '--csv-no-quotes', '--dp=0', '--right')
      .skip("Exp")
      .out(
`
Expense,3h, 10m, 1s
Expense.A,3h, 9m, 1s
Expense.B,1m
Income,-6h, -20m, -2s
`
      )
      .status(0)
  });

  after(() => {
    ctx.rm('book.config.ledg');
  })
});
