## Multicurrency
8000 entries with 4000 multicurrency entries and 4000 single currency entries.


| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `/home/D/DIY/ledger/ledg-linux -Ftest tree --sort` | 326.7 ± 4.6 | 322.4 | 335.8 | 2.78 ± 0.05 |
| `ledger -f test.dat bal` | 117.6 ± 1.6 | 115.7 | 121.8 | 1.00 |
| `hledger -ftest.dat bal` | 1156.3 ± 10.3 | 1147.5 | 1177.4 | 9.83 ± 0.16 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `/home/D/DIY/ledger/ledg-linux -Ftest incomestatement f:2021-01-01 to:2022-01-01 --monthly --currency=m` | 594.2 ± 11.9 | 580.7 | 616.4 | 1.00 |
| `hledger -ftest.dat incomestatement -b 2021-01-01 -e 2022-01-01 --monthly -X m` | 1223.3 ± 13.7 | 1196.9 | 1238.0 | 2.06 ± 0.05 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `/home/D/DIY/ledger/ledg-linux -Ftest balancesheet f:2021-01-01 to:2022-01-01 --monthly --currency=m` | 341.8 ± 6.2 | 335.2 | 352.2 | 1.00 |
| `hledger -ftest.dat balancesheet -b 2021-01-01 -e 2022-01-01 --monthly -X m` | 1121.6 ± 8.8 | 1107.1 | 1138.1 | 3.28 ± 0.06 |

## Single currency

```
===ledg===
7140 entries

After disk cache:
	$ time l -Ftest incomestatement --debug --skip-book-close=false f:2021-01-01 --monthly

	_endConfig=6ms, _endCmd=239ms
	usr time  445.07 millis    0.00 micros  445.07 millis
	sys time   38.71 millis  335.00 micros   38.37 millis

Calculation net amount: "$774,894.00"

===hledger===
7000 entries

After disk cache:
	$ time hledger -ftest.dat -b 2021-01-01 --monthly is

	usr time  655.58 millis  288.00 micros  655.29 millis
	sys time   27.03 millis  111.00 micros   26.92 millis

Calculation net amount: "759700.00$"

(655-455) / 655 = 30.53%
```
