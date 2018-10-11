#!/bin/bash

set -u
set -e

if [ ! -d /bdata/data/geth/chaindata ]; then
  echo "[*] Mining Genesis block"
  /opt/geth --datadir /bdata/data init /bdata/genesis.json
fi

sleep 2

echo "[*] Starting node"
nohup /opt/geth --datadir /bdata/data --rpc --rpccorsdomain '*' --rpcaddr 0.0.0.0 --rpcport 8545 --rpcapi admin,eth,debug,miner,net,txpool,personal,web3 --nodiscover --unlock 0 --password /bdata/passwords.txt 2>>/bdata/logs/geth.log
