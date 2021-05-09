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
  \tincome.z\t-1$
  \texpense.a\t1$
2021-02-01 asdf #afssssf3
  ;bookClose:true
  ;tags:"A2"
  \tincome.z\t-0.5$
  \tincome.z.a\t-0.0011111$
  \tincome.b\t-1$
  \texpense.a\t1.4011111$
  \tasset.cash\t0.1$
2021-12-31 bar #afssssf4
  ;virt:true
  ;tags:"A1,A2"
  \tincome.a.a\t-1r
  \tincome.b.a\t-2r
  \texpense.c\t3r
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

  it('should convert currency at date of entry', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--sbc', '--currency=r', '--dp=10')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.z","r+0.9009009009","0"\n' +
        '"","r+0.9009009009","0"\n' +
        '"Expenses","",""\n' +
        '"expense.a","r0.9009009009","0"\n' +
        '"","r0.9009009009","0"\n' +
        '"  Net","0","0"'
      )
  });
  it('should convert currency at --valuation-date', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--sbc', '--currency=r', '--dp=1',
            '--valuation-date=3000-01-01')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.z","r+0.2","0"\n' +
        '"","r+0.2","0"\n' +
        '"Expenses","",""\n' +
        '"expense.a","r0.2","0"\n' +
        '"","r0.2","0"\n' +
        '"  Net","0","0"'
      )
  });

  it('should skip book close and --dp', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--dp=0')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.z","+1","0"\n' +
        '"","+1","0"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","0"\n' +
        '"","1","0"\n' +
        '"  Net","0","0"'
      )
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=10')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.b","0","+1.00"\n' +
        '"income.z","+1.00","+0.50"\n' +
        '"income.z.a","0","+0.0011111"\n' +
        '"","+1.00","+1.5011111"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1.00","1.4011111"\n' +
        '"","1.00","1.4011111"\n' +
        '"  Net","0","+0.10"'
      )
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.b","0","+1"\n' +
        '"income.z","+1","+1"\n' +
        '"income.z.a","0","+0"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"  Net","0","+0"'
      );
  });

  it('should --max-depth', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.b","0","+1"\n' +
        '"income.z","+1","+1"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"  Net","0","+0"'
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
        '"  Net","0","+0"'
      );
  });
  it('should --sum-parent and --max-depth', () => {
   ctx
     .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=1', '--sum-parent')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income","+1","+2"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense","1","1"\n' +
        '"","1","1"\n' +
        '"  Net","0","+0"'
      )
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2', '--sum-parent')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income","+1","+2"\n' +
        '"income.b","0","+1"\n' +
        '"income.z","+1","+1"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense","1","1"\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"  Net","0","+0"'
      );
  });
  it('should --sort', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2', '--sort')
      .skip('"Income","",""\n')
      .out(
        '"Income","",""\n' +
        '"income.z","+1","+1"\n' +
        '"income.b","0","+1"\n' +
        '"","+1","+2"\n' +
        '"Expenses","",""\n' +
        '"expense.a","1","1"\n' +
        '"","1","1"\n' +
        '"  Net","0","+0"'
      )
  });
  it('should --sort and --hide-zero', () => {
    ctx
      .ledg('incomestatement', 'from:2021-12-01', 'to:2022-02-01',
            '--hide-zero=false',
            '--monthly', '--sbc=false', '--dp=0')
      .skip('"Income",""')
      .out(
        '"Income","",""\n' +
        '"income","0","0"\n' +
        '"income.a","0","0"\n' +
        '"income.a.a","r+1","0"\n' +
        '"income.b","0","0"\n' +
        '"income.b.a","r+2","0"\n' +
        '"income.z","0","0"\n' +
        '"income.z.a","0","0"\n' +
        '"","r+3","0"\n' +
        '"Expenses","",""\n' +
        '"expense","0","0"\n' +
        '"expense.a","0","0"\n' +
        '"expense.c","r3","0"\n' +
        '"","r3","0"\n' +
        '"  Net","0","0"'
      )
      .ledg('incomestatement', 'from:2021-12-01', 'to:2022-02-01',
            '--hide-zero=false',
            '--monthly', '--sbc=false', '--sort', '--dp=0')
      .skip('"Income",""')
      .out(
        '"Income","",""\n' +
        '"income.b.a","r+2","0"\n' +
        '"income.a.a","r+1","0"\n' +
        '"income","0","0"\n' +
        '"income.a","0","0"\n' +
        '"income.b","0","0"\n' +
        '"income.z","0","0"\n' +
        '"income.z.a","0","0"\n' +
        '"","r+3","0"\n' +
        '"Expenses","",""\n' +
        '"expense.c","r3","0"\n' +
        '"expense","0","0"\n' +
        '"expense.a","0","0"\n' +
        '"","r3","0"\n' +
        '"  Net","0","0"'
      )
  });
  it('should --sort and --avg', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2', '--sort', '--avg')
      .skip('"Income",""')
      .out(
        '"Income","","",""\n' +
        '"income.z","+1","+1","+1"\n' +
        '"income.b","0","+1","+1"\n' +
        '"","+1","+2","+1"\n' +
        '"Expenses","","",""\n' +
        '"expense.a","1","1","1"\n' +
        '"","1","1","1"\n' +
        '"  Net","0","+0","+0"'
      )
  });
  it('should apply account filter', () => {
    ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--skip-book-close=false', '--dp=0',
            '--max-depth=2', '--sort', '--avg', 'inc.z|exp.a')
      .skip('"Income",""')
      .out(
        '"Income","","",""\n' +
        '"income.z","+1","+1","+1"\n' +
        '"","+1","+1","+1"\n' +
        '"Expenses","","",""\n' +
        '"expense.a","1","1","1"\n' +
        '"","1","1","1"\n' +
        '"  Net","0","-1","0"'
      )
  });

  describe('tree', () => {
    it('should not fail', () => {
      ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--tree', '--sbc=false')
      .skip('"Income",""')
      .out(
        '"Income","",""\n' +
        '" income","0","0"\n' +
        '"   b","0","+1.00"\n' +
        '"   z","+1.00","+0.50"\n' +
        '"     a","0","+0.00"\n' +
        '"","+1.00","+1.50"\n' +
        '"Expenses","",""\n' +
        '" expense","0","0"\n' +
        '"   a","1.00","1.40"\n' +
        '"","1.00","1.40"\n' +
        '"  Net","0","+0.10"'
      )
    });

    it('should --sum-parent', () => {
      ctx
      .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
            '--monthly', '--tree', '--sbc=false', '--sp')
      .skip('"Income",""')
      .out(
        '"Income","",""\n' +
        '" income","+1.00","+1.50"\n' +
        '"   b","0","+1.00"\n' +
        '"   z","+1.00","+0.50"\n' +
        '"     a","0","+0.00"\n' +
        '"","+1.00","+1.50"\n' +
        '"Expenses","",""\n' +
        '" expense","1.00","1.40"\n' +
        '"   a","1.00","1.40"\n' +
        '"","1.00","1.40"\n' +
        '"  Net","0","+0.10"'
      )
    });

    it('should --sort', () => {
      ctx
        .ledg('incomestatement', 'from:2021-01-01', 'to:2021-03-01',
              '--monthly', '--tree', '--sbc=false', '--sort')
        .skip('"Income",""')
        .out(
          '"Income","",""\n' +
          '" income","0","0"\n' +
          '"   z","+1.00","+0.50"\n' +
          '"     a","0","+0.00"\n' +
          '"   b","0","+1.00"\n' +
          '"","+1.00","+1.50"\n' +
          '"Expenses","",""\n' +
          '" expense","0","0"\n' +
          '"   a","1.00","1.40"\n' +
          '"","1.00","1.40"\n' +
          '"  Net","0","+0.10"'
        )
        .ledg('incomestatement', 'from:2021-12-01', 'to:2022-02-01',
              '--monthly', '--tree', '--sbc=false', '--sort', '--dp=0')
        .skip('"Income",""')
        .out(
          '"Income","",""\n' +
          '" income","0","0"\n' +
          '"   a","0","0"\n' +
          '"     a","r+1","0"\n' +
          '"   b","0","0"\n' +
          '"     a","r+2","0"\n' +
          '"","r+3","0"\n' +
          '"Expenses","",""\n' +
          '" expense","0","0"\n' +
          '"   c","r3","0"\n' +
          '"","r3","0"\n' +
          '"  Net","0","0"'
        )
    });
    it('should --sort and --sum-parent', () => {
      ctx
        .ledg('incomestatement', 'from:2021-12-01', 'to:2022-02-01', '--sp',
              '--monthly', '--tree', '--sbc=false', '--sort', '--dp=0')
        .skip('"Income",""')
        .out(
          '"Income","",""\n' +
          '" income","r+3","0"\n' +
          '"   b","r+2","0"\n' +
          '"     a","r+2","0"\n' +
          '"   a","r+1","0"\n' +
          '"     a","r+1","0"\n' +
          '"","r+3","0"\n' +
          '"Expenses","",""\n' +
          '" expense","r3","0"\n' +
          '"   c","r3","0"\n' +
          '"","r3","0"\n' +
          '"  Net","0","0"'
        )
    });
    it('should -%', () => {
      ctx
        .ledg('incomestatement', 'from:2021-12-01', 'to:2022-02-01', '--sp',
              '--monthly', '--tree', '--sbc=false', '--sort', '--dp=2', '-%')
        .skip('"Income",""')
        .out(
          '"Income","",""\n' +
          '" income","100.00 %","0"\n' +
          '"   b","66.67 %","0"\n' +
          '"     a","66.67 %","0"\n' +
          '"   a","33.33 %","0"\n' +
          '"     a","33.33 %","0"\n' +
          '"","r+3.00","0"\n' +
          '"Expenses","",""\n' +
          '" expense","100.00 %","0"\n' +
          '"   c","100.00 %","0"\n' +
          '"","r3.00","0"\n' +
          '"  Net","0","0"'
        )
    });
  });

  after(() => {
    ctx.rm('book.2021.ledg').rm('book.config.ledg').rm('prices');
  });
});
