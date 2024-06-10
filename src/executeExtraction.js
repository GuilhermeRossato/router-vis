import { readRootTextFile, saveRootTextFile } from "./storage/rootTextFileStorage.js";
import { endpointRecord } from "./extract/endpointRecord.js";
import getValidSession from "./extract/getValidSession.js";
import generateStateRecordFromVarList from "./extract/generateStateRecordFromVarList.js";
import sleep from "./utils/sleep.js";
import { loadLatestDataState } from "./storage/loadLatestDataState.js";
import { saveLatestDataState } from "./storage/saveLatestDataState.js";
import sendRouterRequest from "./extract/sendRouterRequest.js";
import getVarListFromResponse from "./extract/getVarListFromResponse.js";
import { persistVarUpdateEntries } from "./storage/persistVarUpdateEntry.js";
import getUpdatesFromRecordPair, {
  applyUpdateListToRecord,
} from "./storage/getUpdatesFromRecordPair.js";
import getDateTimeString from "./utils/getDateTimeString.js";
import { config, dataFileName } from "../settings.js";

const debug = false;

export default async function executeExtraction(continuously = true) {
  let sessionId = config.session ? config.session : await readRootTextFile(dataFileName.sessionId);
  {
    const res = await getValidSession(sessionId);
    if (res.sessionId !== sessionId) {
      console.debug("Updated session id before extraction from", sessionId, "to", res.sessionId);
      sessionId = res.sessionId;
      await saveRootTextFile("session-id.txt", sessionId);
    }
  }
  const extractionSources = [
    {
      record: null,
      source: "status",
    },
    {
      record: null,
      source: "statistics",
    },
  ];
  for (let cycle = 0; true; cycle++) {
    for (let i = 0; i < extractionSources.length; i++) {
      const src = extractionSources[i];
      if (cycle > 0 && src.record && src.record.time) {
        const nextTime = src.record.time + 30_000;
        const msRemaining = nextTime - new Date().getTime();
        const timeRemaining = msRemaining / 1000;
        if (timeRemaining > 0 && timeRemaining <= 300_000) {
          if (cycle <= (debug ? 3 : 1)) {
            console.log(
              "Waiting for cooldown of",
              parseFloat(timeRemaining.toFixed(1)),
              "s to start extraction of",
              src.source,
            );
          }
          await sleep(timeRemaining * 1000);
        }
      }
      console.log("Extraction source", JSON.stringify(src.source), `starting...`);
      const res = await sendRouterRequest(endpointRecord[src.source], sessionId);
      if (res.sessionId && res.sessionId !== sessionId) {
        console.debug(
          "Session id was updated from",
          sessionId ? sessionId : "(empty)",
          "to",
          res.sessionId,
        );
        sessionId = res.sessionId;
        await saveRootTextFile("session-id.txt", sessionId);
      }
      const list = getVarListFromResponse(res);
      const newRec = generateStateRecordFromVarList(list, res.time);
      debug &&
        console.log(
          "Stage has",
          Object.keys(newRec).length,
          "keys from",
          list.length,
          "var list entries",
        );
      console.log(
        "Extraction",
        JSON.stringify(src.source),
        `finished after`,
        parseFloat(res.duration.toFixed(1)),
        `s with ${Object.keys(newRec).length} keys`,
      );
      let recordLength = src.record ? Object.keys(src.record).length : 0;
      let recordSource = recordLength ? "memory" : "";
      if (!recordLength) {
        console.debug("Attempting to load latest", JSON.stringify(src.source), "from cache...");
        src.record = await loadLatestDataState(src.source);
        recordLength = src.record ? Object.keys(src.record).length : 0;
        recordSource = recordLength ? "cached" : "";
        debug && console.log("Cached record result has", recordLength, "keys");
      }
      if (!recordLength) {
        console.debug("Creating empty record for stage", src.source);
        src.record = {};
        recordLength = src.record ? Object.keys(src.record).length : 0;
        recordSource = recordLength ? "created" : "";
      }
      try {
        const updates = await getUpdatesFromRecordPair(src.record, newRec, src.source);
        if (cycle <= 1) {
          console.log(`Previous state (from ${recordSource}) has`, updates.length, "differences");
        }
        if (updates.length) {
          console.debug("Start record size:", Object.keys(src.record).length);
          applyUpdateListToRecord(updates, src.record);
          console.debug("Final record size:", Object.keys(src.record).length);
        }
        // Assert date/time after applying updates
        src.record.time = res.date.getTime();
        src.record.date = getDateTimeString(src.record.time);
        await saveLatestDataState(src.source, src.record);
        if (updates.length) {
          await persistVarUpdateEntries(updates);
        }
        console.log(
          "Extraction",
          "finished with",
          updates.length,
          "updates",
          updates.length && updates.length <= 2
            ? `(at ${updates.map((u) => JSON.stringify(u.varName)).join(", ")})`
            : "",
        );
      } catch (err) {
        console.log("Failed to update data state:");
        console.log(err);
      }
    }
    if (!continuously) {
      debug && console.log("Exiting extraction loop because of loop is disabled");
      break;
    }
  }
  console.log("Extraction process finished");
  return { status: extractionSources[0].record, statistics: extractionSources[1].record };
}
