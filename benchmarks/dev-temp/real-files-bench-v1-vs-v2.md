
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