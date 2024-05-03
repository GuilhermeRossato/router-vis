import attachLogToConsole from "./src/utils/attachLogToConsole.js";
import config from "./config.js";
import checkExtractionServer from "./src/cli/checkExtractionServer.js";
import sendRequest from "./src/cli/sendRequest.js";
import getOptionsFromArgumentList from "./src/cli/getOptionsFromArgumentList.js";
import sleep from "./src/utils/sleep.js";
import initExtractionLoop from "./src/executeExtractionPair.js";

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\client.log`;
attachLogToConsole(logFilePath);

async function init() {
  const options = getOptionsFromArgumentList(process.argv);
  const debug = options.debug;
  if (debug) {
    console.log(options);
  }
  const isStopRequest = options.shutdown;
  if (isStopRequest) {
    const state = await sendRequest({ type: 'init' });
    if (state.error && state.stage === "network") {
      console.log('Extraction server did not respond');
    } else {
      await sendRequest({ type: 'exit' });
      await sleep(500);
    }
  }
  if (!options.standalone) {
    const status = await checkExtractionServer();
    debug && console.log('Extraction server uptime:', status.uptime);
    return;
  }

  if (options.standalone === 'loop') {
    initExtractionLoop();
  } else if (options.standalone === 'once') {
    initExtractionLoop(false);
  } else {
    throw new Error('Invalid standalone command');
  }
}

init().catch((err) => {
  console.log("Failed");
  console.log(err);
  process.exit(1);
});
