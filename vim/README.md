# vim-ledg

### Installation
*require VIM 8.2*

Just install the entire ledg project via make install and files will be copied to ~/.vim/

### Features

This vim plugin includes filetypes for:

  - price files
    - \*.price.ledg
  - journal files
    - \*.edit.ledg
    - \*.\\d{4}.ledg
  - config files
    - \*.config.ledg
  - budget files
    - \*.budgets.ledg

And provides features:

  - syntax highlighting
  - syntax-based folding
  - error highlight
    - JSON linting in config files
    - incorrect whitespace in journal files
  - snippets
    - in journal files:
      - press i, o, O and hit space
      - press 20 and hit space
    - in price files:
      - press P and hit space

