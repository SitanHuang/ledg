all: check_node test clean bin/ledger

SOURCE_CORE = $(shell find lib/core/ -type f -name '*.js')
SOURCE_FS = $(shell find lib/fs/ -type f -name '*.js')
SOURCE_CLI = $(shell find lib/cli/ -type f -name '*.js')

NODE_VERSION := $(shell node --version 2>/dev/null)

check_node:
ifdef NODE_VERSION
	
else
	@echo Node.js not found
	exit
endif
	

clean:
	rm -f bin/ledger
	
header:
	echo "#!/usr/bin/env node" > bin/ledger

core: ${SOURCE_CORE}
	cat $^ >> bin/ledger

cli: ${SOURCE_CLI}
	cat $^ >> bin/ledger
	
fs: ${SOURCE_FS}
	cat $^ >> bin/ledger

bin/ledger: header core fs cli
	chmod +x bin/ledger

test: bin/ledger
	./node_modules/mocha/bin/mocha
