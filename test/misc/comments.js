const { TestContext } = require("../utils/exec.js");
const assert = require("assert");

describe('config file comments', () => {
  let ctx = new TestContext();

  before(() => {
  });

  it('should recognize config comments', () => {
    ctx.fw('book.config.ledg', `
    # comment style 1
    ! comment style 2
; comment style 3
    {
      // c-style comment 1
      /* c-style comment 2
       *
       */
      "data": {
        // "test": , 1
        "accounts": {},
        "defaultCurrency": "R",
        "priceFiles": [ "pri/*ces*/" ]
      }
    }
    `);

    ctx
      .ledgErr('accounts')
      .errContains(`pri/*ces*/ is not found`);
      // which means JSON was succesfully parsed
  });

  it('should recognize illegal config comments', () => {
    ctx.fw('book.config.ledg', `
    @{
      "data": {
        // "test": , 1
        "accounts": {},
        "defaultCurrency": "R",
        "priceFiles": [ "pri/*ces*/" ]
      }
    }
    `);

    ctx
      .ledgErr('accounts')
      .errContains("Unexpected token");
  });

  after(() => {
    ctx.rm('book.config.ledg');
  })
});
