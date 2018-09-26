FROM node:8

WORKDIR /opt/app

ENV PORT 80

RUN apt-get update && \
    apt-get install -y vim && \
    npm i -g npm@^6.1.0

# Workaround for references to node_modules in a parent dir in komgo-member-api/package.json
RUN cd /opt && ln -s /opt/app/node_modules
