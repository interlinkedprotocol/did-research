FROM debian:buster-slim

RUN apt-get update \
     && apt-get install -y wget \
     && rm -rf /var/lib/apt/lists/*

WORKDIR "/opt"
ARG BINARY="geth-alltools-linux-amd64-1.8.1-1e67410e.tar.gz"
RUN wget "https://gethstore.blob.core.windows.net/builds/$BINARY"
RUN tar -xzvf $BINARY --strip 1
RUN rm $BINARY

CMD ["/bdata/start-node.sh"]
