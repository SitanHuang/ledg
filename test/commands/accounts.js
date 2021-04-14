const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg accounts', () => {
  let ctx = new TestContext();

  before(() => {
    ctx.fw('book.config.ledg', `
    {
      "data": {
        "accounts": {},
        "defaultCurrency": "R",
        "priceFiles": [ "prices" ]
      }
    }
    `);
    ctx.fw('book.2011.ledg', 
`
2011-01-01 asdf #afssssfa
  add rmb\ta.a\t1r
  \tbal\t
`
    );
    ctx.fw('book.2021.ledg', 
`
2021-01-01 asdf #afssssfa
  add rmb\ta.b\t1r
  \tbal\t
`
    );
    ctx.fw('prices',
`
P 2010-01-01 R $1
P 2020-01-01 R $2 
P 3000-01-01 R $4
P 0000-01-01 r 1R
; comment
`
    );
  });

  const content = 
`
2020-01-01 foo #aaaaaaaa
  ;virt:true
  \ta.aa\t123USD
  \ta.aa\t0.12345USD
`;

  it('Should output headers', () => {
    ctx
      .ledg('accounts', '-F-')
      .out(`"Accounts","Balance"`);
  });
  it('Should emit error when imbalanced', () => {
    assert.throws(() => {
      ctx
        .input(content)
        .ledg('accounts', '-F-');
    }, { message: /imbalance.+-123\.12345/i });
  });
  it('Should balance last posting', () => {
    let o = 
`
"Accounts","Balance"
"a.aa","USD123.12345"
"b","USD-123.12345"
`;
    ctx
      .input(content + '\n  \tb')
      .ledg('accounts', '-F-')
      .out(o)
      .input(content + '\n  \tb\t')
      .ledg('accounts', '-F-')
      .out(o)
  });

  it('Should create Imbalance with -Wimbalanced-entries', () => {
    ctx
      .input(content)
      .ledg('accounts', '-F-', '--dp=4', '-Wimbalanced-entries')
      .out(
`
"Accounts","Balance"
"a.aa","USD123.1235"
"Imbalance","USD-123.1235"
`
      )
  });

  it('Should filter account with --sum and --dp', () => {
    ctx
      .input(content + '\n  \tb.a')
      .ledg('accounts', '-F-', '--dp=2', '--sum', 'b$')
      .out(
`
"Accounts","Balance"
"Sum","0"
`
      )
      .ledg('accounts', '-F-', '--dp=1', '--sum', 'b.$')
      .out(
`
"Accounts","Balance"
"b.a","USD-123.1"
"Sum","USD-123.1"
`
      )
  });

  it('Should --sort amounts then account name', () => {
    ctx
      .input(content + '\n  \tz\tUSD-1\n  \tde\tUSD1\n  \tda')
      .ledg('accounts', '-F-', '--sum', '--dp=0', '--sort')
      .out(
`
"Accounts","Balance"
"a.aa","USD123"
"de","USD1"
"z","USD-1"
"da","USD-123"
"Sum","0"
`
      )
  });

  it('Should sort based on account name', () => {
    ctx
      .input(content + '\n  \tz\tUSD-1\n  \tde\tUSD1\n  \tda')
      .ledg('accounts', '-F-', '--sum', '--dp=0')
      .out(
`
"Accounts","Balance"
"a.aa","USD123"
"da","USD-123"
"de","USD1"
"z","USD-1"
"Sum","0"
`
      )
  });

  it('Should --sum-parent --hz with multicurrency', () => {
    ctx
      .input(content + '\n  \ta._\t0\n  \tz\tUSD-1\n  \td.a.e\tUSD1\n  \ta.a1\tRMB1\n  \ta.b\t-1RMB\n  \td.a')
      .ledg('accounts', '-F-', '--sp', '--dp=0','--hz=false')
      .out(
`
"Accounts","Balance"
"a","USD123"
"a._","0"
"a.a1","RMB1"
"a.aa","USD123"
"a.b","RMB-1"
"d","USD-122"
"d.a","USD-122"
"d.a.e","USD1"
"z","USD-1"
`
      )
      .ledg('accounts', '-F-', '--sp', '--dp=0','--hz')
      .out(
`
"Accounts","Balance"
"a","USD123"
"a.a1","RMB1"
"a.aa","USD123"
"a.b","RMB-1"
"d","USD-122"
"d.a","USD-122"
"d.a.e","USD1"
"z","USD-1"
`
      )
  });

  it('Should produce tree view with --hz --sum-parent', () => {
    ctx
      .ledg('accounts', 'tree', '-F-', '--hz', '--dp=0')
      .out(
`
"Accounts","Balance"
"├a","0"
"│  ├a1","RMB1"
"│  ├aa","USD123"
"│  └b","RMB-1"
"├d","0"
"│  └a","USD-123"
"│     └e","USD1"
"└z","USD-1"
`
      )
      .ledg('accounts', 'tree', '-F-', '--hz', '--sum-parent', '--dp=0')
      .out(
`
"Accounts","Balance"
"├a","USD123"
"│  ├a1","RMB1"
"│  ├aa","USD123"
"│  └b","RMB-1"
"├d","USD-122"
"│  └a","USD-122"
"│     └e","USD1"
"└z","USD-1"
`
      )
  });

  it('Should convert --currency and --max-depth at today\'s rates', () => {
    ctx
    .ledg('accounts', '--currency=$', '--max-depth=1')
    .skip('"Accounts","Balance"')
    .out(
`
"Accounts","Balance"
"a","$4.00"
"bal","$-4.00"
`
    )
    .ledg('accounts', '--currency=$')
    .out(
`
"Accounts","Balance"
"a.a","$2.00"
"a.b","$2.00"
"bal","$-4.00"
`
      )
  });

  it('Should convert --currency and --max-depth at valuation date', () => {
    ctx
      .ledg('accounts', '--currency=$', '--valuation-date=2010-01-01')
      .out(
`
"Accounts","Balance"
"a.a","$1.00"
"a.b","$1.00"
"bal","$-2.00"
`
      )
      .ledg('accounts', '--currency=$', '--valuation-date=3010-01-01')
      .out(
`
"Accounts","Balance"
"a.a","$4.00"
"a.b","$4.00"
"bal","$-8.00"
`
      )
  });
  it('Should filter from: and to:', () => {
    ctx
      .ledg('accounts', '--currency=$', 'from:2015-01-01')
      .skip('"Accounts","Balance"')
      .out(
`
"Accounts","Balance"
"a.b","$2.00"
"bal","$-2.00"
`
      )
      .ledg('accounts', '--currency=$', 'from:2010-01-01', 'to: 2015-01-01')
      .skip('"Accounts","Balance"')
      .out(
`
"Accounts","Balance"
"a.a","$2.00"
"a.b","$2.00"
"bal","$-4.00"
`
      )
  });

  after(() => {
    ctx.rm('prices').rm('book.config.ledg').rm('book.2021.ledg').rm('book.2011.ledg');
  })
});