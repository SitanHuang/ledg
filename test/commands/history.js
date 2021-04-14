const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg history', () => {
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
  ;tags:"A2"
  \ta.b\t1r
  \tbal\t-1r
2021-01-01 asdf #afssssf3
  ;tags:"A2"
  \tbn\t1$
  \tbn.a\t-1$
2021-01-01 asdf #afssssf3
  ;bookClose:true
  ;tags:"A2"
  \tbn\t1$
  \tbn.a\t-1$
2021-12-31 bar #afssssf4
  ;virt:true
  ;tags:"A1,A2"
  \ta.b\t1r
  \tbal\t-1r
2022-01-01 bar #afssssf5
  ;virt:true
  ;tags:"A1,A2"
  \ta.b\t1r
  \tbal\t-1r
`
    );
    ctx.fw('prices',
`
P 2021-01-01 R $1
P 2021-12-31 R $2
P 2022-01-01 R $4
P 3000-01-01 R $5
P 0000-01-01 r 1R
; comment
`
    );
  });

  it('Should --skip-book-close', () => {
    ctx
      .ledg('history', '--yearly', 'from:2021-01-01', 'to:2022-01-01', 'a.b', 'bal$', 'bn$', '--dp=0')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","January","≥ 1","r2","r-2","1"'
      )
      .ledg('history', '--yearly', 'from:2021-01-01', 'to:2022-01-01', 'a.b', 'bal$', 'bn$', '--dp=0', '--sbc=false')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","January","≥ 1","r2","r-2","2"'
      );
  });
  it('Should filter UUID', () => {
    ctx
      .ledg('history', '--yearly', 'from:2021-01-01', 'to:2022-01-01', 'a.b', 'afssssf4', '--dp=0', '--currency=R')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b"\n' +
        '"2021","January","≥ 1","R1"'
      );
  });
  it('Should filter --real', () => {
    ctx
      .ledg('history', '--yearly', 'from:2021-01-01', 'to:2022-01-01', 'a.b', '--real', '--dp=0', '--currency=R')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b"\n' +
        '"2021","January","≥ 1","R1"'
      );
  });
  it('Should convert currency at rate of original entry', () => {
    ctx
      .ledg('history', '--yearly', 'from:2021-01-01', 'to:2022-01-01', '--currency=$', 'a.b', 'bal$', 'bn$', '--dp=0')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","January","≥ 1","3","-3","1"'
      );
  });
  it('Should --skip', () => {
    ctx
      .ledg('history', '--monthly', 'from:2021-01-01', 'to:2022-01-01', '--currency=$', 'a.b', 'bal$', 'bn$', '--dp=0', '--skip=2021-12-01')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","December","≥ 1","2","-2","0"'
      );
  });
  it('Should --skip and --cumulative', () => {
    ctx
      .ledg('history', '--monthly', 'from:2021-01-01', 'to:2022-01-01', '--currency=$', 'a.b', 'bal$', 'bn$', '--dp=0', '--skip=2021-12-01', '--cumulative')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","December","≥ 1","3","-3","1"'
      );
  });
  it('Should --skip and --cumulative-columns', () => {
    ctx
      .ledg('history', '--monthly', 'from:2021-01-01', 'to:2022-01-01', '--currency=$', 'a.b', 'bal$', 'bn$', '--dp=0', '--skip=2021-12-01', '--cumulative-columns=1,2')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","December","≥ 1","3","-3","0"'
      );
  });
  it('Should --invert', () => {
    ctx
      .ledg('history', '--monthly', 'from:2021-01-01', 'to:2022-01-01', '--currency=$', 'a.b', 'bal$', 'bn$', '--dp=0', '--skip=2021-12-01', '--cumulative', '--invert')
      .skip(`"Year"`)
      .out(
        '"Year","Month","Day","A.b","Bal$","Bn$"\n' +
        '"2021","December","≥ 1","-3","3","-1"'
      );
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});
