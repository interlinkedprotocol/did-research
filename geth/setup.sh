#!/bin/bash

#### Cleanup ###########################################################

echo '[1] Running cleanup'

./cleanup.sh


#### Build docker image for geth nodes #################################

echo '[2] Building docker image if image does not exist'

image=geth-interlink

if [ -z $(docker images -q $image) ]
then
    echo "image does not exist, start building..."
    docker build -t $image .
fi


#### Defining network config for docker subnet #########################


echo '[3] Defining network config for docker subnet'

subnet="10.0.1.0/24"
ips=("10.0.1.11" "10.0.1.12" "10.0.1.13")

nnodes=${#ips[@]}

if [[ $nnodes < 2 ]]
then
    echo "ERROR: There must be more than one node IP address."
    exit 1
fi


#### Create directories for each node's data ###########################

echo '[4] Configuring for '$nnodes' nodes'

n=1
for ip in ${ips[*]}
do
    bd=bdata_$n
    mkdir -p $bd/logs
    mkdir -p $bd/data/.ethereum
    mkdir -p $bd/data/.ethash

    let n++
done


#### Make static-nodes.json and store keys #############################

echo '[5] Creating Enodes and static-nodes.json'

uid=`id -u`
gid=`id -g`
pwd=`pwd`

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

echo '[6] Creating Ether accounts and genesis.json'

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


##### Complete each node's configuration ###############################

echo '[7] finishing configuration'

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


##### Create the docker-compose file ###################################

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
      - './$bd/.ethereum:/.ethereum'
      - './$bd/.ethash:/.ethash'
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
