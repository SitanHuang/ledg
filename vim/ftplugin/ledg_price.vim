setlocal listchars=tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨
setlocal ts=45
setlocal sw=45
setlocal softtabstop=45
setlocal nowrap
setlocal list
setlocal autoindent
setlocal copyindent
setlocal preserveindent
setlocal nocindent
setlocal nosmartindent
setlocal noexpandtab
setlocal shiftwidth=2
setlocal indentexpr=

autocmd BufWritePre *.ledg :%s/\s\+$//e

iabb <silent> <buffer> P P <C-R>=strftime("%Y-%m-%d")<CR>

inoremap <tab> <c-v><tab>
