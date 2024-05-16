import sleep from "../utils/sleep.js";
import sendRequest from "./sendRequest.js";
import startDetachedServer from "./startDetachedServer.js";

export default async function checkExtractionServer() {
  const base = {
    cwd: process.cwd(),
    pid: process.pid,
    argv: process.argv,
  };
  let status = await sendRequest('init', base);
  if (status.error && status.stage === "network") {
    console.log("Initializing extraction server");
    startDetachedServer();
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      status = await sendRequest('info', base);
      if (!status.error || status.stage !== "network") {
        break;
      }
    }
    if (!status || (status.error && status.stage === "network")) {
      throw new Error("Could not initialize detached extraction server");
    }
  }
  return status;
}
