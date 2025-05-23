#!/usr/bin/bash

wget https://nodejs.org/dist/v24.1.0/node-v24.1.0-linux-x64.tar.xz

tar xf node-v24.1.0-linux-x64.tar.xz

rm -f node-v24.1.0-linux-x64.tar.xz

mv node-v24.1.0-linux-x64/bin/node bin/ledg2

rm -rf node-v24.1.0-linux-x64

node --experimental-sea-config sea-config.json

npx postject bin/ledg2 NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2