import path from "node:path";
import attachToConsole from "../utils/attachToConsole.js";
import { config, dataFileName } from "../../settings.js";
import sendResponse from "./sendResponse.js";
import createDataServer from "./createDataServer.js";
import executeExtraction from "../executeExtraction.js";

if (typeof config.projectPath !== "string") {
  throw new Error("Invalid project path");
}

attachToConsole("log", dataFileName.serverLog);

if (!config.debug) {
  console.debug = () => {};
}
console.debug(
  `Starting "${path.basename(process.argv[1])}" with`,
  process.argv.slice(2),
  `at "${process.cwd()}"`,
);


async function init() {
  console.log("Extraction server started");
  await createDataServer(sendResponse);
  console.log("Extraction server listening");
  await executeExtraction();
}

init().catch((err) => {
  console.log("Failed");
  console.log(err);
  process.exit(1);
});
