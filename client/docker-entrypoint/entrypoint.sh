#!/bin/sh

set -ex

replace_var() {
    # $1 var name
    # $2 file name
    eval "value=\$$1"
    if [ -z "$value" ]; then
        echo "Undefined variable $1"
        exit 1
    fi
    sed -i "s,%$1%,$value,g" $2
}

if [[ "$@" = 'nginx-fe' ]]; then

    # go through all JS files and replace %VAR_NAME% with VAR_NAME value from env variables
    find /var/www/app -type f -name "*.js" | while read filename; do
        replace_var REACT_APP_NETWORK_HOST $filename
        replace_var REACT_APP_BLOCKCHAIN_PORT $filename
    done

    exec nginx -g "daemon off;"
fi

exec "$@"
