#!/bin/bash

echo '- Removing all containers based on testnet node image'

image=geth-interlink

docker ps -a | awk '{ print $1,$2 }' | grep $image | awk '{print $1 }' | xargs -I {} docker rm {}

echo '- Removing testnet node image'

docker rmi $(docker images -q $image | uniq) --force

echo '- Removing data nodes and all previously builded files'

rm -rf bdata_[0-9] bdata_[0-9][0-9]
rm -f docker-compose.yml
rm -f static-nodes.json genesis.json
