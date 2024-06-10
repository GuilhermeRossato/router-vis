import path from "node:path";
import attachToConsole from "./src/utils/attachToConsole.js";
import { env, config, dataFileName, modes } from "./settings.js";
import confirmOrStartExtractionServer from "./src/client/confirmOrStartExtractionServer.js";
import { streamUsageVariableState } from "./src/client/streamUsageVariableState.js";
import { streamExtractionServerLogs } from "./src/client/streamExtractionServerLogs.js";
import executeExtraction from "./src/executeExtraction.js";
import executeServer from "./src/server/executeServer.js";
import sendInternalShutdown from "./src/client/sendInternalShutdown.js";
import executeDetachedCommand from "./src/utils/executeDetachedCommand.js";
import sendInternalRequest from "./src/client/sendInternalRequest.js";
import sleep from "./src/utils/sleep.js";

//#region Initialize logging

config.debug =
  config.debug ||
  process.argv.includes("--debug") ||
  process.argv.includes("-d") ||
  process.argv.includes("-v") ||
  process.argv.includes("--verbose");
modes.server = modes.server || process.argv.includes("--server");
const logFileName = modes.server ? dataFileName.serverLog : dataFileName.clientLog;

if (config.debug) {
  attachToConsole("debug", logFileName, "[D]");
} else {
  console.debug = () => {};
}

