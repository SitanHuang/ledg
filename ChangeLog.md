 
# Changelog

## [Unreleased]
### Added
- \-\-light-theme option for your ledgrc so tables look
  reasonable in light themed terminals
  - budget bars are also applicable
- added report_sort_by_time

### Changed
- print \-\-ledger now replaces '.' with ':'

### Fixed
- fixed burndown command crashing with --quarterly
- info command doesn't set from:@min even with
  modifier present
- fixed uuid doesn't show up as query in many commands

## [0.6.1] 2021-03-28
### Added
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
- split parsers from fs.js to various parse*.js
- ledg without commands will apply modifiers to default cmd

### Fixed
- vim not working in ledg git commit


## [0.2.0] - 2021-03-16
### Added
- parser now recognizes entries with missing uuid
  and auto assigns one (for manual entry without uuid)
- filter now supports multiple account conditions 
  (ex. search for entries with Expense.* and ..Cash)
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
  - ex. --file=/home/book will point to /home/book*.ledg
- will automatically generate *.config.ledg if missing
- .ledgrc for default parameters
- ledg add
  - auto expand existing accounts for fuzzy search
- ledg acc
  - added --max-depth, --sum-parent, and --hide-zero options
- ledg acc tree
- ledg acc add
- ledg info to view detailed entry information
- added from: to: modifiers to filter dates
