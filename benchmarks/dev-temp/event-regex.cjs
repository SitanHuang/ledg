const REGEX = /event\s+([^\s]+)\s+([^\s].*)/;

function parseEventRegex(s) {
  const m = REGEX.exec(s);
  if (!m) return null;
  return [m[1], m[2]];
}

function parseEventNoRegex(s) {
  if (!s.startsWith('event')) return null;

  const LEN = s.length;
  let i = 5; // position right after 'event'
  // skip spaces
  while (i < LEN && s[i] === ' ') i++;
  if (i >= LEN) return null;

  // start of group1
  const start1 = i;
  // find end of group1 (first space after start1)
  const end1 = s.indexOf(' ', start1);
  if (end1 === -1) return null;

  // skip spaces to start of group2
  i = end1;
  while (i < LEN && s[i] === ' ') i++;
  if (i >= LEN) return null;

  const g1 = s.slice(start1, end1);
  const g2 = s.slice(i);
  return [g1, g2];
}

// Benchmark runner
function benchmark() {
  const ITERATIONS = 1e6;
  const testStr = 'event LOGIN user=alice action=signin timestamp=2025-04-22T14:30:00Z';
  let res;

  console.log(`Benchmarking ${ITERATIONS} iterations on:`);
  console.log(`  "${testStr}"\n`);

  // Warm-up
  parseEventRegex(testStr);
  parseEventNoRegex(testStr);

  // Regex
  let t0 = process.hrtime();
  for (let i = 0; i < ITERATIONS; i++) {
    res = parseEventRegex(testStr);
  }
  let diff = process.hrtime(t0);
  console.log(`Regex parser:       ${diff[0] * 1e3 + diff[1] / 1e6} ms`);

  // Manual
  t0 = process.hrtime();
  for (let i = 0; i < ITERATIONS; i++) {
    res = parseEventNoRegex(testStr);
  }
  diff = process.hrtime(t0);
  console.log(`Manual parser:      ${diff[0] * 1e3 + diff[1] / 1e6} ms`);

  console.log('\nSample parse result:', res);
}

benchmark();
benchmark();
benchmark();
