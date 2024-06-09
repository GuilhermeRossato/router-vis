import { readRootTextFile, saveRootTextFile } from "./storage/rootTextFileStorage.js";
import { endpointRecord } from "./extract/endpoints.js";
import login from "./extract/login.js";
import generateStateRecordFromVarList from "./parse/generateStateRecordFromVarList.js";
import sleep from "./utils/sleep.js";
import { loadLatestDataState, saveLatestDataState } from "./storage/latestDataState.js";
import routerRequest from "./extract/routerRequest.js";
import isolateVarList from "./extract/isolateVarList.js";
import { appendVarDataUpdate } from "./storage/varFileStorage.js";
import getUpdatesFromRecordPair, {
  applyUpdateListToRecord,
} from "./storage/getUpdatesFromRecordPair.js";
import getDateTimeString from "./utils/getDateTimeString.js";
import { config, dataFileName } from "../settings.js";

const debug = true;

export default async function executeExtraction(isLoopMode = true) {
  let sessionId = config.session ? config.session : await readRootTextFile(dataFileName.sessionId);
  const result = await login(sessionId);
  if (result.sessionId !== sessionId) {
    console.debug("Updated session id:", result.sessionId);
    sessionId = result.sessionId;
    await saveRootTextFile("session-id.txt", sessionId);
  }
  const extractionStages = [
    {
      record: null,
      stageName: "status",
    },
    {
      record: null,
      stageName: "statistics",
    },
  ];
  for (let cycle = 0; true; cycle++) {
    for (let i = 0; i < extractionStages.length; i++) {
      const stage = extractionStages[i];
      if (cycle > 0 && stage.record.time) {
        const nextTime = stage.record.time + 30_000;
        const msRemaining = nextTime - new Date().getTime();
        const timeRemaining = msRemaining / 1000;
        if (timeRemaining > 0 && timeRemaining <= 300_000) {
          if (cycle <= (debug ? 3 : 1)) {
            console.log(
              "Waiting for cooldown of",
              parseFloat(timeRemaining.toFixed(1)),
              "s to start extraction of",
              stage.stageName,
            );
          }
          await sleep(timeRemaining * 1000);
        }
      }
      if (!stage.record) {
        console.debug("Attempting to load", stage.stageName, "from cache...");
        stage.record = await loadLatestDataState(stage.stageName);
        console.debug(stage.record ? "Loaded" : "Could not load", stage.stageName, "from cache");
      }
      if (!stage.record) {
        console.debug("Creating empty", stage.stageName);
        stage.record = {};
      }
      console.log("Extraction", stage.stageName, "starting");
      const routerResponse = await routerRequest(endpointRecord[stage.stageName], sessionId);
      if (routerResponse.sessionId && routerResponse.sessionId !== sessionId) {
        console.debug(
          "Session id was updated from",
          sessionId ? sessionId : "(empty)",
          "to",
          routerResponse.sessionId,
        );
        sessionId = routerResponse.sessionId;
        await saveRootTextFile("session-id.txt", sessionId);
      }
      const list = isolateVarList(routerResponse);
      const rec = generateStateRecordFromVarList(list);
      cycle <= 1 &&
        console.log(
          "Extraction",
          stage.stageName,
          "has",
          Object.keys(rec).length,
          "keys from",
          list.length,
          "var list entries",
        );
      try {
        const updates = await getUpdatesFromRecordPair(stage.record, rec);
        if (cycle <= 1) {
          console.log("Data from", stage.stageName, "received", updates.length, "updates");
        }
        if (updates.length) {
          console.debug("Start record size:", Object.keys(stage.record).length);
          applyUpdateListToRecord(updates, stage.record);
          console.debug("Final record size:", Object.keys(stage.record).length);
          continue;
        }
        stage.record.time = routerResponse.date.getTime();
        stage.record.date = getDateTimeString(stage.record.time);
        await saveLatestDataState(stage.stageName, stage.record);
        await appendVarDataUpdate(updates);
      } catch (err) {
        console.log("Failed to update data state:");
        console.log(err);
      }
    }
    if (!isLoopMode) {
      debug && console.log("Exiting extraction loop because of loop is disabled");
      break;
    }
  }
  console.log("Extraction process finished");
}
