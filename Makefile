all: check_node clean bin/ledg

SOURCE_CORE = $(shell find lib/core/ -type f -name '*.js')
SOURCE_FS = $(shell find lib/fs/ -type f -name '*.js')
SOURCE_CLI = $(shell find lib/cli/ -type f -name '*.js' -not -path '**/index.js' -not -path '**/commands.js')

NODE_VERSION := $(shell node --version 2>/dev/null)

check_node:
ifdef NODE_VERSION
	
else
	@echo Node.js not found
	exit
endif
	

clean:
	rm -f bin/ledg*
	
header:
	echo "#!/usr/bin/env node" > bin/ledg

core: ${SOURCE_CORE}
	cat $^ >> bin/ledg

cli: ${SOURCE_CLI}
	cat $^ >> bin/ledg
	cat lib/cli/commands.js >> bin/ledg
	cat lib/cli/index.js >> bin/ledg
	
fs: ${SOURCE_FS}
	cat $^ >> bin/ledg

bin/ledg: header core fs cli
	chmod +x bin/ledg

web: bin/ledg
	cp bin/ledg lib/gui/ledg.js

test: bin/ledg
	./node_modules/mocha/bin/mocha
