 
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Roadmap to 0.2.0
- ledg edit \<new\>
  - edit existing + add new
  - direct back to edit if imbalanced
- ledg modify
- ledg delete
- ledg account rename
- report modifier case sensitivity
- tabular api

### Added
- parser now recognizes entries with missing uuid and auto assigns one (for manual entry without uuid)


### Changed
- changed bin/ledger to bin/ledg in Makefile
- moved some modules from cli to core
- git repo clean up
- info now defaults to from:@month-start and to:@max
- with modifiers applied, info uses from:@min and to:@max

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
