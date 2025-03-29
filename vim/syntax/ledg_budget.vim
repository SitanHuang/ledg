" Vim syntax file
" Language: ledg_budget
" Maintainer: Sitan Huang

if exists('b:current_syntax') | finish|  endif
let b:current_syntax = 'ledg_budget'

syn clear

syn region ledgBudgetComment start="^;" end="$"

syn match ledgBudgetWrongSyntax1 "\v^\t.*$"
syn match ledgBudgetWrongSyntax2 "\v^\s{3,}.*$"


syn match ledgBudget "\v^\~.+" nextgroup=ledgBudgetEntry

syn match ledgBudgetAccount "\v^  [^\t]+"

syn region ledgBudgetMeta start="^  ;" end="$" keepend
                   \ contains=ledgBudgetMetaKey
syn match ledgBudgetMetaKey "\v[^:]+\:" contained nextgroup=ledgBudgetMetaValue
syn region ledgBudgetMetaValue start="\v." end="\v$" contained keepend
                   \ contains=ledgBudgetConstants,ledgNumber,ledgBudgetString

syn match ledgNumber "\v[-+]?[[:digit:].,]+" contained
syn keyword ledgBudgetConstants true false null contained
syn region ledgBudgetString start='"' skip='\\"' end='"' contained

hi def link ledgBudget Keyword

hi def link ledgBudgetAccount Identifier

hi def link ledgBudgetComment Comment
hi def link ledgBudgetMeta Comment
hi def link ledgBudgetMetaKey Type
hi def link ledgBudgetConstants Constant
hi def link ledgBudgetString String

hi def link ledgBudgetWrongSyntax1 Error
hi def link ledgBudgetWrongSyntax2 Error

