" Vim syntax file
" Language: ledg (v2)
" Maintainer: Sitan Huang

if exists('b:current_syntax') | finish | endif
let b:current_syntax = 'ledg'

syn clear

" Basic elements
syn region ledgComment start="^;" end="$"
syn match ledgUUID "\v\#[a-zA-Z0-9]{8}\s*$" contained
syn keyword ledgConstants true false null contained
syn region ledgString start='"' skip='\\"' end='"' contained
syn match ledgNumber "\v[-+]?[[:digit:].,]+" contained

" Include directive
syn match ledgInclude "\v^include\s+" nextgroup=ledgFilePath
syn match ledgFilePath "\v\S.*" contained
hi def link ledgInclude Keyword
hi def link ledgFilePath String

" Dates and time handling
syn match ledgDate "\v^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?(\=\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?)?" skipwhite nextgroup=ledgEntry
syn match ledgDateInMeta "\v(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?(\=\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?)?|\=\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?)" contained

" Accounts and transfers
syn match ledgAccount "\v[a-zA-Z0-9]+([:.][a-zA-Z0-9]+)*" contained
syn region ledgVirtualAccount start="\[" end="\]" contains=ledgAccount contained
syn region ledgTransfer start="^  \v[^\t]*" end="$" keepend contained contains=ledgTransferAccount
syn region ledgTransferAccount start="\t" end="\t" keepend contained contains=ledgAccount,ledgVirtualAccount nextgroup=ledgTransferAmount

" Value expressions
syn match ledgOperator "[-+*/=,]" contained
syn match ledgFunction "\<[A-Z]\+\ze(" contained
syn region ledgCurrencyAmount start="\[" end="\]" contained contains=ledgNumber,ledgCurrency,ledgOperator,ledgParen
syn match ledgCurrency "\v([A-Z]{3}|[$£€])" contained
syn match ledgParen "[()]" contained
syn match ledgTransferAmount "\v.*" contained contains=ledgNumber,ledgOperator,ledgFunction,ledgCurrencyAmount,ledgParen,ledgComma,ledgString

" Metadata and special marks
syn region ledgMeta start="^  ;" end="$" keepend contains=ledgPostingPending,ledgDateInMeta,ledgMetaKey
syn match ledgMetaKey "\v[^0-9:!\= ;][^:;! \=]*\:" contained nextgroup=ledgMetaValue
syn region ledgMetaValue start="\v." end="\v$" contained contains=ledgConstants,ledgNumber,ledgString,ledgDateInMeta,ledgPostingPending
syn match ledgPostingPending "!" contained

" Main transaction structure
syn region ledgEntry start="\v\s+" end="\v^([0-9a-zA-Z])@=" keepend contained fold
                    \ contains=ledgPending,ledgUUID,ledgComment,ledgMeta,ledgTransfer,ledgEvent,ledgOpen,ledgClose
                    \ nextgroup=ledgDate
syn match ledgPending "!" contained
syn match ledgEvent "event " nextgroup=ledgEventType
syn match ledgEventType "\S\+" contained
syn match ledgOpen "open " nextgroup=ledgAccount
syn match ledgClose "close " nextgroup=ledgAccount

" Error highlighting
syn match ledgWrongSyntax1 "\v^\t.*$"

" Highlight links
hi def link ledgDate Keyword
hi def link ledgDateInMeta Keyword
hi def link ledgEvent Keyword
hi def link ledgEventType Type
hi def link ledgOpen Keyword
hi def link ledgClose Keyword
hi def link ledgUUID Identifier
hi def link ledgPending Error
hi def link ledgPostingPending Error

hi def link ledgTransferAccount Identifier
hi def link ledgAccount Identifier
hi def link ledgVirtualAccount Identifier

hi def link ledgComment Comment
hi def link ledgMeta Comment
hi def link ledgMetaKey Type

hi def link ledgConstants Keyword
hi def link ledgNumber Number
hi def link ledgTransferAmount Number
hi def link ledgString String
hi def link ledgOperator Operator
hi def link ledgFunction Function
hi def link ledgCurrency Constant
hi def link ledgParen Delimiter

hi def link ledgWrongSyntax1 Error

" Price files
syn match ledgPrice "\vP\s+\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?" skipwhite
                    \ nextgroup=ledgPriceAmount

syn match ledgPriceAmount "\v.+$" contained

hi def link ledgComment Comment
hi def link ledgPrice Keyword
hi def link ledgPriceAmount Number