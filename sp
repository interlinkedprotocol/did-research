#!/bin/bash

# define fonts
bold=$(tput bold)
dim=$(tput dim)
normal=$(tput sgr0)
cyan=$'\e[94m'
red=$'\e[1;31m'

# read env vars from .env so we can manipulate them depending on sp arguments
export $(grep -v '^#' .env | xargs)

if [[ $@ = *--dev* ]]; then
  export IMAGE_NAME=interlink-nodejs
  export BUILD_DIR=tools
  # just keep the container running
  export COMMAND="tail -F /none"
else
  # mount anything, but not /opt/app
  export MOUNT_VOLUME=./README.md:/tmp/README.md
fi

if [[ $@ = *--rebuild* ]]; then
  export REBUILD=true
fi

total-reset () {
  echo "${red}[!] This will:
* delete all uncommitted changes
* remove all Docker containers"
  read -p "Continue? (y/N): " choice
  if [[ $choice =~ ^[Yy]$ ]]
  then
    set -e
    if [[ $(docker ps -aq | grep interlink) ]]; then
      echo "${cyan}[ Stopping containers... ]${normal}"
      docker stop $(docker ps -aq | grep interlink)
      echo "${cyan}[ Removing containers... ]${normal}"
      docker rm $(docker ps -aq | grep interlink)
    else
      echo "${cyan}[ No containers to remove ]${normal}"
    fi
    echo "${cyan}[ Removing uncommitted changes... ]${normal}"
    reset

    echo
    echo "${cyan}All done!${normal}"
  fi
}

checkout-develop-everywhere () {
  set -e
  echo "${red}[!] This will:
* delete all uncommitted changes
* checkout develop branch and do 'git pull' "
  read -p "Continue? (y/N): " choice
  if [[ $choice =~ ^[Yy]$ ]]
  then
    reset pull
    echo
    echo "${cyan}All done!${normal}"
  fi
}

reset () {
  sudo git reset --hard HEAD
  sudo git clean -fd
  if [[ $1 = pull ]]; then
    sudo git checkout -f develop
    git pull origin develop
  fi
}

docker_compose_proxy () {
  if [ -z "$2" ]; then
    echo "${red}[!] Container name(s) were not specified${normal}"
    echo
    help
    exit 1
  fi

  # create docker network in which all our services will be running
  if [[ $1 = up ]] && ! (docker network ls | grep -q " interlink "); then
    echo -n "Creating new docker network 'interlink' ... "
    docker network create interlink && echo OK
  fi

  names="$2"
  if [[ $names = all ]]; then
    names=$(ls -a | grep docker-compose | awk -F'.' '{print $2}')
  fi

  name_array=$(echo "$names" | tr "," "\n")
  for group_name in $name_array
  do
    cmd=$1
    if [[ $1 = up ]]; then
      cmd="up -d"
      if [[ $REBUILD = true ]]; then cmd="$cmd --build"; fi
    elif [[ $1 = logs ]]; then
      cmd="logs --tail 200 -f"
    fi

    echo "[ ${cyan}$group_name${normal} ]"
    docker-compose -f docker-compose.$group_name.yml $cmd
    echo
  done
}

enter_shell () {
  if [ -z $2 ]; then
    echo "${red}[!] Container name(s) were not specified${normal}"
    echo
    help
    exit 1
  fi

  case "$2" in
    *) exec docker exec -it interlink-$2 bash ;;
  esac
}

main () {
  case "$1" in
    total-reset) total-reset ;;
    checkout-develop-everywhere | cde) checkout-develop-everywhere ;;
    up | down | restart | build | pull | config | logs | ps) docker_compose_proxy $@ ;;
    sh) enter_shell $@ ;;
    *)
      echo "${red}[!] Unrecognized command '${1}'${normal}"
      echo
      help
      exit 1
      ;;
  esac
}

help () {
  echo "Usage:

  ${bold}./sp COMMAND SERVICE_GROUP[,SERVICE_GROUP,...] [OPTIONS]
    ${dim}COMMAND
      One of the following docker-compose commands: up, down, ps, logs, restart, config

    SERVICE_GROUP
      is the string from docker-compose file names that is in between 'docker-compose.' and '.yml'
      'all' is an alias for all service groups

      It proxies CMD to docker-compose using a specified file name(s)
      For example
        ./sp ps client,ganache
      will be translated to
        docker-compose -f docker-compose.client.yml ps && docker-compose -f docker-compose.ganache.yml ps

    OPTIONS
      --dev
        if it is supplied when running './sp up ...', it won't start an app automatically.
        You will have to enter a container with './sp sh ...' and then run the app using 'npm run ...'

      --rebuild
        if it is supplied when running './sp up ...', it will rebuild docker images${normal}

  ${bold}./sp sh APP_NAME
    ${dim}Enters bash shell in a APP_NAME
    App name is container name (e.g., client).${normal}

  ${bold}./sp total-reset
    ${dim}This will:
      * delete all uncommitted changes
      * remove all Docker containers
      * remove all Docker images

  ${bold}./sp checkout-develop-everywhere ${dim}or${normal}${bold} ./sp cde
    ${dim}This will:
      * delete all uncommitted changes
      * checkout develop branch and do 'git pull' in each submodule${normal}"

}

if [ $# -eq 0 ]; then
  help
else
  main $@
fi
