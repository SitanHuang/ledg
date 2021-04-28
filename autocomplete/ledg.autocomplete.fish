set -l ledg_commands edit accounts burndown close register history balancesheet\
       balancesheetequity cashflow incomestatement info tags add modify\
       delete budget print git eval stats count export

# disable file completions
complete -c ledg -f

# root subcommands
complete -c ledg -n "not __fish_seen_subcommand_from $ledg_commands" \
    -a "$ledg_commands"

# ======= level 2 subcommands =======
complete -c ledg -n "__fish_seen_subcommand_from accounts" \
    -a "add rename"

complete -c ledg -n "__fish_seen_subcommand_from info" \
    -a "flat"

complete -c ledg -n "__fish_seen_subcommand_from export" \
    -a "gnucash-transactions gnucash-accounts"

complete -c ledg -n "__fish_seen_subcommand_from git" \
    -a "checkout add commit push pull merge cherry-pick"
