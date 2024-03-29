const cp = require('child_process');
const fs = require('fs');
const assert = require("assert");

class TestContext {
  constructor() {
    this._env = { HOME: process.cwd(), PATH: process.env.PATH };
    // project path
    this.cwd = this._env.HOME + '/';

    // mock root
    this.root = this.cwd + 'test/tmp/';

    // ledg binary
    this.ledg_bin = this.cwd + 'bin/ledg';
  }

  get env() {
    return { ...this._env };
  }

  get args() {
    return ["-F" + this.root + "book", "--csv", "-y", "-W", "--no-config"];
  }

  fw(name, content) {
    fs.writeFileSync(this.root + name, content.toString());
    return this;
  }

  ledg(...args) {
    this._process = cp.spawnSync(this.ledg_bin, this.args.concat(args), this._modExecOpts({}));

    if (this._process.stderr.length > 0 && this._debug) {
      console.error(`Command: ${this.ledg_bin} ${this.args.concat(args).join(' ')}`);
      console.error(`Stdin: ${this._input.toString()}`);
      console.error(`Stdout: ${this._process.stdout.toString()}`);
    }

    assert(this._process.stderr.length == 0, "Exited with stderr: " + this._process.stderr);

    return this;
  }

  toggleDebug() {
    this._debug = !this._debug;
    return this;
  }

  ledgErr(...args) {
    this._process = cp.spawnSync(this.ledg_bin, this.args.concat(args), this._modExecOpts({}));
    return this;
  }

  input(str) {
    this._input = str;
    return this;
  }

  skip(start) {
    let s = this._process.stdout.toString().trim().split(start);
    if (s.length > 1)
      this._process.stdout = start + s.slice(1).join(start);
    return this;
  }

  out(str) {
    assert.strictEqual(this._process.stdout.toString().trim(), str.trim(), "Output does not match");
    return this;
  }

  errContains(str) {
    assert(this._process.stderr.toString().indexOf(str) >= 0, "Error output does not match");
    return this;
  }

  status(s=0) {
    assert.strictEqual(this._process.status, s, "Exit code must be " +s);
    return this;
  }

  fr(name, callback) {
    callback(fs.readFileSync(name).toString);
    return this;
  }

  rm(name) {
    fs.unlinkSync(this.root + name);
    return this;
  }

  clean() {
    const files = fs.readdirSync(this.root);
    for (const file of files)
      fs.rmSync(file);
    return this;
  }

  _modExecOpts(opts) {
    return Object.assign(opts, {
      cwd: this.root,
      env: this.env,
      input: this._input || undefined
    });
  }
}

module.exports = { TestContext: TestContext };
