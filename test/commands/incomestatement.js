const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg incomestatement', () => {
  let ctx = new TestContext();
  before(() => {
    ctx.fw('book.config.ledg', `
    {
      "data": {
        "accounts": {},
        "defaultCurrency": "$",
        "priceFiles": [ "prices" ]
      }
    }
    `);
    ctx.fw('book.2021.ledg',
`
2021-01-01 asdf #afssssf3
  ;tags:"A2"
  \tincome.a\t-1$
  \texpense.a\t1$
2021-02-01 asdf #afssssf3
  ;bookClose:true
  ;tags:"A2"
  \tincome.a\t-0.5$
  \tincome.a.a\t-0.0011111$
  \tincome.b\t-1$
  \texpense.a\t1.4011111$
  \tasset.cash\t0.1$
2021-12-31 bar #afssssf4
  ;virt:true
  ;tags:"A1,A2"
  \tincome.b\t-1r
  \texpense.c\t1r
2022-01-01 bar #afssssf5
  ;virt:true
  ;tags:"A1,A2"
  \tincome.b\t-1r
  \texpense.c\t1r
`
    );
    ctx.fw('prices',
`
P 2021-01-01 R $1.11
P 2021-12-31 R $2.22
P 2022-01-01 R $4.44
P 3000-01-01 R $5.55
P 0000-01-01 r 1R
`
    );
  });

  it('Should skip book close and --dp', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--dp=0')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.a","+1","0"\n' +
        '"","+1","0"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","0"\n' +
        '"","1","0"\n' +
        '"Net","0","0"'
      )
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=10')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.a","+1.00","+0.50"\n' +
        '"income.a.a","0","+0.0011111"\n' +
        '"income.b","0","+1.00"\n' +
        '"","+1.00","+1.5011111"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1.00","1.4011111"\n' +
        '"","1.00","1.4011111"\n' +
        '"Net","0","+0.10"'
      )
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.a","+1","+1"\n' +
        '"income.a.a","0","+0"\n' +
        '"income.b","0","+1"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"Net","0","+0"'
      );
  });

  it('Should --max-depth', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.a","+1","+1"\n' +
        '"income.b","0","+1"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"Net","0","+0"'
      )
     .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=1')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income","+1","+2"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense","1","1"\n' +
        '"","1","1"\n' +
        '"Net","0","+0"'
      );
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});
