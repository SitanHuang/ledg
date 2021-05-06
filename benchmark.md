## Multicurrency
### 2021-05-06 optimizations
| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest tree --sort` | 311.8 ± 4.8 | 305.2 | 321.0 | 1.63 ± 0.04 |
| `ledger -f test.dat bal` | 191.4 ± 3.4 | 186.2 | 200.0 | 1.00 |
| `hledger -ftest.dat bal` | 1883.8 ± 10.6 | 1870.4 | 1900.7 | 9.84 ± 0.18 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest incomestatement f:2021-01-01 to:2022-01-01 --monthly` | 334.0 ± 3.1 | 328.5 | 337.7 | 1.00 |
| `hledger -ftest.dat incomestatement -b 2021-01-01 -e 2022-01-01 --monthly` | 2033.5 ± 12.6 | 2010.2 | 2050.9 | 6.09 ± 0.07 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest balancesheet f:2021-01-01 to:2022-01-01 --monthly` | 324.4 ± 4.4 | 317.6 | 333.9 | 1.00 |
| `hledger -ftest.dat balancesheet -b 2021-01-01 -e 2022-01-01 --monthly` | 1797.2 ± 11.7 | 1780.7 | 1821.7 | 5.54 ± 0.08 |

### V0.9.3 native bigint implementation
| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest tree --sort` | 447.8 ± 11.1 | 431.3 | 466.2 | 2.47 ± 0.09 |
| `ledger -f test.dat bal` | 180.9 ± 4.7 | 176.2 | 191.0 | 1.00 |
| `hledger -ftest.dat bal` | 1812.8 ± 35.0 | 1750.5 | 1871.1 | 10.02 ± 0.32 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest incomestatement f:2021-01-01 to:2022-01-01 --monthly` | 564.5 ± 20.6 | 544.2 | 600.3 | 1.00 |
| `hledger -ftest.dat incomestatement -b 2021-01-01 -e 2022-01-01 --monthly` | 1934.0 ± 38.9 | 1889.9 | 1991.9 | 3.43 ± 0.14 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledg -Ftest balancesheet f:2021-01-01 to:2022-01-01 --monthly` | 433.9 ± 8.3 | 419.9 | 449.7 | 1.00 |
| `hledger -ftest.dat balancesheet -b 2021-01-01 -e 2022-01-01 --monthly` | 1731.0 ± 35.5 | 1681.9 | 1791.2 | 3.99 ± 0.11 |

### Old Big.js implementation
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
