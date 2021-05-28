all: clean bin/ledg SCRIPTS

SOURCE_CORE = $(shell find lib/core/ -type f -name '*.js')
SOURCE_FS = $(shell find lib/fs/ -type f -name '*.js')
SOURCE_CLI = $(shell find lib/cli/ -type f -name '*.js' -not -path '**/index.js' -not -path '**/commands.js' -not -path 'lib/cli/charts/chart.js')

NODE_VERSION = $(shell node -v | cut -c2-3)
GOOD_NODE = $(shell if [ $(NODE_VERSION) -ge 14 ]; then echo true; fi)

ifeq (, $(shell which git))
COMMIT_HASH=
else
COMMIT_HASH=$(shell [ -d .git ] && git rev-parse --short HEAD)
endif

check_node:
	mkdir -p bin
ifeq ($(GOOD_NODE),)
	$(error Node.js not found or lower than version 14)
endif

SCRIPTS:
	#cd scripts; \
	#	echo *.js | tr ' ' '\n' | xargs -n1 -I{} cp "{}" "../bin/ledg-{}" \
	#chmod +x bin/ledg-* \


clean:
	rm -f bin/ledg*

uninstall:
	rm -f ~/.config/fish/completions/ledg.fish
	rm -f ~/bin/ledg
	rm -f ~/bin/ledg-*
	rm -f ~/.vim/syntax/ledg.vim
	rm -f ~/.vim/syntax/ledg_price.vim
	rm -f ~/.vim/syntax/ledg_budget.vim
	rm -f ~/.vim/ftplugin/ledg.vim
	rm -f ~/.vim/ftplugin/ledg_price.vim
	rm -f ~/.vim/ftplugin/ledg_budget.vim
	rm -f ~/.vim/ftdetect/ledg.vim
	find ~/.config/fish/ -type d -empty -delete
	rmdir --ignore-fail-on-non-empty ~/bin


header:
	echo "#!/usr/bin/env node" > bin/ledg
	echo "const LEDG_COMMIT_HASH='$(COMMIT_HASH)';" >> bin/ledg

core: ${SOURCE_CORE}
	cat $^ >> bin/ledg

cli: ${SOURCE_CLI}
	cat lib/cli/charts/chart.js >> bin/ledg
	cat $^ >> bin/ledg
	cat lib/cli/commands.js >> bin/ledg
	cat lib/cli/index.js >> bin/ledg

fs: ${SOURCE_FS}
	cat $^ >> bin/ledg

bin/ledg: check_node header core fs cli
	chmod +x bin/ledg

binary: bin/ledg
	pkg --compress Brotli bin/ledg

fish_autocomplete:
	mkdir -p ~/.config/fish/completions/
	cp autocomplete/ledg.autocomplete.fish ~/.config/fish/completions/ledg.fish

vim_scripts:
	mkdir -p ~/.vim/syntax ~/.vim/ftplugin ~/.vim/ftdetect/
	rm -f ~/.vim/syntax/ledg.vim
	rm -f ~/.vim/syntax/ledg_price.vim
	rm -f ~/.vim/syntax/ledg_budget.vim
	rm -f ~/.vim/ftplugin/ledg.vim
	rm -f ~/.vim/ftplugin/ledg_price.vim
	rm -f ~/.vim/ftplugin/ledg_budget.vim
	rm -f ~/.vim/ftdetect/ledg.vim
	cp vim/syntax/* ~/.vim/syntax
	cp vim/ftplugin/* ~/.vim/ftplugin
	cp vim/ftdetect/* ~/.vim/ftdetect

install: bin/ledg SCRIPTS fish_autocomplete vim_scripts
	mkdir -p ~/bin
	rm -f ~/bin/ledg
	rm -f ~/bin/ledg-*
	ln -s $(realpath bin/ledg) ~/bin/ledg
	# ln -s $(realpath bin/ledg-time.js) ~/bin/ledg-time

test: bin/ledg
	mkdir -p ./test/tmp/
	./node_modules/mocha/bin/mocha --bail
