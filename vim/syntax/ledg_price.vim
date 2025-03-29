
" Vim syntax file
" Language: ledg_price
" Maintainer: Sitan Huang

if exists('b:current_syntax') | finish|  endif
let b:current_syntax = 'ledg_price'

syn clear

syn region ledgComment start="^;" end="$"

syn match ledgPrice "\vP\s+\d{4}-\d{2}-\d{2}" skipwhite
                   \ nextgroup=ledgPriceAmount

syn match ledgPriceAmount "\v.+$" contained

hi def link ledgComment Comment
hi def link ledgPrice Keyword
hi def link ledgPriceAmount Number
