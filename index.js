import path from "node:path";
import attachToConsole from "./src/utils/attachToConsole.js";
import { config, dataFileName, modes } from "./settings.js";
import checkExtractionServer from "./src/client/checkExtractionServer.js";
import {sendRequest} from "./src/client/sendRequest.js";
import { streamUsageVariableState } from "./src/client/streamUsageVariableState.js";
import { streamExtractionServerLogs } from "./src/client/streamExtractionServerLogs.js";
import { executeConfigMode } from "./src/client/executeConfigMode.js";
import sleep from "./src/utils/sleep.js";
import executeExtraction from "./src/executeExtraction.js";

//#region Initialize logging

config.debug = config.debug || process.argv.includes("--debug") || process.argv.includes("-d");

if (config.debug) {
  attachToConsole("debug", dataFileName.clientLog, "[D]");
} else {
  console.debug = () => {};
}

attachToConsole("log", dataFileName.clientLog);

console.debug(
  `Starting "${path.basename(process.argv[1])}" with`,
  process.argv.slice(2),
  `at "${process.cwd()}"`,
);

//#endregion
//#region Parse arguments

const unrecognized = process.argv.slice(2).filter((arg, i, args) => {
  const checkMatch = (arg, options) =>
    options
      .map((o) => o.replace(/\-/g, "").toLowerCase().replace(/\W/g, ""))
      .includes(arg.replace(/\-/g, "").toLowerCase().replace(/\W/g, ""));

  if (checkMatch(arg, ["--debug", "-d", "-v", "--verbose"])) {
    console.debug("Argument", i, "enabled", "config.debug");
    config.debug = true;
    return;
  }
  if (checkMatch(arg, ["--standalone", "--alone", "--no-server", "--serverless"])) {
    config.standalone = true;
    console.debug("Argument", i, "enabled", "config.standalone");
    return;
  }
  if (
    checkMatch(
      arg
        .split("=")[0]
        .replace("-set", "-")
        .replace("-username", "-user")
        .replace("-password", "-pass"),
      [
        "--user",
        "--pass",
        "--session",
        "--session-id",
        "--sid",
        "--id",
        "--cookie",
        "--set-cookie",
        "--auth",
      ],
    )
  ) {
    const simplified = arg.split("=")[0].toLowerCase().replace(/\-/g, "");
    const key = simplified.includes("user")
      ? "user"
      : simplified.includes("pass")
      ? "pass"
      : "session";
    const imediate = arg.split("=")[1];
    if (imediate) {
      config[key] = imediate;
      console.debug("Argument", i, "will define", `config.${key}`);
    } else {
      config[key] = i.toString();
      console.debug("Argument", i, "has defined", `config.${key}`, imediate);
    }
    return;
  }
  if (
    args[0] !== "-" &&
    [config.session, config.user, config.pass].includes((i - 1).toString()) &&
    !(args[i - 1] || "").split("=")[1]
  ) {
    let key = args[i - 1].toLowerCase();
    if (key.includes("user")) {
      key = "user";
    } else if (key.includes("pass")) {
      key = "pass";
    } else {
      key = "session";
    }
    if (config[key] === (i - 1).toString()) {
      config[key] = arg;
      console.debug("Argument", i, "specified", `config.${key}:`, config[key]);
      return;
    }
  }
  if (checkMatch(arg.split("=")[0].substring(0, 4), [])) {
    config.user = arg.split("=")[1] || args[i + 1];
    console.debug("Argument", i, "specified", "config.session");
    return;
  }
  if (checkMatch(arg, ["--logs", "--log", "-l", "--internal"])) {
    config.logs = true;
    console.debug("Argument", i, "enabled", "config.logs");
    return;
  }
  if (checkMatch(arg, ["--help", "-h", "/?"])) {
    modes.shutdown = true;
    console.debug("Argument", i, "activated", "modes.shutdown");
    return;
  }
  if (checkMatch(arg, ["--shutdown", "--stop", "--disable", "--off"])) {
    modes.shutdown = true;
    console.debug("Argument", i, "activated", "modes.shutdown");
    return;
  }
  if (checkMatch(arg, ["--restart", "--start", "--enable", "--reset", "--on"])) {
    modes.restart = true;
    console.debug("Argument", i, "activated", "modes.restart");
    return;
  }
  if (checkMatch(arg.replace("pbs", "bps"), ["--speed", "--mbps", "--kbps", "--bps"])) {
    const value = arg.toLowerCase().replace(/\-/g, "").replace("pbs", "bps");
    modes.speed = value === "speed" ? config.speed || "kbps" : value;
    console.debug("Argument", i, "activated", "modes.speed:", modes.speed);
    return;
  }
  if (checkMatch(arg, ["--usage", "--use", "--kb", "-mb", "-b", "-kb", "-mb", "-b"])) {
    const value = arg.toLowerCase().replace(/\-/g, "").replace("pbs", "bps");
    modes.usage = value === "usage" ? config.usage || "mb" : value;
    console.debug("Argument", i, "activated", "modes.usage:", modes.usage);
    return;
  }
  console.debug("Argument", i, "unhandled:", JSON.stringify(arg));
  return true;
});

