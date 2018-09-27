FROM node:8-alpine

WORKDIR /opt/app

ENV PORT 80

RUN apt-get update && \
    apk add --update bash && \
    apt-get install -y vim && \
    npm i -g npm@^6.1.0

RUN cd /opt && ln -s /opt/app/node_modules
