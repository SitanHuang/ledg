async function cmd_version() {
  console.log(c.bold('ledg - version 0.3.0') + ' built for cli');
}

async function cmd_help() {
  await cmd_version();
  console.log(
`
*SYNOPSIS*
\t*ledg <command> [ <filter> ] [ <flags> ]*

*FLAGS*
\tPresets of flags can be saved at ~/.ledgrc

\t--file=FILE
\t\tDefault: book
\t\tset FILE as a prefix for ledg file locations:
\t\tex. --file=Documents/book will point to Documents/book.*.ledg

\t--income=<account filter>, --expense=<account filter>, --equity=<account filter>
\t--asset=<account filter>, --liability=<account filter>
\t\tDefault: Income*, Expense*, Asset*, Liability*, Equity*
\t\tLet certain report commands to know what are the corresponding accounts

\t--skip-book-close[=false]
\t\tDefault: false
\t\tSkips all entries with bookClose:"true" or bookClose:true

*FILTER*
\t[ modifiers ] [ account filter, ...]
\ta set of arguments that filters entries

\tfrom:yyyy-mm-dd
\t\tlimit entries starting from this date(inclusive)

\tto:yyyy-mm-dd
\t\tlimit entries before this date(exclusive)

\t@min, @max, @year-start, @year-end, @tomorrow, @today, @month-start, @month-end
\t\tused in conjunction with from: and to:
\t\tex: "ledg info from:@min to:@max" queries everything in the book

\tmodifier:regex
\t\tqueries entries with modifiers that matches the regex
\t\tex: payee:"amazon|steam"
\t\t    tag:"pc|tablet"

\taccount filter
\t\taccounts in ledg follow this format: name[.name...], and name can ONLY contain letters and numbers, and MUST contain at least one letter

\t\tledg support fuzzy search of account names
\t\t\tex: ..cash =~ Account.Current.Cash
\t\t\t    .cash =~ Account.Cash
\t\t\t    exp$ =~ Expense
\t\t\t    exp|inc.sl =~ Expense | Income.Salary
\t\t\t    exp. =~ Expense.*
\t\t\t    exp. =~ Expense.*
\t\t\t* - matches any character
\t\t\t. - matches . literally
\t\t\t    anything in between dots matches any segments of account names that contains the letters in that order
\t\t\t    ex: .csh. matches *\\.[^.]*c[^.]*s[^.]*h[^.]*\\.* in regex


*COMMANDS*
\tCommands can be shortened as long as they are not ambiguous
\tExample: ledg accounts -> ledg acc
\t\t\t ledg info -> ledg inf

\tedit <filters> [new]
\t\tbrings up system editor to modify filtered entries
\t\tnew
\t\t\topens a blank file to manually enter new entries

\taccounts add <full account name>
\t\tcreate new account and write to FILE.config.ledg

\taccounts rename <source> <dist> [ <filter> ]
\t\tmodifies entries by replacing account source with dist
\t\t-y
\t\t\tdefaults confirmations to yes

\taccounts [--sum-parent] [--hide-zero] [--max-depth=NUM] [ <filter> ] [tree]
\t\tsums balances in selected accounts
\t\tdue to the need to sum entries from the beginning of a book, from: modifier is defaulted to @min

\t\t--sum-parent
\t\t\tallows child account balances to add to parent accounts
\t\t--hide-zero, --hide-zero=false
\t\t\thide accounts with zero balance or not
\t\t--max-depth=NUM
\t\t\tmax child account depth to show
\t\ttree
\t\t\tdisplays account balances in tree view

\tinfo [ <filter> ] [flat]
\t\tdisplays entries' information

\t\tflat
\t\t\tdisplays entries row by row rather than expanding individual transfers

\tadd [--date=yyyy-mm-dd] [-y] [description] [yyyy-mm-dd] < <account filter> [account description] <amount> [, ...]>
\t\tpush entry to book
\t\tNote: The last account transfer set can leave empty amount, and ledg will calculate it.
\t\t  ex: "ledg add cash withdrawal from bank ast..cash 100 ast..BoA.chking" will leave Asset.Current.BankOfAmerica.Checking with -100 balance

\t\t<account filter>
\t\t\t(see FILTER section)

\t\t--date=yyyy-mm-dd, -Dyyyy-mm-dd, [yyyy-mm-dd]
\t\t\tDefault: current date
\t\t\tspecifies the date of entry
\t\t-y
\t\t\tdefaults most confirmations to yes (unless ledg prompts a list to choose)

\tmodify <filter> [--date=yyyy-mm-dd] [--add-tag=A,B,C] [-remove-tag=A,B,C] [--set-mod=A:123,B:123] [--remove-mod=C,D,E]
         [-y] [description] [yyyy-mm-dd] [ <account filter> [account description] <amount> [, ...]]
\t\tbatch modify entries, see more in "add" section
\t\taccount query is not supported

\tdelete [ <filter> ] [-y]
\t\tbatch delete entries
\t\t-y
\t\t\tdefaults confirmations to yes

\tgit [...]
\t\texecutes git [...] at the parent directory of FILE


`.replace(/\*([^*\n\r]+)\*/g, c.bold('$1')));

}
