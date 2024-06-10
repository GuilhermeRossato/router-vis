import { config } from "../../settings.js";
import sendInternalRequest from "./sendInternalRequest.js";
import sleep from "../utils/sleep.js";

export default async function sendInternalShutdown() {
  console.debug("Requesting extraction server to shutdown");
  const response = await sendInternalRequest("shutdown");
  console.debug("Shutdown response:", response);
  if (response.error && response.stage === "network") {
    console.log(
      `No connection from extractor server at "${response.hostname}"`
    );
    return "already-off";
  }
  console.debug("Extraction server shutdown response:", response);
  if (response.error) {
    const message = response.message || response.stack || response.error;
    console.log('Shutdown failed:');
    console.log(typeof message === "string" && message ? message : JSON.stringify(response));
    return "error";
  }
  const timeoutMs = 10000;
  console.debug(
    "Waiting for server to stop replying successfully",
    ...(timeoutMs
      ? ["with timeout after", parseFloat((timeoutMs / 1000).toFixed(1)), "seconds"]
      : [])
  );
  const startTime = new Date().getTime();
  for (let i = 0; i < 1000; i++) {
    await sleep(i === 0 ? 10 : 100);
    const elapsed = startTime - new Date().getTime();

    const state = await sendInternalRequest("status");
    if (!state || (state?.error && state.stage === 'network')) {
      console.debug(
        "Server successsfuly not respond after",
        parseFloat((elapsed / 1000).toFixed(1)),
        "seconds"
      );
      console.log('Background server successfully terminated');
      return "terminated";
    }
    if (timeoutMs && elapsed > timeoutMs) {
      console.debug("\nTimeout waiting for server to stop responding");
      break;
    }
    config.debug && process.stdout.write(".");
  }
  return "not-terminated";
}
