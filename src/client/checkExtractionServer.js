import sleep from "../utils/sleep.js";
import startDetachedServer from "./startDetachedServer.js";
import fs from "node:fs";
import {config} from "../../settings.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";
import { sendRequest } from "./sendRequest.js";

async function startServerAndWatchLogs() {
  const logFilePath = `${config.projectPath}\\server.log`;
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, "", "utf-8");
  }
  let startContent = await asyncTryCatchNull(fs.promises.readFile(logFilePath, "utf-8"));
  if (typeof startContent !== 'string') {
    startContent = '';
  }
  startDetachedServer();
  let updateCount = 0;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    let content = await asyncTryCatchNull(fs.promises.readFile(logFilePath, "utf-8"));
    if (typeof content !== 'string') {
      content = '';
    }
    if (startContent !== content) {
      updateCount++;
    }
    if (updateCount >= 2) {
      return content.substring(startContent.length).trim();
    }
  }
  throw new Error('Detached server did not update server log file');
}

export default async function checkExtractionServer() {
  const base = {
    cwd: process.cwd(),
    pid: process.pid,
    argv: process.argv,
  };
  let status = await sendRequest("init", base);
  if (status.error && status.stage === "network") {
    console.log("Initializing extractor...");
    console.log(await startServerAndWatchLogs());
    for (let i = 0; i < 5; i++) {
      await sleep(200);
      status = await sendRequest("info", base);
      if (!status.error || status.stage !== "network") {
        break;
      }
    }
    if (!status || (status.error && status.stage === "network")) {
      console.log('Failed to start extractor server in background: Connection was not successfull');
      console.debug(status);
      throw new Error("Could not initialize detached extraction server");
    }
  }
  return status;
}
