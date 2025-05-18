
# Nominal use case benchmark

Due to the faster load times of `hledger`'s compiled binary, all tests were
conducted using approximately 53,000 transactions to gauge how `hledger`, `ledg`
v1.0 and `ledg` v2.0 scale with increasing journal size. This is equivalent to
around 100 years of financial data for an individual user.

## Set-up

The entirety of my own personal accounting books, with a few currencies and
conversion rates, are copied over 50 times.

- For `ledg`, the UUIDs of each `book.20XX.ledg` file are removed and contents
  are duplicated into the same file.

- For `ledg2`, `ledg print --prices` is used to print out all transactions in
  `ledg` v1.0 syntax. The UUIDs are removed. The actual `main.ledg2` file is
  loaded once, to set up account structures and pricing, and the printed output
  is loaded 49 times using the `include` directive.

- For `hledger`, `ledg print --prices --ledger` is used to print out all
  transactions in ledger-cli syntax. `ledg` internal metadata, in the form of
  `hledger` tags, are removed for faster parsing. The printed output is
  duplicated 50 times.

Hyperfine is used to benchmark the softwares, and linux file caches are dropped
before each software:

```shell
hyperfine --shell fish --prepare "sync; echo 3 > /proc/sys/vm/drop_caches; sleep 5" --export-markdown report.md
```

The below outputs summarize the file set-up (at the time of writing, `ledg2` is
in development and the `stats` command has yet to be implemented):

```shell
/home/git/bin/ledg stat -F/home/git/ledgBenchTest/book --no-config --do-not-write-books --do-not-write-config -Wall
# Stat              Data
# File prefix       /home/git/ledgBenchTest/book
#
# 1979              50 entries (1.61 KiB)
# 2003              50 entries (1.76 KiB)
# 2011              50 entries (1.76 KiB)
# 2014              50 entries (1.46 KiB)
# 2019              1550 entries (177.78 KiB)
# 2020              1350 entries (170.12 KiB)
# 2021              8900 entries (1167.87 KiB)
# 2022              12050 entries (1638.53 KiB)
# 2023              11250 entries (1581.59 KiB)
# 2024              12650 entries (1699.8 KiB)
# 2025              4750 entries (536.62 KiB)
# 2026              50 entries (5.27 KiB)
# 2027              50 entries (5.27 KiB)
# 2028              50 entries (5.27 KiB)
# 2029              50 entries (5.27 KiB)
# 2030              50 entries (5.27 KiB)
# Total entries     52950 (7005.27 KiB)
#
# Level 1 accounts  9
# Level 2 accounts  21
# Level 3 accounts  52
# Level 4 accounts  62
# Level 5 accounts  1
# Total accounts    145

hledger -f /home/git/journal50.dat stat
# Main file                : /home/git/journal50.dat
# Included files           :
# Transactions span        : 1979-11-02 to 2030-03-25 (18406 days)
# Last transaction         : 2030-03-24 (1772 days from now)
# Transactions             : 52950 (2.9 per day)
# Transactions last 30 days: 950 (31.7 per day)
# Transactions last 7 days : 100 (14.3 per day)
# Payees/descriptions      : 1059
# Accounts                 : 100 (depth 5)
# Commodities              : 3 (, $, WKHR)
# Market prices            : 1900 ($, ESTRPTCHPTONE, INSTCOF, WKHR, cny, d, h, m, rmb, s, usd, ¥)
#
# Run time (throughput)    : 10.28s (5149 txns/s)
```

## Results

### Income statement

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| `/home/git/bin/ledg2 is --file /home/git/journal50.ledg2 -f 2021 -t 2030 --yearly --tree --hz --currency='$' --vs=txn-date --sp --sort desc` | 3.474 ± 0.280 | 3.183 | 4.050 | 1.54 ± 0.21 |
| `hledger -f /home/git/journal50.dat is -X '$' --begin 2021 --end 2030 --yearly --tree --sort-amount -B` | 10.517 ± 1.229 | 8.527 | 12.486 | 4.65 ± 0.74 |
| `/home/git/bin/ledg inc -F/home/git/ledgBenchTest/book --no-config --do-not-write-books --do-not-write-config f:2021 t:2030 --yearly --hz --currency='$' --valuation-eop=false --valuation-date=false --tree --sp --sort -Wall` | 2.260 ± 0.242 | 1.911 | 2.656 | 1.00 |


With more stringent checkings, dynamic value expression support, and
infinite-precision, rational arithmetics, `ledg` v2.0 expectedly comes to about
1.5 times slower than `ledg` v1.0. Interestingly, while benchmarking the
internal arithmetics component, this same 1.5 number comes up; all the
validation and parsing overheads of the newer, more complex software do not
appear to figure on this benchmark.

### Balance sheet with account filter

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| `/home/git/bin/ledg2 bs --file /home/git/journal50.ledg2 -f 2021 -t 2030 --yearly --tree --hz --currency='$' --vs=txn-date --sp --sort desc -a '\\v.+checking'` | 3.321 ± 0.327 | 2.782 | 3.933 | 1.35 ± 0.20 |
| `hledger -f /home/git/journal50.dat bs -X '$' --begin 2021 --end 2030 --yearly --tree --sort-amount -B .+checking` | 9.084 ± 0.783 | 7.831 | 10.270 | 3.68 ± 0.51 |
| `/home/git/bin/ledg balancesheet -F/home/git/ledgBenchTest/book --no-config --do-not-write-books --do-not-write-config '\\v.+checking' f:2021 t:2030 --yearly --hz --currency='$' --valuation-eop=false --valuation-date=false --tree --sp --sort -Wall` | 2.466 ± 0.272 | 2.029 | 2.984 | 1.00 |

`ledg` v2.0 internally maintains a variety of indices for all postings at parse
time. The reduced ratio of `ledg` v2.0 to v.10 (i.e., 1.54 in the income
statement benchmark to 1.35 in this one) is likely attributed to the fact that
account *filtering* is an $O(1)$ operation as a function of posting count.