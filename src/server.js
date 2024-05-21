import attachToConsole from "./utils/attachToConsole.js";
import config from "../config.js";
import sendResponse from "./server/sendResponse.js";
import createDataServer from "./server/createDataServer.js";
import executeExtractionLoop from "./executeExtractionLoop.js";

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\server.log`;
attachToConsole('log', logFilePath, true);

if (!config.debug) {
  console.debug = () => {}
}

async function init() {
  console.debug('Extraction server started');
  await createDataServer(sendResponse);
  console.debug('Extraction server listening');
  await executeExtractionLoop();
}

init().catch(err => { console.log('Failed'); console.log(err); process.exit(1); });