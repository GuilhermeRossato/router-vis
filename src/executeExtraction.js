import config from "../config.js";
import {
  loadRootTextFile,
  saveRootTextFile,
} from "./data/rootTextFileStorage.js";
import { endpointRecord } from "./extract/endpoints.js";
import login from "./extract/login.js";
import generateStateRecordFromVarList from "./parse/generateStateRecordFromVarList.js";
import sleep from "./utils/sleep.js";
import { getNormalizedVarName } from "./getNormalizedVarName.js";
import separateUpdatedValueKeys from "./data/separateUpdatedValueKeys.js";
import separateUpdatedObjectKeys from "./data/separateUpdatedObjectKeys.js";
import { saveUpdateEntryList } from "./data/saveUpdateEntryList.js";
import {
  loadLatestDataState,
  saveLatestDataState,
} from "./data/latestDataState.js";
import { applyUpdateListToRecord } from "./data/getUpdatesFromRecordPair.js";
import routerRequest from "./extract/routerRequest.js";
import isolateVarList from "./extract/isolateVarList.js";
import {
  appendVarDataFile,
  appendVarDataFileAt,
} from "./data/varFileStorage.js";
import { getActionsFromTypedRecords } from "./getActionsFromTypedRecords.js";

const filterObjectKeys = (rec, k) => typeof rec[k] === "object";
const filterValueKeys = (rec, k) => typeof rec[k] !== "object";

const debug = true;

let latestStatusRecord = null;
export function getLatestStatusRecord() {
  return latestStatusRecord;
}

let latestStatisticsRecord = null;
export function getLatestStatisticsRecord() {
  return latestStatisticsRecord;
}

export function getJoinedStateRecord() {
  const list = [latestStatusRecord, latestStatisticsRecord].filter((a) => a);
  const state = {};
  for (const rec of list) {
    for (const key in rec) {
      if (typeof state[key] === "object" && state[key]) {
        state[key] = { ...state[key], ...rec[key] };
      } else {
        state[key] = rec[key];
      }
    }
  }
  return state;
}

let waitingResolveList = [];
export function waitForJoinedStateUpdate(name) {
  /** @type {Promise<{varName: string, value: any, time: number; oldValue?: any, oldTime?: number}[]>} */
  const promise = new Promise((resolve, reject) => {
    if (waitingResolveList.length > 30) {
      return reject(
        new Error("Too many clients are waiting for the state update")
      );
    }
    waitingResolveList.push([
      resolve,
      reject,
      name ? getNormalizedVarName(name) : undefined,
    ]);
  });
  return promise;
}

function notifyUpdateCallback(list) {
  if (waitingResolveList.length === 0) {
    return false;
  }
  const newList = [];
  try {
    for (const [resolver, rejecter, name] of waitingResolveList) {
      if (name) {
        const evt = list.find((event) => event.name === name);
        if (evt) {
          try {
            resolver(list);
          } catch (err) {
            console.log(err);
            rejecter(err);
          }
        } else {
          newList.push([resolver, rejecter, name]);
        }
      } else {
        try {
          resolver(list);
        } catch (err) {
          console.log(err);
          rejecter(err);
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
  waitingResolveList = newList;
  return true;
}

export default async function executeExtraction(isLoopMode = true) {
  let sessionId = await loadRootTextFile("session-id.txt");

  const result = await login(sessionId);
  if (result.sessionId !== sessionId) {
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

  const recordTypes = [
    {
      recordType: "objects",
      filterFunc: filterObjectKeys,
      separateFunc: separateUpdatedObjectKeys,
    },
    {
      recordType: "values",
      filterFunc: filterValueKeys,
      separateFunc: separateUpdatedValueKeys,
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
          if (cycle <= (debug ? 3 : 1))
            console.log("Waiting for cooldown of", parseFloat(timeRemaining.toFixed(1)), 's to start extraction of', stage.stageName);
          await sleep(timeRemaining * 1000);
        }
      }
      if (!stage.record) {
        debug &&
          console.log("[D] Loading latest", stage.stageName, "from cache...");
        stage.record = await loadLatestDataState(stage.stageName);
        debug &&
          console.log(
            "[D] ",
            stage.record ? "Loaded" : "Could not get",
            stage.stageName,
            "from cache"
          );
      }
      if (!stage.record) {
        debug && console.log("[D] Creating", stage.stageName);
        stage.record = {};
      }
      debug && console.log("[D] Extraction", stage.stageName, "starting");
      const routerResponse = await routerRequest(
        endpointRecord[stage.stageName],
        sessionId
      );
      if (routerResponse.sessionId !== sessionId) {
        sessionId = routerResponse.sessionId;
        await saveRootTextFile("session-id.txt", sessionId);
      }
      const list = isolateVarList(routerResponse);
      const rec = generateStateRecordFromVarList(list);
      (cycle <= 1) && console.log(
        "Extraction", stage.stageName, 'got',
        Object.keys(rec).length,
        "keys from",
        list.length,
        "var list entries"
      );
      rec.time = routerResponse.date.getTime();
      const actions = [];
      for (let j = 0; j < recordTypes.length; j++) {
        const { recordType, filterFunc, separateFunc } = recordTypes[j];
        try {
          const actionList = await getActionsFromTypedRecords(
            stage.record,
            rec,
            stage.stageName,
            recordType,
            filterFunc,
            separateFunc
          );
          const updateList = actionList
            .filter((a) => a.update.type !== "maintained")
            .map((a) => a.update);
          applyUpdateListToRecord(updateList, stage.record);
          stage.record.time = routerResponse.date.getTime();
          (cycle <= 1) && console.log(
            "The",
            recordType,
            "vars of",
            stage.stageName,
            "contain",
            Object.keys(stage.record).length,
            "keys and",
            updateList.length,
            "diffs"
          );
          actions.push(...actionList);
        } catch (err) {
          console.log("Operate failed:", err);
        }
      }
      await saveLatestDataState(stage.stageName, stage.record);
      for (const {
        type,
        stageName,
        recordType,
        varName,
        filePath,
        update,
      } of actions) {
        await appendVarDataFileAt(filePath, {
          ...update,
          // extra: { type, stageName, recordType, varName },
        });
      }
    }
    if (!isLoopMode) {
      debug && console.log("Exiting extraction loop because of loop is disabled");
      break;
    }
  }
  console.log("Extraction process finished");
}
