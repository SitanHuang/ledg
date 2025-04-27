#!/usr/bin/env node
// benchmark_csv_readers.js
// —————————————————————————————————————————————————————————————————
//
// 1. writeRandomCsv → build a big test file
// 2. FileHandleCSVReader  → low‑level fs.readSync + byte‑scan
// 3. StreamCSVReader      → fs.createReadStream + byte‑scan
// 4. FastBufferReader     → fs.readSync + Buffer.indexOf/subarray
// 5. ReadlineCSVReader    → fs.createReadStream + readline on('line')
//
// Usage: node benchmark_csv_readers.js
// requires Node 12+
// —————————————————————————————————————————————————————————————————

const fs = require('fs');
const { Readable } = require('stream');
const path = require('path');
const readline = require('readline');
const HR2MS = n => Number(n) / 1e6;

// ─── 0. helper to write a random CSV synchronously ──────────────────
function writeRandomCsv(file, rows, cols) {
  const fd = fs.openSync(file, 'w');
  const nl = Buffer.from('\n');
  for (let r = 0; r < rows; ++r) {
    let line = '';
    for (let c = 0; c < cols; ++c) {
      line += (Math.random() * 1e4).toFixed(4);
      if (c < cols - 1) line += ',';
    }
    fs.writeSync(fd, line);
    fs.writeSync(fd, nl);
  }
  fs.closeSync(fd);
}

// ─── 1. FileHandleCSVReader (byte-scan) ─────────────────────────────
class FileHandleCSVReader extends Readable {
  constructor(file, opts = {}) {
    super({ objectMode: true });
    this.fd = fs.openSync(file, 'r');
    this.buf = Buffer.allocUnsafe(opts.highWaterMark || 64 * 1024);
    this.leftover = Buffer.alloc(0);
    this.eof = false;
  }
  _read() {
    if (this.eof) return;
    const bytes = fs.readSync(this.fd, this.buf, 0, this.buf.length, null);
    if (bytes === 0) {
      this.eof = true;
      if (this.leftover.length) this._pushLine(this.leftover);
      fs.closeSync(this.fd);
      return this.push(null);
    }
    this._processChunk(this.buf, bytes);
  }
  _processChunk(chunk, bytes) {
    let start = 0;
    for (let i = 0; i < bytes; ++i) {
      if (chunk[i] === 10 /*\n*/) {
        const line =
          start === i
            ? this.leftover
            : Buffer.concat([this.leftover, chunk.slice(start, i)]);
        this.leftover = Buffer.alloc(0);
        this._pushLine(line);
        start = i + 1;
      }
    }
    if (start < bytes) {
      this.leftover = Buffer.concat([
        this.leftover,
        chunk.slice(start, bytes),
      ]);
    }
  }
  _pushLine(buf) {
    if (!buf.length) return;
    const row = [];
    let ns = 0;
    for (let i = 0; i <= buf.length; ++i) {
      if (i === buf.length || buf[i] === 44 /*,*/) {
        row.push(+buf.toString('utf8', ns, i));
        ns = i + 1;
      }
    }
    this.push(row);
  }
}

// ─── 2. StreamCSVReader (byte-scan) ─────────────────────────────────
class StreamCSVReader extends Readable {
  constructor(file, opts = {}) {
    super({ objectMode: true });
    this.leftover = Buffer.alloc(0);
    this.stream = fs.createReadStream(file, {
      highWaterMark: opts.highWaterMark || 64 * 1024,
    });
    this.stream.on('data', chunk => this._processChunk(chunk));
    this.stream.on('end', () => {
      if (this.leftover.length) this._pushLine(this.leftover);
      this.push(null);
    });
  }
  _read() { }
  _processChunk(chunk) {
    let start = 0;
    for (let i = 0, L = chunk.length; i < L; ++i) {
      if (chunk[i] === 10 /*\n*/) {
        const line =
          start === i
            ? this.leftover
            : Buffer.concat([this.leftover, chunk.slice(start, i)]);
        this.leftover = Buffer.alloc(0);
        this._pushLine(line);
        start = i + 1;
      }
    }
    if (start < chunk.length) {
      this.leftover = Buffer.concat([this.leftover, chunk.slice(start)]);
    }
  }
  _pushLine(buf) {
    if (!buf.length) return;
    const row = [];
    let ns = 0;
    for (let i = 0; i <= buf.length; ++i) {
      if (i === buf.length || buf[i] === 44 /*,*/) {
        row.push(+buf.toString('utf8', ns, i));
        ns = i + 1;
      }
    }
    this.push(row);
  }
}

