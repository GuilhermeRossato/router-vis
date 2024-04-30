import sleep from "../utils/sleep.js";
import sendRequest from "./sendRequest.js";
import startDetachedServer from "./startDetachedServer.js";

export default async function checkExtractionServer() {
  const obj = {
    type: 'init',
    cwd: process.cwd(),
    pid: process.pid,
    argv: process.argv
  };
  const send = sendRequest.bind(null, obj);

  let status = await send();
  obj.type = 'status';
  if (status.error && status.stage === "network") {
    console.log("Initializing detached extraction server");
    startDetachedServer();
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      status = await send();
      if (!status.error || status.stage !== "network") {
        break;
      }
    }
    if (!status || (status.error && status.stage === 'network')) {
      throw new Error('Could not initialize detached extraction server');
    }
  }
  return status;
}

