set -l ledg_commands edit accounts burndown close register history balancesheet\
       balancesheetequity cashflow incomestatement info tags add modify\
       delete budget print git eval stats count export help version

set -l ledg_options "--file= -F --light-theme --lt --csv --html --format= --transpose"\
       "--budget= --currency= --valuation-date= --valuation-eop --income= --expense="\
       "--equity= --asset= -i --confirm --alias- --real --q1 --q2 --q3 --abs"\
       "--count --cumulative --cml --account= --sort --invert --hide-zero --hz"\
       "--skip --cumulative-columns= --epoch --avg --isofull --iso --daily --weekly"\
       "--biweekly --monthly --quarterly --yearly --sum --skip-book-close --sbc"\
       "-% --percent --max-depth= --depth= --dep= --sum-parent --sp --tree --field="\
       "--date= -y --default-pending --add-tag= --remove-tag= --set-mod= --prices"\
       "--remove-mod= --do-not-adjust --simple --ledger --show-default-currency"\
       "--prices-only --pad-spaces= --right --no-config --drop= --drop-cols="\
       "--drop-columns= --csv-no-quotes --include-prices= --balance-to-currency="\
       "--debug --do-not-write-books --do-not-write-config --rewrite --tc-prices=false"\
       "--tc-expose --timeclock --cleared --eop --source= --parser= --minhour="\
       "--maxhour= --period= -P --today= --squash= --no-comma --csv-delimiter="\
       "--min-depth= --mdep= --mdepth= --interval= --flat --help --version"\
       "--include-books="

set -l ledg_modifiers "desc: description: uuid: f: from: t: to: bc: bookClose:"\
       "pending: virt: clockIn: clockOut:"


# disable file completions
complete -c ledg -f

# options
complete -c ledg -n "__fish_seen_subcommand_from $ledg_commands" \
    -a "$ledg_options $ledg_modifiers"

# root subcommands
complete -c ledg -n "not __fish_seen_subcommand_from $ledg_commands" \
    -a "$ledg_commands $ledg_options $ledg_modifiers"

# ======= level 2 subcommands =======
complete -c ledg -n "__fish_seen_subcommand_from accounts" \
    -a "add rename $ledg_options $ledg_modifiers"

complete -c ledg -n "__fish_seen_subcommand_from info" \
    -a "flat $ledg_options $ledg_modifiers"

complete -c ledg -n "__fish_seen_subcommand_from edit" \
    -a "new $ledg_options $ledg_modifiers"

complete -c ledg -n "__fish_seen_subcommand_from budget" \
    -a "edit list $ledg_options $ledg_modifiers"

complete -c ledg -n "__fish_seen_subcommand_from export" \
    -a "gnucash-transactions gnucash-accounts $ledg_options $ledg_modifiers"

complete -c ledg -n "__fish_seen_subcommand_from git" \
    -a "checkout add commit push pull merge cherry-pick $ledg_options $ledg_modifiers"
