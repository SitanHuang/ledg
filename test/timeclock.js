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
o 2021-01-02 03:10:01 #aaaaaaaa

i 2021-01-01 00:01:00 Expense.B Description
  ;tags:"TAG"
O 2021-01-01 00:02:00
`
)
      .ledg('accounts', '-F-', '--debug')
      .status(0)
  });

  after(() => {
    ctx.rm('book.config.ledg');
  })
});
