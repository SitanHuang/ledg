const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg budget', () => {
  let ctx = new TestContext();
  before(() => {
    ctx.fw('book.budgets.ledg', `
~ Test
  ;from:"2021-01-01"
  ;to:"2021-02-01"

  ast.boa*\tgoal 0-500
  ast..cash\tgoal 0-600

  Expense.Other.Travel.Uber\t70

  Expense.Essential.Groceries\t200
  Expense.Other.Education\t500
  Expense.Free.Retail.Tech\t600
`);
  });

  it('should not fail', () => {
    ctx
      .ledg('budget', '--budget=Test')
      .status(0);
  });
  after(() => {
    ctx.rm('book.budgets.ledg');
  });
});
