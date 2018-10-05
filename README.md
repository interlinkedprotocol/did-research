# Interlinked project

## Before you start

The recommended setup includes the next tools:

* Git 2.16.2 (including SSH setup):

    Follow the [next guidelines](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to start the submodules once you have cloned the repo.

* Docker 18.03.1-ce

* Docker-compose 1.21.1

Once you finish the installation of these tools, the steps to initialise the project are as follows:

```bash
$ git clone git@github.com:interlinkedprotocol/interlinkedprotocol.git
```

## Use `sp` script to start the application (or part of it)

Before you begin, make sure that docker wokrs without sudo by running `docker run --rm hello-world`

`sp` can start apps in two modes: Prod and Dev.
As a QA you don't need Dev mode.
As a developer you might want to run the whole set of containers in Prod mode and then stop one, which you want to develop, and run it in Dev mode.

Continue reading to see how to use `sp` script

### Steps to get it running

Check container status:
- `docker ps`
- `./sp ps all`
- `./sp ps client`
- `./sp ps geth`

1. Run client in dev mode -> `./sp up client --dev`
2. Access docker container console -> `./sp sh client`
3. Start client inside docker container -> `npm start` and wait for client to start
4. Open `localhost:8545` in your browser (edited)

if need to kill some of our containers then use `./sp down {container name}` e.g. `./sp down client`
if need to kill all our containers then use `./sp down all`
if need to kill all docker containers on the machine then use `docker rm -f $(docker ps -a -q)`

### How it works

When you run `./sp up client,geth` it will
1. Split comma separated service groups
2. Will generate and execute command like this
   ```
   docker-compose run -f docker-compose.client.yml && docker-compose run -f docker-compose.geth.yml
   ```
All docker-compose files here use the same docker network (named 'interlink') in which all containers will run in order to be connected with each other.

### Differences between Prod and Dev modes

| Prod | Dev |
|-|-|
| is a default mode | specify `--dev` flag when running `sp up ...` <br /> likes this: `./sp up all --dev` |
| less CPU and MEM usage | more CPU and MEM usage because `npm run start:dev` also runs file watcher. <br /> And for frontend you need nodejs too, whereas in Prod mode a lightweight nginx server will serve static files |
| for api-* and client containers it builds a docker image using Dockerfile in a submodule | uses nodejs as a base image and adds a few minor things |
| doesn't map source code into containers | maps source code into containers so it's possible to edit files locally while using npm in the containers |
| apps in containers start as if in production (simply follows instructions in Dockerfiles) | starts a container but doesn't start an app <br /> it runs `tail -F /none` just so the container keeps running |
|-|in order to start an app in a container 1) enter the container with `./sp sh <service-name>`; 2) run whatever you want to run (e.g. `npm run start:dev`) |
|-|maps project folders to containers so it's possible to edit files locally while using npm in the containers|

### Usage

See `./sp` output

### Use Cases and Troubleshooting

* As a **QA** I want to start everything
  * `./sp up all`
  * Run `./sp ps all` and make sure everything has status "Up"
* Something isn't working
  * Check that containers have status "Up" by running `./sp ps all`
  * If a container is in state Restarting, see its logs (`./sp logs <service-group>`)
* I probably did something wrong. I want to reset and rebuild everything
  * `./sp total-reset` -- will kill all containers, remove uncommitted changes
  * `./sp up all --rebuild` -- will rebuild containers and start everything
* I want to make sure I'm using the latest code base
  * `./sp down all` -- stop everything first
  * `./sp checkout-develop-everywhere` -- will do `git checkout`
  * `./sp up all`
* As a **developer** I want to work on `ganache` implementation and I **don't need Frontend (React app)**
  * `./sp up ganache --dev` -- will start geth container with mapped source coude using docker volumes
  * `./sp sh ganache` -- you now entered a container
  * [only once] `rm -rf node_modules && npm install` -- node_modules are mapped from host machine to a container so you may want to remove that dir to avoid some issues, and then do `npm install` to install everything
  * `npm start` or `npm run start:dev` or `npm run test` or ...
  * Hit `Ctrl+C` if you want to stop the process (just like you do without containers)
* As a **developer** I want to work on `ganache` implementation and I **need Frontend**
  * `./sp up ganache,client`
  * *Now follow the instructions from the use case above*
* As a **developer** I want to work on the **Frontend app**
  * see above, but run `./sp up client --dev` then `./sp sh client`
* Error **EADDRINUSE** when I run `npm run start:dev` in a container  
  Most likely you've started container in Prod mode where the server is already running in the container.  
  Try stopping it (e.g. `./sp down client`) and then running in Dev mode (e.g. `./sp up client --dev`)
* `npm install` fails with `npm ERR! Error while executing: npm ERR! /usr/bin/git ls-remote -h -t https://github.com/...`
  or if you see `npm ERR! fatal: Not a git repository: ../.git/modules/client`
  that is a bug in some package that tries to `cd` level up in directories, but because we mount only submodule,
  there's no `.git` directrory on the upper level.  
  **Solution**: rename `.git` then run `npm install`: `mv .git _git; npm i; mv _git .git`


## Application URLs

Once you run the `Default mode`, the next applications will be available:

* Frontend (Whole application): http://localhost:3010
* Ganache: http://localhost:8545
* Geth: http://localhost:8545
