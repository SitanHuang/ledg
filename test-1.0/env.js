const fs = require("fs");
const assert = require("assert");
const { TestContext } = require("./utils/exec");

describe('Test environment', () => {
  let ctx = new TestContext();

  it('should have tmp foldier', () => {
    assert(fs.existsSync(ctx.root), 'test/tmp/ exists');
  });
  it('should have ledg binary', () => {
    assert(fs.existsSync(ctx.ledg_bin), 'ledg binary exists');
  });
});

require("./misc/comments");

require("./commands/accounts");
require("./commands/count");
require("./commands/history");
require("./commands/budget");
require("./commands/register");
require("./commands/incomestatement");
require("./commands/balancesheet");