if (unrecognized.length) {
  console.debug("Script received", unrecognized.length, "unhandled arguments");

  throw new Error(
    `Unrecognized argument${unrecognized.length === 1 ? "" : "s"}: ${JSON.stringify(
      unrecognized.length === 1 ? unrecognized[0] : unrecognized,
    )}`,
  );
}

//#endregion

async function execShutdown() {
  console.debug("Requesting extraction server to shutdown");
  const response = await sendRequest("terminate");
  if (response.error) {
    console.log("Shutdown request failed at stage", JSON.stringify(response.stage));
    if (response.stage === "network") {
      console.log("Shutdown request failed");
      console.log(`No server connection at http://${
          config.extractionServerHost || "127.0.0.1"
        }:${config.extractionServerPort}/`,
      );
      return false;
    }
    const message = response.message || response.stack || response.error;
    console.log(typeof message === 'string' && message ? message : JSON.stringify(response));
    return false;
  }

  console.debug("Extraction server shutdown response:", response);

  const timeoutMs = 10_000;

  console.debug("Waiting for server to stop replying", ...(timeoutMs ? ['with timeout after', parseFloat((timeoutMs/1000).toFixed(1)), 'seconds'] : []));
  
  const startTime = new Date().getTime();
  for (let i = 0; i < 1000; i++) {
    await sleep(i === 0 ? 10 : 100);
    const state = await sendRequest("status");
    const elapsed = startTime - new Date().getTime();
    if (!state || state.error === 'network') {
      console.debug('\nServer successsfuly not respond after', parseFloat((elapsed/1000).toFixed(1)), 'seconds');
      return true;;
    }
    if (timeoutMs && elapsed > timeoutMs) {
      console.debug('\nTimeout waiting for server to stop responding');
      break;
    }
    config.debug && process.stdout.write('.');
  }
  return false;
}

async function init() {
  const activatedModes = Object.keys(modes).filter((k) => modes[k]);
  console.debug(`Script mode${activatedModes.length === 1 ? "" : "s"}:`, activatedModes);

  if (modes.help) {
    console.log("Router Vis Script\n");
    console.log("For information access the project's github repository:\n");
    console.log("https://github.com/GuilhermeRossato/node-vis-extractor\n");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (modes.shutdown || modes.restart) {
    console.log(
      "Stopping the background server",
      modes.shutdown ? "(to shutdown)" : "(to restart)",
    );
    await execShutdown();
  }

  if (!config.standalone) {
    const status = await checkExtractionServer();
    console.debug("First status:", status);
  } else if (modes.restart) {
    console.log(
      'Warning: Ignored "restart" command because program is configured to run in "standalone" mode',
    );
  }

  const acts = [];

  if (modes.speed) {
    acts.push(executeUsageStream.bind(null, "speed", modes.speed || "mbps"));
  }

  if (modes.usage) {
    acts.push(executeUsageStream.bind(null, "usage", modes.usage || "mb"));
  }

  if (modes.logs) {
    if (config.standalone || modes.shutdown) {
      console.log('Warning: Executing "logs" mode without a background process executing');
      console.log(config.standalone ? 'program is configured to run in "standalone" mode' : 'background server was stopped by argument',
    );
    acts.push(executeStreamExtractionServerLogs.bind(null));
  }

  if (acts.length === 0 && !config.shutdown && !config.restart && !config.help) {
    console.debug('Starting default', config.standalone ? 'standalone' : 'script', 'mode');
    if (config.standalone) {
      acts.push(executeExtraction.bind(null, true));
    } else {
      acts.push(executeUsageStream.bind(null, "speed", false));
    }
  }

  if (acts.length !== 1) {
    console.debug("Executing", acts.length, "actions");
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
