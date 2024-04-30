import attachLogToConsole from "./src/utils/attachLogToConsole.js";
import config from "./config.js";
import checkExtractionServer from "./src/cli/checkExtractionServer.js";

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\client.log`;
attachLogToConsole(logFilePath);

async function init() {
  console.log('Started client script');
  const status = await checkExtractionServer();
  console.log('Client script got status:');
  console.log(status);
}

init().catch((err) => {
  console.log("Failed");
  console.log(err);
  process.exit(1);
});
