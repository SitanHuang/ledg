async function cmd_version() {
  console.log(c.bold('ledg - version 0.6.0') + ' built for cli');
}

async function cmd_help() {
  await cmd_version();
  console.log(
`
**SYNOPSIS**
\t**ledg <command> [ <filter> ] [ <flags> ]**

**FLAGS**
\tPresets of flags can be saved at ~/.ledgrc

\t--file=FILE
\t\tDefault: book
\t\tset FILE as a prefix for ledg file locations:
\t\tex. --file=Documents/book will point to Documents/book.*.ledg

\t--budget=NAME
\t\tthis can be used in your .ledgrc to point to a default budget
\t\tex. --budget="Monthly Budget"
\t\t    --budget="2023 Puero Rico Vacation Saving Goals"

\t--income=<account filter>, --expense=<account filter>, --equity=<account filter>
\t--asset=<account filter>, --liability=<account filter>
\t\tDefault: Income*, Expense*, Asset*, Liability*, Equity*
\t\tLet certain report commands to know what are the corresponding accounts

\t--skip-book-close[=false]
\t\tDefault: false
\t\tSkips all entries with bookClose:"true" or bookClose:true

**FILTER**
\t[ modifiers ] [ account filter, ...]
\ta set of arguments that filters entries

\tfrom:yyyy-mm-dd
\t\tlimit entries starting from this date(inclusive)

\tto:yyyy-mm-dd
\t\tlimit entries before this date(exclusive)

\t@min, @max, @year-start, @year-end, @tomorrow, @today, @month-start, @month-end
\t@last-year-today, @last-year
\t\tused in conjunction with from: and to:
\t\tex: "ledg info from:@min to:@max" queries everything in the book

\tmodifier:regex
\t\tqueries entries with modifiers that matches the regex
\t\tex: payee:"amazon|steam"
\t\t    tag:"pc|tablet"

\t+TAG
\t\tappends TAG(,|$) to tags: modifier, if tags: is empty

\tuuid filter
\t\tuuids can be filtered with the uuid:A|B|C syntax or directly putting uuids as arguments

\taccount filter
\t\taccounts in ledg follow this format: name[.name...], and name can
\t\tONLY contain letters and numbers, and MUST contain at least one letter

\t\tledg support fuzzy search of account names
\t\t\tex: ..cash =~ Account.Current.Cash
\t\t\t    .cash =~ Account.Cash
\t\t\t    exp$ =~ Expense
\t\t\t    exp|inc.sl =~ Expense | Income.Salary
\t\t\t    exp. =~ Expense.*
\t\t\t    exp. =~ Expense.*
\t\t\t* - matches any character
\t\t\t. - matches . literally
\t\t\t    anything in between dots matches any segments of account names that
\t\t\tcontains the letters in that order
\t\t\t    ex: .csh. matches *\\.[^.]*c[^.]*s[^.]*h[^.]*\\.* in regex


**COMMANDS**
\tCommands can be shortened as long as they are not ambiguous
\tExample: ledg accounts -> ledg acc
\t\t\t ledg info -> ledg inf

\tedit <filters> [new]
\t\tbrings up system editor to modify filtered entries
\t\tnew
\t\t\topens a blank file to manually enter new entries

\taccounts add <full account name>
\t\tcreate new account and write to FILE.config.ledg

\tburndown [--q1="[<filters>] <account filters>", --q2=...] [--abs=false] [--count]
\t         [--cumulative]
\t\tCreates multi-dataset bar graphs
\t\tDefault: --abs=true

\t\t--abs
\t\t\tTake absolute values

\t\t--cumulative
\t\t\tcumulates count/sum

\t\t--count
\t\t\tShow graph of numbers of entries rather than sum

\thistory [--daily] [--weekly] [--biweekly] [--monthly] [--quarterly]
\t        [--yearly] [--cumulative] [--cumulative-columns=num list]
\t        [--skip-book-close=true]
\t        [ <account filter 1> <account filter 2> ... ]
\t\tDefaults: shows accounts specified by --income, --expense, --asset, --liability,
\t\t          and --equity, and defaults --skip-book-close=true
\t\tprints multicolumn time by selected interval
\t\tNote: even with cumulative columns, history command does not sum everything from
\t\t@min, and so unless from:@min is given, asset/liability calculation is not accurate

\t\t--cumulative-columns=1,2,3...
\t\t\tshows cumulative data for the given column numbers

\t\t--cumulative
\t\t\tshows cumulative data

\taccounts rename <source> <dist> [ <filter> ]
\t\tmodifies entries by replacing account source with dist
\t\t-y
\t\t\tdefaults confirmations to yes

\taccounts [--sum-parent] [--hide-zero] [--max-depth=NUM] [--sum] [ <filter> ] [tree]
\t\tsums balances in selected accounts
\t\tDue to the need to sum entries from the beginning of a book, from: modifier is
\t\tdefaulted to @min.

\t\t--sum-parent
\t\t\tallows child account balances to add to parent accounts
\t\t--hide-zero, --hide-zero=false
\t\t\thide accounts with zero balance or not
\t\t--max-depth=NUM
\t\t\tmax child account depth to show
\t\t--sum
\t\t\tsums listed accounts, best used with --max-depth=1
\t\ttree
\t\t\tdisplays account balances in tree view

\tinfo [ <filter> ] [flat]
\t\tdisplays entries' information

\t\tflat
\t\t\tdisplays entries row by row rather than expanding individual transfers

\tadd [--date=yyyy-mm-dd] [-y] [description] [yyyy-mm-dd] < <account filter>
\t\t  [account description] <amount> [, ...]> [+TAG ...]
\t\tpush entry to book
\t\tNote: The last account transfer set can leave empty amount, and ledg will calculate it.
\t\t  ex: "ledg add cash withdrawal from bank ast..cash 100 ast..BoA.chking"
\t\t      will leave Asset.Current.BankOfAmerica.Checking with -100 balance

\t\t<account filter>
\t\t\t(see FILTER section)

\t\t--date=yyyy-mm-dd, -Dyyyy-mm-dd, [yyyy-mm-dd]
\t\t\tDefault: current date
\t\t\tspecifies the date of entry
\t\t-y
\t\t\tdefaults most confirmations to yes (unless ledg prompts a list to choose)

\tmodify <filter> [--date=yyyy-mm-dd] [--add-tag=A,B,C] [-remove-tag=A,B,C]
\t       [--set-mod=A:123,B:123] [--remove-mod=C,D,E] [-y] [description] [+TAG ...]
\t       [yyyy-mm-dd] [ <account filter> [account description] <amount> [, ...]]
\t\tbatch modify entries, see more in "add" section
\t\taccount query is not supported
\t\tNote: using +TAG replaces everything. If only a new tag is needed, use --add-tag

\tdelete [ <filter> ] [-y]
\t\tbatch delete entries
\t\t-y
\t\t\tdefaults confirmations to yes

\tbudget [--budget=NAME] [--do-not-adjust] [edit|list]
\t\tprints report for the selected budget
\t\tNote: report excludes entries with bookClose:"true"
\t\t      budgets can be edited at FILE.budgets.ledg

\t\t--do-not-adjust
\t\t\tBy default, if specified from: and to: have different range than the one in
\t\t\tbudget file, ledg will shrink/grow amounts correspondingly. For example,
\t\t\tfrom:@month-start and to:@month-end on an annual budget will divide all amounts
\t\t\tby 12. This option disables the feature.

\t\tedit
\t\t\topens system editor for FILE.budgets.ledg

\t\tlist
\t\t\tlists all budget names in FILE.budgets.ledg

\t\tExample book.budgets.ledg:
\t\t~ Vacation Budget 2021
\t\t  ;from:"@month-start"
\t\t;this is a comment, below are tracker based budgeting
\t\t  ;to:"@month-end"
\t\t  ast.*.Chck	goal 0-500
\t\t  exp.* payee:Amazon	limit 0--200

\t\t; -- account based budgeting --
\t\t  Expense	300
\t\t; -- expense cateogries --
\t\t  Expense.Other.Transportation	300
\t\t  Expense.Essential.Groceries	200

\tgit [...]
\t\texecutes git [...] at the parent directory of FILE

\tstats
\t\tdisplays stats of journal files

\tcount [<account filters>] [<filters>]
\t\treturns number of entries that match the filters

\texport gnucash-transactions > transactions.csv
\texport gnucash-accounts > accounts.csv
\t\tcsv can be directly imported to gnucash
`.replace(/\*\*([^\n\r]+)\*\*/g, c.bold('$1')));

}