attachToConsole("log", logFileName);

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
  if (checkMatch(arg, ["--standalone", "--alone", "--direct", "--no-server", "--serverless"])) {
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
    modes.logs = true;
    console.debug("Argument", i, "activated", "modes.logs");
    return;
  }
  if (checkMatch(arg, ["--status", "--state", "--info", "-s", "--self"])) {
    modes.status = true;
    console.debug("Argument", i, "activated", "modes.status");
    return;
  }
  if (checkMatch(arg, ["--server"])) {
    modes.server = true;
    console.debug("Argument", i, "activated", "modes.server");
    return;
  }
  if (checkMatch(arg, ["--help", "-h", "/?"])) {
    modes.help = true;
    console.debug("Argument", i, "activated", "modes.help");
    return;
  }
  if (checkMatch(arg, ["--api", "--url", "--data", "--open", "--page"])) {
    modes.api = true;
    console.debug("Argument", i, "activated", "modes.api");
    return;
  }
  if (checkMatch(arg, ["--shutdown", "--stop", "--disable", "--off"])) {
    modes.shutdown = true;
    console.debug("Argument", i, "activated", "modes.shutdown");
    return;
  }
  if (checkMatch(arg, ["--restart", "--start", "--enable", "--reset", "--on", "--init"])) {
    modes.restart = true;
    console.debug("Argument", i, "activated", "modes.restart");
    return;
  }
  if (checkMatch(arg.replace("pbs", "bps"), ["--speed", "--mbps", "--kbps"])) {
    const value = arg.toLowerCase().replace(/\-/g, "").replace("pbs", "bps");
    modes.speed = value === "speed" ? config.speed || "kbps" : value;
    console.debug("Argument", i, "activated", "modes.speed:", modes.speed);
    return;
  }
  if (checkMatch(arg, ["--usage", "--use", "--kb", "-mb", "-kb", "-mb"])) {
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

async function init() {
  const dataServerUrl = `http://${env.INTERNAL_DATA_SERVER_HOST}:${env.INTERNAL_DATA_SERVER_PORT}/`;
  const activatedModes = Object.keys(modes).filter((k) => modes[k]);
  console.debug(`Script mode${activatedModes.length === 1 ? "" : "s"}:`, activatedModes);
  if (modes.help) {
    console.log("Router Vis Data Extractor\n");
    console.log("This script extracts and persist data for the router-vis project.");
    console.log("For information visit the project's repository:");
    console.log("https://github.com/GuilhermeRossato/node-vis-extractor\n");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.exit(1);
  }
  if (!modes.server && !modes.shutdown && modes.restart && config.standalone) {
    console.log(
      'Warning: Ignored "restart" command because program is configured to run in "standalone" mode',
    );
  }
  if (modes.api) {
    console.log("Router Vis Data Extractor Server");
    console.log("");
    console.log("Endpoint:", "\t", dataServerUrl);
    console.log("");
  }
  if (modes.server || modes.shutdown || (modes.restart && !config.standalone)) {
    console.log(
      "Stopping the background server",
      modes.server ? "(to replace)" : modes.shutdown ? "(to shutdown)" : "(to restart)",
    );
    const result = await sendInternalShutdown();
    console.debug("Shutdown result:", result);
  }
  if (modes.server) {
    return await executeServer();
  }
  let status;
  if (
    !modes.server &&
    !config.standalone &&
    (modes.restart || modes.api || modes.logs || modes.speed || modes.usage)
  ) {
    status = await confirmOrStartExtractionServer();
  }
  if (modes.api) {
    if (!status || status.error) {
      await sleep(1000);
      status = await sendInternalRequest("status");
    }
    if (!status || status.error) {
      console.log('Cannot open api with "start" command at', JSON.stringify(dataServerUrl));
      console.log("Api Status Error:", status ? status : "(null)");
    } else {
      console.log("Api Server Status:", status);
      await sleep(500);
      console.log('Executing "start" command to open api at', JSON.stringify(dataServerUrl));
      await sleep(1000);
      executeDetachedCommand(`start ${dataServerUrl}`);
    }
    await sleep(1000);
  }

  const acts = [];

  if (modes.speed) {
    acts.push(executeUsageStream.bind(null, "speed", modes.speed || "mbps"));
  }

  if (modes.usage) {
    acts.push(executeUsageStream.bind(null, "usage", modes.usage || "mb"));
  }

  if (modes.status) {
    acts.push(executeStatus.bind(null, status));
  }

  if (modes.logs) {
    if (config.standalone || (modes.shutdown && !modes.restart)) {
      console.log('Warning: Executing "logs" mode without a background process executing');
      console.log(
        config.standalone
          ? 'Program is configured to run in "standalone" mode'
          : "Background server was stopped by shutdown argument",
      );
    }
    acts.push(executeStreamExtractionServerLogs.bind(null, true));
  }

  if (
    acts.length === 0 &&
    !modes.shutdown &&
    !modes.restart &&
    !modes.help &&
    !modes.logs &&
    !modes.api
  ) {
    console.debug("Starting default", config.standalone ? "standalone" : "script", "mode");
    if (config.standalone) {
      console.log("Starting extraction...");
      acts.push(executeExtraction.bind(null, true));
    } else {
      acts.push(executeUsageStream.bind(null, "speed", modes.speed || "mbps"));
    }
  }

  if (acts.length === 0) {
    console.debug("No actions to execute: Program will exit");
    return;
  }

  if (acts.length !== 1) {
    console.debug("Executing", acts.length, "actions");
  }

  await Promise.all(acts.map((f) => f()));
}

async function executeStatus(status) {
  if (status) {
    if (status && typeof status == "object" && !status.error) {
      console.log("Status (success)");
    } else {
      console.log("Status (failed)");
    }
    console.log(status);
  }
  const newStatus = await sendInternalRequest("status");
  if (!status || JSON.stringify(newStatus) !== JSON.stringify(status)) {
    console.log("Status response");
    console.log(newStatus);
    if (newStatus?.error && newStatus?.stage === "network") {
      console.log("(Server process is likely not running)");
    }
  }
}
async function executeUsageStream(streamType, unitArg = "M") {
  console.log("Streaming", streamType, "data. Press Ctrl+C to stop.");

  const letter = unitArg.toUpperCase()[0];

  const unit = letter === "A" ? (streamType === "usage" ? "M" : "K") : letter;

  streamUsageVariableState(streamType, unit).catch((err) => {
    console.log("Streaming", streamType, "caused an error:");
    console.log(err);
    process.exit(1);
  });
}

async function executeStreamExtractionServerLogs(continuous = false) {
  const streamType = "extraction server logs";
  console.log(
    continuous ? "Streaming" : "Printing",
    streamType,
    continuous ? ". Press Ctrl+C to stop." : ". (Last lines)",
  );

  streamExtractionServerLogs(continuous).catch((err) => {
    console.log("Streaming", streamType, "caused an error:");
    console.log(err);
    process.exit(1);
  });
}

init().catch((err) => {
  console.log("Failed");
  console.log(err);
  process.exit(1);
});
