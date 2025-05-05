
# Round 1: Parsing Only

**Data**: my 2019 to 2022 personal ledg books (2023 onwards use multicurrency and price declarations)

  ```
  $ l stat
  1979              1 entries (0.04 KiB)
  2003              1 entries (0.04 KiB)
  2011              1 entries (0.04 KiB)
  2014              1 entries (0.04 KiB)
  2019              31 entries (3.83 KiB)
  2020              27 entries (3.64 KiB)
  2021              178 entries (24.92 KiB)
  2022              241 entries (34.89 KiB)
  ```

**Task**: read and parse all transactions 50 times and print out total entries read; this sums to about 25000 transactions, which would be typical for a busy, 10-year ledg book

**Setup**: both ledg and ledg2 do not use compiled binaries; same machine at empty load

**Limitations**: technically, ledg2 needs to read about 78 more transactions per
parse due to 78 account opening directives that make the 2022 book parseable; we
won't normalize this because the opening directives are easier to parse

## Results

```
$ hyperfine 'node benchmark.mjs' 'l --no-config -Fbook bench 50 --do-not-adjust --do-not-wri
te-books --do-not-write-config' 'hledger -f hledger50.dat stats' 'ledger -f hledger50.dat stat' --warmup 10
Benchmark 1: node benchmark.mjs
  Time (mean ± σ):      1.412 s ±  0.129 s    [User: 1.727 s, System: 0.165 s]
  Range (min … max):    1.241 s …  1.689 s    10 runs

Benchmark 2: l --no-config -Fbook bench 50 --do-not-adjust --do-not-write-books --do-not-write-config
  Time (mean ± σ):     830.7 ms ±  91.6 ms    [User: 855.1 ms, System: 98.9 ms]
  Range (min … max):   736.3 ms … 1057.7 ms    10 runs

Benchmark 3: hledger -f hledger50.dat stats
  Time (mean ± σ):      4.344 s ±  0.433 s    [User: 4.114 s, System: 0.224 s]
  Range (min … max):    3.714 s …  4.834 s    10 runs

Benchmark 4: ledger -f hledger50.dat stat
  Time (mean ± σ):     365.4 ms ±  18.3 ms    [User: 325.7 ms, System: 38.8 ms]
  Range (min … max):   338.6 ms … 405.1 ms    10 runs

Summary
  ledger -f hledger50.dat stat ran
    2.27 ± 0.28 times faster than l --no-config -Fbook bench 50 --do-not-adjust --do-not-write-books --do-not-write-config
    3.87 ± 0.40 times faster than node benchmark.mjs
   11.89 ± 1.33 times faster than hledger -f hledger50.dat stats
```

## 3-time Read

Represents my current 2025 data amount:

