const fs = require("fs");
const assert = require("assert");
const { TestContext } = require("./utils/exec");

describe('Test environment', () => {
  let ctx = new TestContext();

  it('Should have tmp foldier', () => {
    assert(fs.existsSync(ctx.root), 'test/tmp/ exists');
  });
  it('Should have ledg binary', () => {
    assert(fs.existsSync(ctx.ledg_bin), 'ledg binary exists');
  });
});

require("./accounts/basic");