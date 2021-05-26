" Vim syntax file
" Language: ledg
" Maintainer: Sitan Huang

if exists('b:current_syntax') | finish|  endif
let b:current_syntax = 'ledg'

syn clear

syn region ledgComment start="^;" end="$"

syn match ledgTimelog "\v^[iO]" skipwhite nextgroup=ledgTimelogEntry
syn match ledgTimelogPending "\v^o" skipwhite nextgroup=ledgTimelogEntry

syn match ledgTimelogEntry "\v\d{4}\-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?"
                   \ nextgroup=ledgTimelogAccount,ledgUUID contained

syn region ledgTimelogAccount start="\s" end="$" keepend
                   \ contained contains=ledgAccount,ledgUUID


syn match ledgWrongSyntax1 "\v^\t.*$"

syn match ledgDate "\v^\d{4}\-\d{2}\-\d{2}" skipwhite
                   \ nextgroup=ledgEntry

syn match ledgEvent "event " contained

syn region ledgEntry start="\v\s+" end="\v^([0-9a-zA-Z])@=" keepend contained fold
                   \ contains=ledgPending,ledgUUID,ledgComment,ledgMeta,ledgTransfer,ledgComment,ledgWrongSyntax1,ledgEvent
                   \ nextgroup=ledgDate,ledgTimelog,ledgTimelogPending
syn match ledgPending "!" contained
syn match ledgUUID "\v\#[a-zA-Z0-9]{8}\s*$" contained


syn region ledgTransfer start="^  \v[^\t]*" end="$" keepend contained
                   \ contains=ledgTransferAccount
syn region ledgTransferAccount start="\t" end="\t" keepend contained
                   \ contains=ledgAccount nextgroup=ledgTransferAmount
syn match ledgTransferAmount "\v.+" contained
syn match ledgAccount "\v[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+" contained


syn region ledgMeta start="^  ;" end="$" keepend
                   \ contains=ledgMetaKey
syn match ledgMetaKey "\v[^:]+\:" contained nextgroup=ledgMetaValue
syn region ledgMetaValue start="\v." end="\v$" contained
                   \ contains=ledgConstants,ledgNumber,ledgString

syn match ledgNumber "\v[-+]?[[:digit:].,]+" contained
syn keyword ledgConstants true false null contained
syn region ledgString start='"' skip='\\"' end='"' contained

hi def link ledgDate Keyword
hi def link ledgEvent Keyword
hi def link ledgTimelog Keyword
hi def link ledgTimelogEntry Keyword
hi def link ledgUUID Identifier
hi def link ledgPending Error

hi def link ledgTransferAccount Identifier
hi def link ledgAccount Identifier

hi def link ledgComment Comment
hi def link ledgMeta Comment
hi def link ledgMetaKey Type

hi def link ledgConstants Keyword
hi def link ledgNumber Number
hi def link ledgTransferAmount Number
hi def link ledgString String

hi def link ledgWrongSyntax1 Error
hi def link ledgTimelogPending Error
