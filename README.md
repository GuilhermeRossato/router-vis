# Vivo Router Data Vis

A project to extract, parse, store and visualize data from a router's user interface.

![Execution demo](./images/demo.gif)

# Description

This program authenticates on the HTTP server of a router and extracts its status information, usage statistics, and configuration.

The user-provided credentials for authentication are loaded from the `ROUTER_USERNAME` and `ROUTER_PASSWORD` environment variables, which can also be defined at a `.env` file (A sample file exists at `.env.sample`).

A background extraction server maintains the cookie-based session while it watches the variables for changes. When variables are updated they are saved to the `./data/` folder in `.jsonl` files.

## Usage

Executing the main node script will authenticate and straem updates to stdout:

## Arguments

```
--data               Get the current state of the router variables
--load               Wait until the next state of the router is available
--logs               Watch the extraction server logs continuously
--debug              Print extra execution logs to stdout
--shutdown           Stops the background extraction process from executing.
--restart            Stop and start the background extraction server.
--standalone once    Executes a single extraction without the execution server  
--standalone loop    Executes the extraction loop directly, without starting the execution server
```

Argument handling is processed at [getOptionsFromArgumentList.js](./src/cli/getOptionsFromArgumentList.js)

## Motivation

The interface of modern user-customer routers provide simple HTTP interfaces with status information such as fiber optical signal stregth, routing, interfaces data, and most importantly: the amount of bytes sent and received from each interface.

The router does not provide how its data changes over tim, so I reverse-engineered the HTTP  interface and created routines to extract, parse, save, and eventually visualize this information over time to experiment and learn some data-related skills.

## Dependencies

This project can be executed by using [node.js](https://nodejs.org/) and there are no external dependencies or packages (`npm install` is not necessary).

This repository works with the model *RTF3505VW-N2* with the software *Vivo Box BR_SV_g000_R3505VWN1001_s42*.

This is how the interface dashboard from the router looks like:

![Vivo Box Router Interface](images/interface.png)

