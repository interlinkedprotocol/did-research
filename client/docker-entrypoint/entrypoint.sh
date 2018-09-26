#!/bin/sh

set -ex

if [[ "$@" = 'nginx-fe' ]]; then
    exec nginx -g "daemon off;"
fi

exec "$@"
