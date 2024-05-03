# Vivo Router Data Vis

A Node.js project to extract and store data from a Vivo Box router server interface.

![Execution demo](./images/demo.gif)

# Operation

This program uses the broadly available HTTP server of a local router to authenticate and read its current internal variables. It authenticates with user-provided credentials and handles its session while it watches the internal variables of the router for changes.

When changes are detected they are persisted locally on this project's root data folder (`./data`) in easily interpretable JSON files

## Usage

After downloading this project you must configure the `.env` file or set the credential variables for this program to successfully communicate with the router.

You may also rename the `.env.sample` to `.env` and define the `ROUTER_USERNAME` and the `ROUTER_PASSWORD` variables for the environment.

## Arguments

Argument handling is simple and processed at [getOptionsFromArgumentList.js](./src/cli/getOptionsFromArgumentList.js)

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

## Motivation

The interface of modern user-customer routers provide simple HTTP interfaces with status information such as fiber optical signal stregth, routing, interfaces data, and most importantly: the amount of bytes sent and received from each interface.

The router does not provide how its data changes over tim, so I reverse-engineered the HTTP  interface and created routines to extract, parse, save, and eventually visualize this information over time to experiment and learn some data-related skills.

## Dependencies

This project can be executed by using [node.js](https://nodejs.org/) and there are no external dependencies or packages (`npm install` is not necessary).

This repository works with the model *RTF3505VW-N2* with the software *Vivo Box BR_SV_g000_R3505VWN1001_s42*.

This is how the interface dashboard from the router looks like:

![Vivo Box Router Interface](images/interface.png)

