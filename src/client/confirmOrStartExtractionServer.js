import sleep from "../utils/sleep.js";
import sendInternalRequest from "./sendInternalRequest.js";
import startDetachedServer from "./startDetachedServer.js";

export default async function confirmOrStartExtractionServer() {
  const data = {
    cwd: process.cwd(),
    pid: process.pid,
    argv: process.argv,
  };
  let status = await sendInternalRequest('status', data);
  if (!status.error) {
    return status;
  }
  if (status.stage === "network") {
    console.log("Initializing extraction server");
    await startDetachedServer();
    for (let i = 0; i < 5; i++) {
      await sleep(200);
      status = await sendInternalRequest('status', data);
      (i === 0) && console.debug('Checking server status:', status)
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
