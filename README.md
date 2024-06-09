# Router Vis Extractor

A project to extract, save and provide data from a router's state over time.

![Execution demo](./images/demo.gif)

# Description

This program uses the default HTTP interface provided by routes to authenticate and read status information, connected hosts, and usage statistics. 

A long-running background process extracts and watches variables for changes, saving updates to csv files separated in folders by type and hour (`./data/{type}/{variable}/{yyyy-mm-dd-hh}.csv`).

The extraction uses a session id that can be set with the `--session` argument or loaded from `./data/session-id.txt`. If a valid one is not found it performs authentication (login) with user-provided credentials configured in the `ROUTER_USERNAME` and `ROUTER_PASSWORD` environment variables. The sample file `.env.sample` can be populated and renamed to `.env`

## How to use

Download with [git](https://www.git-scm.com/) and start it with [node.js](https://nodejs.org/), no dependencies are needed:

```
git clone 

Download and execute the main script with `npm run start`, `yarn start` or `node index.js`. The initial setup will execute, the extraction will begin, and the router usage information will be printed continuously.

The extraction is done in a separated process that will remain executing even after stopping the command (with `Ctrl+C` or `Ctrl+D`). If you don't want that specify the `--standalone` arg.

## Config Arguments

```
--usage / --kb / --mb      Stream usage data (default)
--speed / --kbps / --mbps  Stream usage speed data
--debug                    Print extra execution logs
--config                   Start config mode to update and persist changes
--shutdown                 Stops the background extraction process from executing.
--restart                  Stop and restart the background extraction server.
--standalone               Executes the extraction directly (without the background execution server).
--logs                     Watch the extraction server logs continuously
```

Default arguments can be configured at the root file `./config.js`. 

## Motivation

The interface of modern user-customer routers provide simple HTTP interfaces with status information such as fiber optical signal stregth, routing, interfaces data, and most importantly: the amount of bytes sent and received from each interface.

My router does not provide its data over time so I reverse-engineered its HTTP interface and implemented a process to extract, save, and visualize usage over time to get some network usage insights but the primary objective was to experiment with project organization while learning some data-related skills.

## Dependencies

This project can be executed by using [node.js](https://nodejs.org/) and there are no external dependencies or packages (`npm install` is not necessary).

This repository works with the router model *RTF3505VW-N2* that runs with the program *Vivo Box BR_SV_g000_R3505VWN1001_s42*.

This is how the interface dashboard from the router looks like:

![Vivo Box Router Interface](images/interface.png)

