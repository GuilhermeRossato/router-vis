import attachLogToConsole from "./utils/attachLogToConsole.js";
import config from "../config.js";
import listen from "./server/listen.js";
import sendResponse from "./server/sendResponse.js";
import executeExtractionLoop from "./executeExtractionLoop.js";

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\server.log`;
attachLogToConsole(logFilePath);

async function init() {
  console.log('Server process started');
  await listen(sendResponse);
  console.log('Server process listening');
  await executeExtractionLoop();
}

init().catch(err => { console.log('Failed'); console.log(err); process.exit(1); });