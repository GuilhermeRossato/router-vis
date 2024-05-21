import attachToConsole from "./src/utils/attachToConsole.js";
import config from "./config.js";
import checkExtractionServer from "./src/cli/checkExtractionServer.js";
import sendRequest from "./src/cli/sendRequest.js";
import getOptionsFromArgumentList from "./src/cli/getOptionsFromArgumentList.js";
import sleep from "./src/utils/sleep.js";
import executeExtractionLoop from "./src/executeExtractionLoop.js";
import executeDetachedCommand from "./src/utils/executeDetachedCommand.js";
import { responseHandlerTypeRecord } from "./src/server/sendResponse.js";

let debug = false;

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\client.log`;
attachToConsole("log", logFilePath, config.debug);

async function init() {
  const options = getOptionsFromArgumentList(process.argv);
  debug = options.debug;
  if (debug) {
    console.log(options);
  }
  if (options.shutdown || options.restart) {
    const state = await sendRequest('init');
    if (debug) {
      console.log('First extraction status response:', state);
    }
    if (state.error && state.stage === "network") {
      console.log('Shutdown request failed because the connection could not be created');
    } else {
      await sendRequest('exit');
      await sleep(500);
    }
  }
  
  if (options.restart || (!options.standalone && !options.shutdown)) {
    if (!options.shutdown) {
      if (debug) {
        console.log('Asserting the execution of the extraction server (not standalone mode)');
      }
      const status = await checkExtractionServer();
      if (debug) {
        console.log('First extraction status response:', status);
      }
    }
  }

  const acts = [];

  if (options.standalone === 'loop') {
    acts.push(executeExtractionLoop.bind(null, true));
  } else if (options.standalone === 'once') {
    acts.push(executeExtractionLoop.bind(null, false));
  } else if (options.standalone) {
    throw new Error(`Invalid standalone command: "${options.standalone}"`);
  }

  if (options.logs) {
    acts.push(streamExtractionServerLogs);
  }

  if (options.data) {
    acts.push(sendDataRequest);
  }

  if (acts.length === 0 && !options.shutdown && !options.standalone) {
    if (debug) {
      console.log('Executing interface mode because no actions is specified');
    }
    return await executeInterfaceMode();
  }

  if (acts.length === 0) {
    console.log('Nothing to do. Program will exit.');
    process.exit(0);
  }

  if (debug) {
    console.log('Executing', acts.length, 'client actions');
  }
  await Promise.all(acts.map(a => a()));
}

async function executeInterfaceMode() {
  const url = `http://${config.host || '127.0.0.1'}:${config.port}/`;
  const cmd = `start ${url}`;
  console.log('Opening interface at:', url);
  executeDetachedCommand(cmd);
}

async function sendDataRequest() {
  const response = await sendRequest('data', {});
  if (response && response.record) {
    console.log('Server data response:');
    console.log(response.record);
  } else {
    console.log('Unexpected server response:');
    console.log(response);
  }
}
async function streamExtractionServerLogs() {
  console.log('Streaming extraction logs. Press Ctrl+C to stop.');
  let logResponse = await sendRequest('logs', { wait: true, });
  while (logResponse && logResponse.logs) {
    if (logResponse.message) {
      process.stdout.write(`[E] [M] ${logResponse.message.trim()}\n`);
    }
    for (const log of logResponse.logs) {
      process.stdout.write(`[E] ${log.date} - ${log.source} - ${log.text}\n`);
    }
    await sleep(400);
    logResponse = await sendRequest('logs', { wait: true, cursor: logResponse.cursor });
  }
  console.log('Streaming of extraction logs stopped.');
  if (debug) {
    console.log('Last server response:');
    console.log({...logResponse, logs: logResponse && logResponse.logs instanceof Array ? logResponse.logs.length : null});
  }
  process.exit(1);
}


init().catch((err) => {
  console.log("Failed");
  console.log(err);
  process.exit(1);
});
