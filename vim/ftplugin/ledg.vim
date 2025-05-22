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
setlocal colorcolumn=

setlocal foldmethod=syntax

autocmd BufWritePre *.ledg :%s/\s\+$//e
autocmd BufWritePre *.ledg2 :%s/\s\+$//e

func Eatchar(pat)
   let c = nr2char(getchar(0))
   return (c =~ a:pat) ? '' : c
endfunc

iabb <silent> <buffer> 20 <C-R>=strftime("%Y-%m-%d")<CR>
abb <buffer> virt <space><space>;virt:true<CR><c-r>=Eatchar('\s')<cr>
abb <buffer> tags <space><space>;tags:"<c-r>=Eatchar('\s')<cr>
abb <buffer> payee <space><space>;payee:"<c-r>=Eatchar('\s')<cr>
" iabb <silent> <buffer> i i <C-R>=strftime("%Y-%m-%d %T")<CR>
" iabb <silent> <buffer> o o <C-R>=strftime("%Y-%m-%d %T")<CR><CR><c-r>=Eatchar('\s')<cr>
" iabb <silent> <buffer> O O <C-R>=strftime("%Y-%m-%d %T")<CR><CR><c-r>=Eatchar('\s')<cr>

inoremap <tab> <c-v><tab>
