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
P 2021-01-01 R $1
P 2021-02-01 R $2
P 2021-03-01 R $3
; comment
`
    );
  });

  it('Should group based on time period', () => {
    ctx
      .ledg('register', '--monthly',
            'from:2020-12-01', 'to:2021-03-01', '--dp=0', "a.b")
      .skip(`"2021-01-01"`)
      .out(
        '"2021-01-01","a.b","r+2","r2"\n' +
        '"2021-02-01","a.b","r+1","r3"\n'
      )
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});

