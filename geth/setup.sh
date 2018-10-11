#!/bin/bash

subnet="10.0.0.0/24"
ips=("10.0.0.11" "10.0.0.12" "10.0.0.13")
image=geth-interlink

nnodes=${#ips[@]}

if [[ $nnodes < 2 ]]
then
    echo "ERROR: There must be more than one node IP address."
    exit 1
fi

./cleanup.sh

uid=`id -u`
gid=`id -g`
pwd=`pwd`

#### Create directories for each node's configuration ##################

echo '[1] Configuring for '$nnodes' nodes.'

n=1
for ip in ${ips[*]}
do
    bd=bdata_$n
    mkdir -p $bd/logs
    mkdir -p $bd/data/geth

    let n++
done


#### Make static-nodes.json and store keys #############################

echo '[2] Creating Enodes and static-nodes.json.'

echo "[" > static-nodes.json
n=1
for ip in ${ips[*]}
do
    bd=bdata_$n

    # Generate the node's Enode and key
    enode=`docker run -u $uid:$gid -v $pwd/$bd:/bdata $image sh -c "/opt/bootnode -genkey /bdata/data/nodekey -writeaddress; cat /bdata/data/nodekey"`
    enode=`docker run -u $uid:$gid -v $pwd/$bd:/bdata $image sh -c "/opt/bootnode -nodekeyhex $enode -writeaddress"`
    # Add the enode to static-nodes.json
    sep=`[[ $n < $nnodes ]] && echo ","`
    echo '  "enode://'$enode'@'$ip':30303"'$sep >> static-nodes.json

    let n++
done
echo "]" >> static-nodes.json


#### Create accounts, keys and genesis.json file #######################

echo '[3] Creating Ether accounts and genesis.json.'

cat > genesis.json <<EOF
{
  "alloc": {
EOF

n=1
for ip in ${ips[*]}
do
    bd=bdata_$n

    # Generate an Ether account for the node
    touch $bd/passwords.txt
    account=`docker run -u $uid:$gid -v $pwd/$bd:/bdata $image /opt/geth --datadir /bdata/data --password /bdata/passwords.txt account new | cut -c 11-50`

    # Add the account to the genesis block so it has some Ether at start-up
    sep=`[[ $n < $nnodes ]] && echo ","`
    cat >> genesis.json <<EOF
    "${account}": {
      "balance": "1000000000000000000000000000"
    }${sep}
EOF

    let n++
done

cat >> genesis.json <<EOF
  },
  "coinbase": "0x0000000000000000000000000000000000000000",
  "config": {
    "chainId": 783,
    "byzantiumBlock": 0,
    "homesteadBlock": 0
  },
  "difficulty": "0x0",
  "extraData": "0x",
  "gasLimit": "0x2FEFD800",
  "mixhash": "0x00000000000000000000000000000000000000647572616c65787365646c6578",
  "nonce": "0x0",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "timestamp": "0x00"
}
EOF


##### Complete each node's configuration ################################

echo '[4] finishing configuration.'

n=1
for ip in ${ips[*]}
do
    bd=bdata_$n

    cp genesis.json $bd/genesis.json
    cp static-nodes.json $bd/data/static-nodes.json

    cp templates/start-node.sh $bd/start-node.sh
    chmod 755 $bd/start-node.sh

    let n++
done
rm -rf genesis.json static-nodes.json


##### Create the docker-compose file ####################################

cat > docker-compose.yml <<EOF
version: '3.4'
services:
EOF

n=1
for ip in ${ips[*]}
do
    bd=bdata_$n

    cat >> docker-compose.yml <<EOF
  node_$n:
    image: $image
    volumes:
      - './$bd:/bdata'
      - '~/.ethereum:/.ethereum'
      - '~/.ethash:/.ethash'
    networks:
      interlink-net:
        ipv4_address: '$ip'
    ports:
      - "$((n+22000)):8545"
    user: '$uid:$gid'
EOF

    let n++
done

cat >> docker-compose.yml <<EOF

networks:
  interlink-net:
    external:
      name: interlink
EOF

