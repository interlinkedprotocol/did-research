FROM node:8-alpine

WORKDIR /opt/app

ENV PORT 80

RUN apk update && \
    apk add --update bash && \
    apk add vim && \
    npm i -g npm@^6.1.0

RUN cd /opt && ln -s /opt/app/node_modules
