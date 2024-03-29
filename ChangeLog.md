# Changelog
## [1.0.0] 2024-03-13
### Added
- allow C-style comments in config files & corresponding test cases

### Fixed
- --balance-to-currency does not correctly resolve imbalance errors

### Misc Changes in
- help command

## Past Releases
* [[1.0.0-beta.1] 2021-11-08](#100-beta1-2021-11-08)
* [[1.0.0-beta] 2021-08-02](#100-beta-2021-08-02)
* [[0.13.0] 2021-06-05](#0130-2021-06-05)
* [[0.12.0] 2021-05-20](#0120-2021-05-20)
* [[0.11.0] 2021-05-15](#0110-2021-05-15)
* [[0.10.0] 2021-05-11](#0100-2021-05-11)
* [[0.9.5] 2021-05-09](#095-2021-05-09)
* [[0.9.4] 2021-05-05](#094-2021-05-05)
* [[0.9.3] 2021-04-30](#093-2021-04-30)
* [[0.9.2] 2021-04-28](#092-2021-04-28)
* [[0.9.1] 2021-04-25](#091-2021-04-25)
* [[0.9.0] 2021-04-23](#090-2021-04-23)
* [[0.8.4] 2021-04-22](#084-2021-04-22)
* [[0.8.3] 2021-04-19](#083-2021-04-19)
* [[0.8.2] 2021-04-13](#082-2021-04-13)
* [[0.8.1] 2021-04-11](#081-2021-04-11)
* [[0.8.0] 2021-04-09](#080-2021-04-09)
* [[0.8.0-beta] 2021-04-07](#080-beta-2021-04-07)
* [[0.7.2] 2021-04-04](#072-2021-04-04)
* [[0.7.1] 2021-03-30](#071-2021-03-30)
* [[0.7.0] 2021-03-30](#070-2021-03-30)
* [[0.6.1] 2021-03-28](#061-2021-03-28)
* [[0.6.0] 2021-03-22](#060-2021-03-22)
* [[0.5.0] 2021-03-20](#050-2021-03-20)
* [[0.4.0] 2021-03-18](#040---2021-03-18)
* [[0.3.0] 2021-03-16](#030---2021-03-16)
* [[0.2.0] 2021-03-16](#020---2021-03-16)
* [[0.1.0] 2021-03-15](#010---2021-03-15)

## [1.0.0-beta.1] 2021-11-08
### Added
- \--version is now synonymous with the version subcommand

### Fixed
- `\v` is not escaped in manual
- on some environments, Makefile includes chart.js twice
- version and help are not in fish autocomplete
- fixed critical error [#9](https://github.com/SitanHuang/ledg/issues/9) with
  ledg not using different timezone offset when parsing entries from a date with
  different timezone (ie. running ledg during winter caused all dates to shift
  back a day as ledg used same timezone offset from UTC on dates during daylight
  savings period)

### Changed
- `account(a, b, c)` macro for csv parsers now returns `a || default_account`
  if only 1 argument is provided

### Project
- examples: add .ledgrc, aliases.fish samples

## [1.0.0-beta] 2021-08-02
### Added
- `acc(...x)` macro for --test to match multiple account filters

### Changed
- `info flat` now shows "--- Event ---" if entry is an event without transfers,
  and "--- Empty ---" if entry is empty and not an event
### Fixed
- timeline command sets --maxhour off by 1 hour
- budget command crash without --budget specified
- "Since" column in events command shows year, month and day in mixed signs if
  event date is in the future
- typos in --help page

## [0.13.0] 2021-06-05
### Added
- event directive, similar to beancount but can contain transfers and modifiers,
  can be batch modified
- events command
- \--test option for filtering entries with JS eval and various macros
- account filter regex literal mode
- \--min-depth option for
  - accounts cmd
  - multiperiod reports
  - register cmd
- \--interval option for custom date intervals
- \--csv-delimiter option
- \--no-comma option to disable commas in amounts
- \--flat option as a shorthand for --tree=false
- \--budget option now recognizes budget id
- "none" flag for -W
  - previously, passing a list to -W only turns on the desired flags but does
    not turn off previously set flags; this makes it impossible to disable the
    -W list in .ledgrc if user wants to override it
  - now, if user wants to turn off a flag from .ledgrc, they can use -Wnone,...
    to first turn everything off then turn on specific ones
- Makefile now checks for min node version
- version cmd now shows git commit hash and node version

### Changed
- info command defaults to from:@min if --test is set

### Fixed
- system pager is invoked even with --html option
- incorrect expansion of ~ for --file
- cannot find home directory in Windows
- register command with interval does not sort accounts alphabetically
- Money.eq returns true even between two unresolvable currencies

## [0.12.0] 2021-05-20
### Added
- timeline command to produce timelines of blocks of
  time checked in and out throughout each day
  - \--simple for table only
- using sugar.js to process smart dates
  - \--period=smartdate
  - from:, to:, --skip
  - budget file from: to:
- vim plugin
  - installable via `make install`
  - syntax highlighting
  - snippets
- added the following error suppression flags:
  - uuid-reassigned-warning
  - timeclock-uuid-reassigned-warning

### Changed
- `make binary` now compresses binary to 50% of the
  original size, making load times even faster
- clockout entries with more than 2 transfers are
  also serialized in journals and printed in cmds with
  timeclock format

### Fixed
- print_max_width_from_entries counts amount string
  length before conversion rather than after
- division by zero if history command is run with
  from: > to:
- budget progress bar and usePerc does not work with
  multicurrency

## [0.11.0] 2021-05-15
### Added
- timeclock format support in regular journal files
  - \--timeclock option for print command
  - \--tc-expose and --tc-prices options
- csv import via the import command
  - ability to make custom parsers
  - directly add entries to journal
- data.precisionTolerance in config for allowing a certain
  error tolerance in currency conversion
- \--rewrite option in print command
- \--sort option in print command (no longer defaults to sort)
- \--do-not-write-books, and --do-not-write-config options
- register command now supports --valuation-eop
- uninstall target in Makefile

### Changed
- internal journal interator now walks tree in
  original order rather than the reverse
- Big.toNumber is now multitudes faster
- multicurrency amounts are now sorted based on
  currency name
- register command now uses period end date
- add command now ignores all currency flags

### Fixed
- add command does not set Money.date to entry date
- Big.js eq method does not work for values other than 0
- in prompts that show entry title string, pending sign
  is now shown
- close command should not convert currency
- reg command should not hide dates when --sort
- add command has no extra space after prompt
- missing --cleared documentation and autocomplete

## [0.10.0] 2021-05-11
### Added
- \--csv-no-quotes option
- \--include-prices option to explictly load price files
- \--balance-to-currency option
- \--eop is now a shorthand for \--valuation-eop

### Changed
- \--show-default-currency now applies to all cmds
- history command uses period end date with --iso,
  \--isofull or --epoch
- \--avg now no longer requires currency squashing

### Fixed
- ledg-time does not communicate with ledg at all
- \--valuation-eop causes multiperiod reports to
  ignore --currency
- debug message does not count prices read correctly
- Money.removeEmpty does not work

## [0.9.5] 2021-05-09
### Added
- \--no-config option
- \--right option
- \--drop-columns option
- info flat and register commands now underlines
  virtual transfers and adds ! to pending entries
- bump\_version.rb for auto version bumping

### Changed
- removed unused library asciichart
- parseBooks stopped using asynciterator
  - up to 20% performance boost
- money.js use primitive comparison in
  removeEmpty()
  - up to 9% performance boost
- Big.js parsing optimizations
  - up to 2-5% performance boost

### Fixed
- fix still persisting issue with info command uuid
  does not align for pending entries
- parser does not throw error when metadata or
  transfer is present before an entry declaration

## [0.9.4] 2021-05-05
### Added
- test cases
  - incomestatement
  - balancesheet

### Changed
- complete rewrite of accounting.js to allow proper
  display formats for bigfloat
- stats command no longer prints modifiers and flags
- \--csv no longer trims spaces in cells

### Fixed
- crash in multicurrency reports with:
  - \--sum-parent=false --tree and --avg combination
  - \--avg and account filter
  - does not sort name without --tree
- info command uuid does not align for pending entries
- parser does not handle metadata or transfers without
  an entry declaration

## [0.9.3] 2021-04-30
### Changed
- complete rewrite of Big.js using native bigint for
  float calculation
  - results in 14%-24% performance increase

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| `ledgOld -Ftest inc --daily --dp=10 --currency=h` | 1.235 ± 0.021 | 1.209 | 1.266 | 1.24 ± 0.02 |
| `ledg -Ftest inc --daily --dp=10 --currency=h` | 0.994 ± 0.010 | 0.979 | 1.006 | 1.00 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledgOld -Ftest` | 506.7 ± 7.8 | 494.5 | 519.2 | 1.13 ± 0.02 |
| `ledg -Ftest` | 446.6 ± 4.9 | 440.8 | 456.2 | 1.00 |

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `ledgOld -Ftest --currency=m` | 526.7 ± 14.2 | 505.8 | 546.3 | 1.18 ± 0.03 |
| `ledg -Ftest --currency=m` | 444.6 ± 5.2 | 436.9 | 452.3 | 1.00 |
```
native_init: 41.92ms
500400.7411313054
native_add: 27.347ms
BigFloat32_init: 1.081s
500400.74111967965
BigFloat32_add: 290.657ms
BigJS_init: 935.006ms
500400.7411312983
BigJS_add: 245.981ms
Custom_init: 672.081ms
500400.7411312983
Custom_add: 66.148ms
```
## [0.9.2] 2021-04-28
### Added
- \--pad-spaces option for print --ledger
- test cases
  - history \--valuation-eop
  - register command
- pending entries (by adding ! in front of description)
- \--default-pending option
- aliases
- fish shell auto completion

### Changed
- account tree becomes account --tree

### Fixed
- close command does not use previous year in description
- \~/.ledgrc is read twice if cwd=\~

## [0.9.1] 2021-04-25
### Added
- balancesheetequity
- \--percent option for multiperiod reports
- \--prices and --prices-only options for print command
- html export format

### Changed
- \--csv and \--html options now are shorthands for
  \--format=csv|html
- register command uses \* account filter unless specified

### Fixed
- 32bit end of time problem
  - replaced bitwise operators with Math functions
- multiperiod report
  - \--depth hides rows
  - \--sum-parent and \--depth don't play well together

## [0.9.0] 2021-04-23
### Added
- hledger style reports
  - incomestatement
  - balancesheet
  - cashflow
- query.js
  - accSumMatchTransfer option
  - invert option

### Changes
- burndown no longer clears screen and tries to
  maximize content to screen height better

### Fixed
- query.js doesn't handle multiple account filters
- query.js sums transfers with duplicated account filters

## [0.8.4] 2021-04-22
### Added
- \--transpose option for tables
- \--iso and \--isofull options
  - original \--iso becomes \--isofull
- \--valuation-eop option for history and burndown

### Changes
- large code style related refactors
- ledg now attempts to load .ledgrc in
  1. $HOME directory
  2. directory of --file
    a. \--file specified by process.argv, OR
    b. \--file specified by ~/.ledgrc
  3. current directory
- after fetching .ledgrc, process.argv is reparsed again,
  overriding options
- help command starts in less
- modifier:null will filter entries without modifier

### Fixed
- \--valuation-date is ignored in burndown
- edit command cannot read stdin after vim
- index.js args local variable is exposed to global scope
  - many components relied on this exploit

## [0.8.3] 2021-04-19
### Added
- more test cases
  - history command
  - budget command(basic)
- gnucash style close command
  - moves income and expense balances
    into equity account
- \-\-sort=\[asc|desc\] for register command

### Fixed
- ledg budget doesn't use stderr
- ledg won't exit on Windows
  - closes open handles on exit
- test suite cannot find node
- cmd\_git does not return promise
- query.js accSum option crash
- add.js doesn't recognize accounts
  with numbers

## [0.8.2] 2021-04-13
### Added
- starting to add test cases (found a s\* ton of bugs)
  - accounts command finished testing

### Changed
- use -X option when invoking less
- does not invoke less when !process.stdout.isTTY

### Fixed
- empty -W option crashes
- reading from STDIN doesn't balance entries
- accounts --sort does not sort name correctly
- Money.compare() does not sort amounts with currency
  that cannot be converted to defaultCurrency

## [0.8.1] 2021-04-11
### Added
- \-i option to prompt confirmation before add/mod
- \-W option to suppress certain parsing errors
- \-\-sum and --avg options for history command

### Changed
- all parsers now emit errors when encountering
  - parsing errors
  - imbalanced entries
- print --ledger no longer omits default currency
  - \-\-show-default-currency for regular print
- removed lib/gui support (due to incompatible api in
  recent releases)
  - fallback to v0.7.2 version if you want to use gui
    and convert your journals to one currency
- hide error stacktrace unless with --debug

### Fixed
- fix history --invert not applying to avg
- fix --currency and --dp not working with info flat
- fix burndown --count crashing

## [0.8.0] 2021-04-09
### Added
- eval command
- add ledg-time script for time tracking
  - ledg-time init
  - ledg-time clock-in
  - ledg-time clock-out Account Description
- budget multicurrency support

### Changed
- long table outputs now pipes into less
- report\_sort\_by\_time sorts clockOut as a backup

### Fixed
- fix history with interval flag crashes
- fix add money with currency parsed as flags
- cmd\_add crash

## [0.8.0-beta] 2021-04-07
### Added
- multicurrency support
  - complete rewrite of internal parsing and
    data structures
  - large refactors in cli commands
- history \-\-invert
- modifier shorthands(see manual)

### Changed
- value "true" in modifier is converted to boolean
- improved add command to better distinguish account names,
  prices, and description

### Fixed
- booleans are interpreted as 1 or 0 in modifiers

## [0.7.2] 2021-04-04
### Added
- add virt: modifier and --real
- budget --simple
- accounts --sort

### Changed
- added shorthands for some long flags
- add ledg tags
- .ledgrc no longer limits one arg per line
- \-\-file in ledgrc now expands '~'
- \-\-skip-book-close defaults to true on register cmd

### Fixed
- fix incorrect debug times

### [0.7.1] 2021-03-30
#### Fixed
- wrong entry dates in node-js due to timezone offset

## [0.7.0] 2021-03-30
### Added
- \-\-light-theme option for your ledgrc so tables look
  reasonable in light themed terminals
  - budget bars are also applicable
- added report_sort_by_time
- added ledg register command

### Changed
- print \-\-ledger now
  - replaces '.' with ':'
  - sorts by date
- tabulate() now auto strips ansi when calculating length


### Fixed
- fixed burndown command crashing with --quarterly
- info command doesn't set from:@min even with
  modifier present
- fixed uuid doesn't show up as query in many commands

### [0.6.1] 2021-03-28
#### Added
- initial development of ledg-gui
- add --cumulative to burndown
- ledg export gnucash-transactions
- ledg export gnucash-accounts
- ledg print \[\-\-ledger\]
- history allows rows to be skipped
- accept pipe as journal input
  - ledg print .... | ledg -F- ....

## [0.6.0] 2021-03-22
### Added
- ledg count
- ledg stats
- ledg burndown
- chart.js to draw bar graphs with multiple datasets
- new query api used internally
  - experimental, only used in ledg count and burndown
  - use ledg acc to validate result whenever possible

### Fixed
- fixed ledg doesn't start without .ledgrc

## [0.5.0] 2021-03-20
### Added
- ledg history \<filter\> \<account filter 1\>  \<account filter 2\>
- argparser recognizes 8 character uuid and appends it to uuid: modifier
- add --sum option to accounts command
- add --cumulative, --cumulative-columns=1,2,3... to history command
- +TAG syntax to add and modify commands, for modifying tags
- +TAG syntax to reporting commands, for querying with tags
- budget list
- tabular.js now prints csv tables (allows future csv exports)
  - --csv forces all tables to be in csv
- add quotation and escape support to budget tracker parsing

### Changed
- SIGINT no longer produces error
- account tree no longer defaults to sum-parent

### Fixed
- budgets don't add up to parent accounts
- added missing MIT licenses for some libraries

## [0.4.0] - 2021-03-18
### Added
- ledg budget (tracker and account based budgeting)
- ledg budget edit to bring up system editor for budgets.ledg file
- added @last-year-today, @last-year

### Changed
- ledg now saves config in with human readable format JSON


## [0.3.0] - 2021-03-16
### Added
- ledg help
- ledg account rename \<source\> \<dist\>
- \--skip-book-close option
- added generic api to parse book line by line
- ledg edit \<new\>
  - edit existing + add new
- new tabular api
- ledg info flat

### Changed
- allow accounts command to accept from: modifier
- split parsers from fs.js to various parse\.js
- ledg without commands will apply modifiers to default cmd

### Fixed
- vim not working in ledg git commit


## [0.2.0] - 2021-03-16
### Added
- parser now recognizes entries with missing uuid
  and auto assigns one (for manual entry without uuid)
- filter now supports multiple account conditions
  (ex. search for entries with Expense.\* and ..Cash)
- ledg modify which allows for transfers, desc and
  date modification
  - \--remove-mod=A,B,C, --set-mod=A:cc,B:cc
  - \--add-tag=A,B,C, \-remove-tag=A,B,C
- ledg delete
- \| operator in account fuzzy search
- ledg git ... to use git on book's parent directory

### Changed
- changed bin/ledger to bin/ledg in Makefile
- moved some modules from cli to core
- git repo clean up
- info now defaults to from:@month-start and to:@max
- with modifiers applied, info uses from:@min and to:@max
- filter modifiers in any report/modification command will use regex
- report modifier match is now case insensitive

### Fixed
- uuid misalignments in some info reports


## [0.1.0] - 2021-03-15
### Added
- \-\-file= for specifiying book location prefix
  - ex. --file=/home/book will point to /home/book\*.ledg
- will automatically generate \*.config.ledg if missing
- .ledgrc for default parameters
- ledg add
  - auto expand existing accounts for fuzzy search
- ledg acc
  - added --max-depth, --sum-parent, and --hide-zero options
- ledg acc tree
- ledg acc add
- ledg info to view detailed entry information
- added from: to: modifiers to filter dates
