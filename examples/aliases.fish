# The following are SitanHuang's personal fish shell aliases

# make sure to copy ~/.config/fish/completions/ledg.fish to ~/.config/fish/completions/l.fish
# and change replace `ledg` with `l` in the file
alias l="ledg"

alias lr="l --real"
alias lra="l --real ass\* --hz=false"
alias la="l ass\* --hz=false"
alias lpend="l info pending:true"

function lb
  l bs f:@min t:@max --interval=10000,0,0 --isofull --asset=\* $argv | \
  sed -e '1,4d' | head -n -5 | # trim start and end
  sed -e "s/\x1b\[4m//g" | # remove underline
  less -XR --quit-if-one-screen
end