(hledger here should beat us since it's not interpreted language)

```
$ hyperfine 'node benchmark.mjs' 'l --no-config -Fbook bench 3 --do-not-adjust --do-not-writ
e-books --do-not-write-config' 'hledger -f hledger.dat stats; hledger -f hledger.dat stats; hledger -f hledger.dat stats
' --warmup 10
Benchmark 1: node benchmark.mjs
  Time (mean ± σ):     505.3 ms ±  54.0 ms    [User: 572.7 ms, System: 65.6 ms]
  Range (min … max):   448.7 ms … 603.7 ms    10 runs

Benchmark 2: l --no-config -Fbook bench 3 --do-not-adjust --do-not-write-books --do-not-write-config
  Time (mean ± σ):     353.2 ms ±  20.3 ms    [User: 360.9 ms, System: 45.0 ms]
  Range (min … max):   328.7 ms … 382.0 ms    10 runs

Benchmark 3: hledger -f hledger.dat stats; hledger -f hledger.dat stats; hledger -f hledger.dat stats
  Time (mean ± σ):     351.2 ms ±  33.3 ms    [User: 286.5 ms, System: 48.3 ms]
  Range (min … max):   291.7 ms … 397.3 ms    10 runs

Summary
  hledger -f hledger.dat stats; hledger -f hledger.dat stats; hledger -f hledger.dat stats ran
    1.01 ± 0.11 times faster than l --no-config -Fbook bench 3 --do-not-adjust --do-not-write-books --do-not-write-config
    1.44 ± 0.21 times faster than node benchmark.mjs
```

# Round 2: Accumulation Only

**Data**: my 2019 to 2025 personal ledg books (2023 onwards use multicurrency and price declarations)

  ```
  $ l stat
  1979              1 entries (0.04 KiB)
  2003              1 entries (0.04 KiB)
  2011              1 entries (0.04 KiB)
  2014              1 entries (0.04 KiB)
  2019              31 entries (3.83 KiB)
  2020              27 entries (3.64 KiB)
  2021              178 entries (24.92 KiB)
  2022              241 entries (34.89 KiB)
  2023              225 entries (33.61 KiB)
  2024              253 entries (36.22 KiB)
  2025              90 entries (11.02 KiB)
  2026              1 entries (0.11 KiB)
  2027              1 entries (0.11 KiB)
  2028              1 entries (0.11 KiB)
  2029              1 entries (0.11 KiB)
  2030              1 entries (0.11 KiB)
  Total entries     1054 (148.87 KiB)

  Level 1 accounts  9
  Level 2 accounts  21
  Level 3 accounts  52
  Level 4 accounts  62
  Level 5 accounts  1
  Total accounts    145
  ```

**Task**: read and accumulate all postings with account filter `"inc.sal*|expense*"` and tag filter `/summer(,|$)/i`

  in ledg2:

  ```js
  QueryEngine.create()
    .withAccount("inc.sal*|expense*")
    .withModifier("tags", /summer(,|$)/i)
    .compile()
    .executePostings(journal, (posting) => {
      sum = sum.plus(posting.amount);
    });

  console.log(sum);
  console.log("Sum: ", sum.toString());
  console.log("Sum: ", sum.toFractionString());
  ```

**Setup**: both ledg and ledg2 do not use compiled binaries; same machine at empty load

**Limitations**: ledg does extra computing to print out each posting, though the
"register" command was found to be faster than the default command; ledg2 also
skips all the CLI overheads and directly computes the result

## Results

Verification of results:

```
$ node benchmark2.mjs
Amount {
  amounts: Map(1) { '$' => { currency: [Currency], value: [Rational] } },
  sourceString: undefined
}
Sum:  REDACTED571.47 $
Sum:  REDACTED57147 / 100REDACTED $

$ l "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv
"Accounts","Balance"
"Expense.Essential.Auto.License","0"
REDACTED
"Sum","REDACTED,571.47"
```

Benchmark:

```
$ hyperfine 'node benchmark2.mjs' 'l "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum
--csv' 'l reg "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv' --warmup 10
Benchmark 1: node benchmark2.mjs
  Time (mean ± σ):     384.1 ms ±  20.2 ms    [User: 365.0 ms, System: 47.8 ms]
  Range (min … max):   352.4 ms … 416.8 ms    10 runs

Benchmark 2: l "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv
  Time (mean ± σ):     333.2 ms ±  18.1 ms    [User: 305.7 ms, System: 36.1 ms]
  Range (min … max):   306.4 ms … 356.5 ms    10 runs

Benchmark 3: l reg "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv
  Time (mean ± σ):     306.4 ms ±  12.7 ms    [User: 279.9 ms, System: 35.7 ms]
  Range (min … max):   290.2 ms … 328.4 ms    10 runs

Summary
  l reg "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv ran
    1.09 ± 0.07 times faster than l "inc.sal*|expense*" +summer --no-config -Fbook --do-not-adjust --do-not-write-books --do-not-write-config --sum --csv
    1.25 ± 0.08 times faster than node benchmark2.mjs
```

The efficient account indices and also account glob regex compilation on ledg2
may be reduced the penalties of ledg2's more sophisicated and slower parsing and
rational arithmetics.