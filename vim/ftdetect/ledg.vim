function! GetFiletypes()
  let rtps = split(&runtimepath, ",")
  let filetypes = []

  for rtp in rtps
    let syntax_dir = rtp . "/syntax"
    if (isdirectory(syntax_dir))
      for syntax_file in split(glob(syntax_dir . "/*.vim"), "\n")
        call add(filetypes, fnamemodify(syntax_file, ":t:r"))
      endfor
    endif
  endfor

  return uniq(sort(filetypes))
endfunction

augroup ledg
  au!
  au BufNewFile,BufRead *.ledg,*.ledg2 setf ledg
  au BufNewFile,BufRead *.prices.ledg setf ledg_price
  au BufNewFile,BufRead *.budgets.ledg setf ledg_budget
  if index(GetFiletypes(), 'json') >= 0
    au BufNewFile,BufRead *.config.ledg setf json
  else
    au BufNewFile,BufRead *.config.ledg setf javascript
  endif
augroup END
