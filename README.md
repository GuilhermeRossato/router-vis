# Vivo Router Data Vis

A project to extract, parse, store and visualize data from a router's user interface.

![Execution demo](./images/demo.gif)

# Description

This program authenticates on the HTTP server of a router and extracts its status information, usage statistics, and configuration.

The user-provided credentials for authentication are loaded from the config file which is populated when the program first executes.

The data extraction process maintains a session and watch variables for changes to save them locally at the `./data/` folder in `.jsonl` format.

## How to use

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