// ─── 3. FastBufferReader (indexOf + subarray) ────────────────────────
class FastBufferReader extends Readable {
  constructor(file, opts = {}) {
    super({ objectMode: true });
    this.fd = fs.openSync(file, 'r');
    this.buf = Buffer.allocUnsafe(opts.highWaterMark || 128 * 1024);
    this.leftover = Buffer.alloc(0);
    this.eof = false;
  }
  _read() {
    if (this.eof) return;
    const bytes = fs.readSync(this.fd, this.buf, 0, this.buf.length, null);
    if (bytes === 0) {
      this.eof = true;
      if (this.leftover.length) this._pushLine(this.leftover);
      fs.closeSync(this.fd);
      this.push(null);
      return;
    }
    const data =
      this.leftover.length === 0
        ? this.buf.subarray(0, bytes)
        : Buffer.concat([this.leftover, this.buf.subarray(0, bytes)]);
    let start = 0, idx;
    while ((idx = data.indexOf(10 /*\n*/, start)) !== -1) {
      this._pushLine(data.subarray(start, idx));
      start = idx + 1;
    }
    this.leftover = data.subarray(start);
  }
  _pushLine(lineBuf) {
    if (lineBuf.length === 0) return;
    const row = [];
    let s = 0, i;
    while ((i = lineBuf.indexOf(44 /*,*/, s)) !== -1) {
      row.push(+lineBuf.toString('utf8', s, i));
      s = i + 1;
    }
    row.push(+lineBuf.toString('utf8', s));
    this.push(row);
  }
}

// ─── 4. WholeFileReader (one-shot fs.readFileSync) ──────────────────
class WholeFileReader extends Readable {
  constructor(file) {
    super({ objectMode: true });
    const data = fs.readFileSync(file);
    let start = 0, idx;
    while ((idx = data.indexOf(10 /*\n*/, start)) !== -1) {
      this._pushLine(data.subarray(start, idx));
      start = idx + 1;
    }
    if (start < data.length) {
      this._pushLine(data.subarray(start));
    }
    process.nextTick(() => this.push(null));
  }
  _read() { }
  _pushLine(lineBuf) {
    if (!lineBuf.length) return;
    const row = [];
    let s = 0, i;
    while ((i = lineBuf.indexOf(44 /*,*/, s)) !== -1) {
      row.push(+lineBuf.toString('utf8', s, i));
      s = i + 1;
    }
    row.push(+lineBuf.toString('utf8', s));
    this.push(row);
  }
}

// ─── 5. ReadlineCSVReader (readline on 'line') ──────────────────────
class ReadlineCSVReader extends Readable {
  constructor(file) {
    super({ objectMode: true });
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity
    });
    rl.on('line', line => this._pushLine(line));
    rl.on('close', () => this.push(null));
  }
  _read() { }
  _pushLine(line) {
    if (!line) return;
    // parse comma‑separated floats:
    const row = line.split(',').map(Number);
    this.push(row);
  }
}

// ─── benchmark runner ────────────────────────────────────────────────
function runBenchmark(Reader, label, file, done) {
  const t0 = process.hrtime.bigint();
  const r = new Reader(file);
  r.on('data', () => { });           // trigger parsing
  r.on('end', () => {
    const dt = HR2MS(process.hrtime.bigint() - t0);
    console.log(`${label.padEnd(30, ' ')} → ${dt.toFixed(1)} ms`);
    done();
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────
const CSV_FILE = path.resolve(__dirname, 'big.csv');
const ROWS = 1_000_000;  // adjust for your machine
const COLS = 8;

console.log(`\n📦 Generating ${ROWS.toLocaleString()}×${COLS} CSV…`);
writeRandomCsv(CSV_FILE, ROWS, COLS);

runBenchmark(FileHandleCSVReader, '1) readSync + byte‑scan', CSV_FILE, () => {
  runBenchmark(StreamCSVReader, '2) createReadStream', CSV_FILE, () => {
    runBenchmark(FastBufferReader, '3) readSync + Buffer.indexOf', CSV_FILE, () => {
      runBenchmark(WholeFileReader, '4) fs.readFileSync one‑shot', CSV_FILE, () => {
        runBenchmark(ReadlineCSVReader, '5) readline on("line")', CSV_FILE, () => {
          fs.unlinkSync(CSV_FILE);
          console.log('✅ done.\n');
        });
      });
    });
  });
});
