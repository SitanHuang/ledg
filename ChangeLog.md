 
# Changelog
## [Unreleased]
### Fixed
- budgets don't add up to parent accounts

## [0.4.0] - 2021-03-18
### Added
- ledg budget (tracker and account based budgeting)
- ledg budget edit to bring up system editor for budgets.ledg file

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
