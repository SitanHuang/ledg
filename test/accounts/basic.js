const { TestContext } = require("../utils/exec.js");

describe('ledg accounts', () => {
  let ctx = new TestContext().clean();

  it('Should output headers', () => {
    ctx
      .ledg('accounts')
      .out(`"Accounts","Balance"`);
  });

  after(() => {
    ctx.clean();
  })
});