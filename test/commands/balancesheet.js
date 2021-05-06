const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg balancesheet', () => {
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
2021-01-01 asdf #afssssf2
  ;bookClose:true
  \tasset.cash\t1R
  \tliability.cc\t-1$
2021-01-01 asdf #afssssf3
  \tasset.cash\t1R
  \tliability.cc\t-1R
`
    );
    ctx.fw('prices',
`
P 2021-01-01 R $1
P 2021-01-02 R $2
P 2021-02-01 R $3
`
    );
  });

  it('Should bring up historical balance', () => {
    ctx
      .ledg('balancesheet', 'f:2022-01-01', 't:2022-02-01')
      .skip('"Assets","')
      .out(
        '"Assets",""\n' +
        '"asset.cash","R1.00"\n' +
        '"","R1.00"\n' +
        '"Liabilities",""\n' +
        '"liability.cc","R1.00"\n' +
        '"","R1.00"\n' +
        '"  Net","0"'
      )
  });
  it('Should --currency at date of entry', () => {
    ctx
      .ledg('balancesheet', 'f:2022-01-01', 't:2022-02-01', '--currency=$')
      .skip('"Assets","')
      .out(
        '"Assets",""\n' +
        '"asset.cash","1.00"\n' +
        '"","1.00"\n' +
        '"Liabilities",""\n' +
        '"liability.cc","1.00"\n' +
        '"","1.00"\n' +
        '"  Net","0"'
      )
  });
  it('Should --valuation-date', () => {
    ctx
      .ledg('balancesheet', 'f:2022-01-01', 't:2022-02-01', '--currency=$',
            '--valuation-date=2021-01-02')
      .skip('"Assets","')
      .out(
        '"Assets",""\n' +
        '"asset.cash","2.00"\n' +
        '"","2.00"\n' +
        '"Liabilities",""\n' +
        '"liability.cc","2.00"\n' +
        '"","2.00"\n' +
        '"  Net","0"'
      )
  });
  it('Should --valuation-eop', () => {
    ctx
      .ledg('balancesheet', 'f:2021-01-01', 't:2021-03-01', '--currency=$',
            '--valuation-eop')
      .skip('"Assets","')
      .out(
        '"Assets","",""\n' +
        '"asset.cash","2.00","3.00"\n' +
        '"","2.00","3.00"\n' +
        '"Liabilities","",""\n' +
        '"liability.cc","2.00","3.00"\n' +
        '"","2.00","3.00"\n' +
        '"  Net","0","0"'
      )
  });
  it('Should --sbc=false and --valuation-eop', () => {
    ctx
      .ledg('balancesheet', 'f:2021-01-01', 't:2021-03-01', '--currency=$',
            '--valuation-eop', '--sbc=false', 'afssssf2')
      .skip('"Assets","')
      .out(
        '"Assets","",""\n' +
        '"asset.cash","2.00","3.00"\n' +
        '"","2.00","3.00"\n' +
        '"Liabilities","",""\n' +
        '"liability.cc","1.00","1.00"\n' +
        '"","1.00","1.00"\n' +
        '"  Net","1.00","2.00"'
      )
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});

