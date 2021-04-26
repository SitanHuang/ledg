const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg register', () => {
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
2021-01-01 asdf #afssssf1
  ;tags:"A2"
  \ta.b\t1r
  \ta.c\t1r
  \tbal\t-2r
2021-01-02 asdf #afssssf2
  ;tags:"A2"
  \ta.b\t1r
  \ta.c\t1r
  \tbal\t-2r
2021-02-01 asdf #afssssf3
  ;tags:"A2"
  \ta.b\t1r
  \ta.c\t1r
  \tbal\t-2r
2021-03-01 asdf #afssssf4
  ;tags:"A2"
  \ta.b\t1r
  \ta.c\t1r
  \tbal\t-2r
`
    );
    ctx.fw('prices',
`
P 2021-01-01 r $1
P 2021-02-01 r $2
P 2021-03-01 r $3
; comment
`
    );
  });

  it('Should group based on time period', () => {
    ctx
      .ledg('register', '--monthly',
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.b")
      .skip(`"20`)
      .out(
        '"2021-01-01","a.b","r+2","r2"\n' +
        '"2021-02-01","a.b","r+1","r3"\n'
      )
  });
  it('Should group with --hz=false', () => {
    ctx
      .ledg('register', '--monthly', "--hz=false",
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.b")
      .skip(`"20`)
      .out(
        '"2020-12-01","","0","0"\n' +
        '"2021-01-01","a.b","r+2","r2"\n' +
        '"2021-02-01","a.b","r+1","r3"'
      )
  });
  it('Should group with --currency and --depth', () => {
    ctx
      .ledg('register', '--monthly', "--hz=false", "--currency=$", "--depth=1",
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.")
      .skip(`"20`)
      .out(
        '"2020-12-01","","0","0"\n' +
        '"2021-01-01","a","+4","4"\n' +
        '"2021-02-01","a","+4","8"'
      )
      .ledg('register', '--monthly', "--hz=false", "--currency=$", "--depth=3",
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.")
      .skip(`"20`)
      .out(
        '"2020-12-01","","0","0"\n' +
        '"2021-01-01","a.b","+2","2"\n' +
        '"2021-01-01","a.c","+2","4"\n' +
        '"2021-02-01","a.b","+2","6"\n' +
        '"2021-02-01","a.c","+2","8"'
      )
  });
  it('Should group with --currency and --valuation-date', () => {
    ctx
      .ledg('register', '--monthly', "--currency=$", "--depth=1",
            '--valuation-date=2021-03-01',
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.b")
      .skip(`"20`)
      .out(
        '"2021-01-01","a","+6","6"\n' +
        '"2021-02-01","a","+3","9"'
      )
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});

