const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('ledg count', () => {
  let ctx = new TestContext();
  before(() => {
    ctx.fw('book.config.ledg', `
    {
      "data": {
        "accounts": {}
      }
    }
    `);
    ctx.fw('book.2011.ledg',
`
2011-01-01 asdf #afssssf1
  add rmb\ta.a\t1r
  \tbal\t
2011-01-01 asdf #afssssf1
  add rmb\ta.a\t1r
  \tbal\t
2011-01-01 asdf #afssssf2
  ;virt:true
  filterTransDesc rmb\ta.a\t1r
  \tbal\t
`
    );
    ctx.fw('book.2021.ledg',
`
2021-01-01 ! asdf #afssssf3
  ;tags:"A2"
  add rmb\ta.b\t1r
  \tbal\t
2021-05-01 bar #afssssf4
  ;virt:true
  ;tags:"A1,A2"
  add rmb\ta.b\t1r
  \tbal\t
`
    );
  });

  it('should show zero when none', () => {
    ctx
      .ledg('count', '-F-')
      .out('0');
  });
  it('should --test', () => {
    ctx
      .ledg('count', '--test=transfers.filter(x => x[0].match(/transdesc/i)).length')
      .out('1');
  });
  it('should count all', () => {
    ctx
      .ledg('count')
      .out('5');
  });
  it('should count --real and virt:true', () => {
    ctx
      .ledg('count', '--real')
      .out('3')
      .ledg('count', 'virt:true')
      .out('2');
  });
  it('should count --cleared and pending:true', () => {
    ctx
      .ledg('count', '--cleared')
      .out('4')
      .ledg('count', 'pending:true')
      .out('1');
  });
  it('should count tags', () => {
    ctx
      .ledg('count', '+A1', '--real')
      .out('0')
      .ledg('count', '+A2')
      .out('2')
      .ledg('count', '+A2', '--real')
      .out('1')
      .ledg('count', '+A1', 'virt:true')
      .out('1')
      .ledg('count', '+A1', 'A2')
      .out('1');
  });
  it('should count with desc:', () => {
    ctx
      .ledg('count', 'desc:bar')
      .out('1')
  });
  it('should count with from: and to:', () => {
    ctx
      .ledg('count', 'from:2021-01-01')
      .out('2')
      .ledg('count', 'from:2021-01-02')
      .out('1')
      .ledg('count', 'to:2019-05-01')
      .out('3')
      .ledg('count', 'to:2019-05-01', 'from:2010-01-01')
      .out('3')
  });

  after(() => {
    ctx.rm('book.2011.ledg').rm('book.2021.ledg').rm('book.config.ledg');
  });
});
