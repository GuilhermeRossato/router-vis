import attachToConsole from "./src/utils/attachToConsole.js";
import config from "./config.js";
import checkExtractionServer from "./src/client/checkExtractionServer.js";
import sendRequest from "./src/client/sendRequest.js";
import sleep from "./src/utils/sleep.js";
import executeExtraction from "./src/executeExtraction.js";
import { streamUsageVariableState } from "./src/client/streamUsageVariableState.js";
import { streamExtractionServerLogs } from "./src/client/streamExtractionServerLogs.js";
import { executeConfigMode } from "./src/client/executeConfigMode.js";

const unhandledArguments = process.argv.slice(2).filter((text, i) => {
  if (["--debug", "-d"].includes(text)) {
    config.debug = true;
    return;
  }
  if (
    ["--config", "--settings", "--cfg", "--setup", "--init", "-c"].includes(
      text
    )
  ) {
    config.config = true;
    return;
  }
  if (["--shutdown", "--stop", "--disable"].includes(text)) {
    config.shutdown = true;
    return;
  }
  if (["--restart", "--reset"].includes(text)) {
    config.restart = true;
    return;
  }
  if (
    [
      "--standalone",
      "--alone",
      "--no-server",
      "--serverless",
      "--direct",
    ].includes(text)
  ) {
    config.standalone = true;
    return;
  }
  if (["--logs", "--log", "-l", "--internal"].includes(text)) {
    config.logs = true;
    return;
  }
  if (["--speed", "--kbps", "--mbps"].includes(text)) {
    config.speed = text;
    return;
  }
  if (["--usage", "--use", "--kb", "--mb"].includes(text)) {
    config.usage = text;
    return;
  }
  return true;
});

if (unhandledArguments.length) {
  throw new Error(
    `Unrecognized arguments: ${JSON.stringify(unhandledArguments)}`
  );
}

const logFilePath = `${config.projectPath}\\client.log`;
attachToConsole("log", logFilePath, config.debug);

if (config.debug) {
  attachToConsole("debug", logFilePath, config.debug);
} else {
  console.debug = () => {};
}

async function execShutdown() {
  console.log("Requesting extraction server to shutdown");
  const response = await sendRequest("exit");
  if (response.error && response.stage === "network") {
    console.log(
      `Shutdown request failed: No server listening at http://${
        config.extractionServerHost || "127.0.0.1"
      }:${config.extractionServerPort}/`
    );
  }
  if (response.error) {
    console.log(
      "Shutdown request failed: " + (response.message || "Unknown error")
    );
  }
  console.debug("Extraction server shutdown:", response);
  await sleep(100);
  let state = await sendRequest("status");
  if (!state.error || state.stage !== "network") {
    await sleep(300);
    state = await sendRequest("status");
  }
  if (!state.error || state.stage !== "network") {
    console.log(
      "Shutdown request failed: Extraction server responded a status request after shutdown request"
    );
  }
}

async function init() {
  if (config.shutdown || config.restart) {
    await execShutdown();
  }
  if (config.restart || !config.standalone) {
    if (!config.shutdown) {
      console.debug("Asserting the execution of the extraction server");
      const status = await checkExtractionServer();
      console.debug("First extraction status response:", status);
    }
  }

  const acts = [];
  if (config.standalone) {
    acts.push(executeExtraction);
  }
  if (config.speed) {
    acts.push(
      executeUsageStream.bind(null, "speed", config.speed === "--mbps")
    );
  }
  if (config.usage) {
    acts.push(executeUsageStream.bind(null, "usage", config.usage === "--mb"));
  }
  if (config.logs) {
    acts.push(executeStreamExtractionServerLogs);
  }
  if (acts.length === 0) {
    acts.push(executeUsageStream.bind(null, "speed", false));
  }
  if (acts.length !== 1) {
    console.debug("Executing", acts.length, "client actions");
  }
  await Promise.all(acts.map((f) => f()));
}

async function executeUsageStream(streamType, displayMegaBytes) {
  console.log("Streaming", streamType, "data. Press Ctrl+C to stop.");

  streamUsageVariableState(streamType, displayMegaBytes).catch((err) => {
    console.log("Streaming", streamType, "caused an error:");
    console.log(err);
    process.exit(1);
  });
}

async function executeStreamExtractionServerLogs() {
  const streamType = "extraction server logs";
  console.log("Streaming", streamType, ". Press Ctrl+C to stop.");

  streamExtractionServerLogs().catch((err) => {
    console.log("Streaming", streamType, "caused an error:");
    console.log(err);
    process.exit(1);
  });
}

if (config.config) {
  executeConfigMode(init);
} else {
  init().catch((err) => {
    console.log("Failed");
    console.log(err);
    process.exit(1);
  });
}
