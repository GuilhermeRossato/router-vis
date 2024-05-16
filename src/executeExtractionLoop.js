import config from "../config.js";
import {
  loadRootDataFile,
  saveRootDataFile,
} from "./cli/rootDataFileStorage.js";
import { endpointRecord } from "./extract/endpoints.js";
import getStatisticsVars from "./extract/getStatisticsVars.js";
import getStatusVars from "./extract/getStatusVars.js";
import login from "./extract/login.js";
import { getPreviousRequestData } from "./extract/routerRequest.js";
import createStatesFromComparation from "./parse/createStatesFromComparation.js";
import generateStateRecordFromVarList from "./parse/generateStateRecordFromVarList.js";
import getDateTimeString from "./utils/getDateTimeString.js";
import fs from "node:fs";
import path from "node:path";
import sleep from "./utils/sleep.js";
import { getNormalizedVarName } from "./getNormalizedVarName.js";

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
    waitingResolveList.push([resolve, reject, name ? getNormalizedVarName(name) : undefined]);
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
        const evt = list.find(event => event.name === name);
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

function getTargetFilePathForVariable(varName, dateStr) {
  const rawFolder = getNormalizedVarName(varName);
  const folder = rawFolder.endsWith("-")
    ? rawFolder.substring(0, rawFolder.length - 1)
    : rawFolder;
  if (typeof dateStr !== "string") {
    dateStr = getDateTimeString(dateStr);
  }
  const file = dateStr.substring(0, 13).replace(/\D/g, "-") + ".jsonl";
  const rawFilePath = path.resolve(config.projectPath, "data", folder, file);
  return rawFilePath.replace(/\\/g, "/");
}

async function persistVarRecord(oldRec, newRec, skipObjComparation = false) {
  const actions = await getPersistVarRecordActions(
    oldRec,
    newRec,
    skipObjComparation
  );
  if (actions.length === 0) {
    return;
  }

  const events = actions.map((a) => ({
    name: getNormalizedVarName(a.varName),
    time: newRec["time"],
    value: a.value,
    oldTime: oldRec && oldRec["time"] ? oldRec["time"] : undefined,
    oldValue: a.lastValue,
  }));

  notifyUpdateCallback(events);

  const updatedFileList = [];
  for (const act of actions) {
    if (act.first) {
      await fs.promises.mkdir(path.dirname(act.filePath), { recursive: true });
    }
    await fs.promises.appendFile(act.filePath, act.text, "utf-8");
    updatedFileList.push(act.filePath);
  }
  return updatedFileList;
}
async function getPersistVarRecordActions(
  oldRec,
  newRec,
  skipObjComparation = false
) {
  if (!newRec || !newRec["time"] || typeof newRec["time"] !== "number") {
    throw new Error("Var record without time cannot be persisted");
  }
  const newTime = newRec["time"];
  const oldTime = oldRec && oldRec["time"] ? oldRec["time"] : undefined;

  const newDateStr = getDateTimeString(newTime).substring(0, 19);
  const oldDataStr = oldTime
    ? getDateTimeString(oldTime).substring(0, 19)
    : undefined;

  /**
   * @type {{[filePath: string]: {varName: string, initialized: boolean, dirty: boolean, stateRecord: any}}}
   */
  const fileStateRecord = {};
  for (const varName in newRec) {
    if (
      [
        "date",
        "time",
        "extractionInterval",
        "extractionPeriod",
        "extractionInterval1",
        "extractionPeriod1",
        "extractionInterval2",
        "extractionPeriod2",
        "uptimeInterval",
        "uptime",
      ].includes(varName)
    ) {
      continue;
    }
    const filePath = getTargetFilePathForVariable(varName, newDateStr);
    if (!fileStateRecord[filePath]) {
      fileStateRecord[filePath] = {
        varName,
        initialized: false,
        dirty: true,
        stateRecord: {},
      };
    }
    fileStateRecord[filePath].dirty = true;
    const rec = fileStateRecord[filePath].stateRecord;
    if (
      oldRec &&
      oldDataStr &&
      oldRec[varName] &&
      !rec[oldDataStr] &&
      filePath === getTargetFilePathForVariable(varName, oldDataStr)
    ) {
      rec[oldDataStr] = oldRec[varName];
    }
    rec[newDateStr] = newRec[varName];
  }
  /**
   * @type {{ filePath: string; text: string; varName: string; first: boolean; value: any; lastValue: any;}[]}
   */
  const actions = [];
  for (const filePath in fileStateRecord) {
    if (!fileStateRecord[filePath].dirty) {
      continue;
    }
    fileStateRecord[filePath].dirty = false;
    const isInit = !fileStateRecord[filePath].initialized;
    if (isInit) {
      fileStateRecord[filePath].initialized = true;
    }
    const stateRecord = fileStateRecord[filePath].stateRecord;
    const dateList = Object.keys(stateRecord);
    const objList = dateList.map((dateKey) => ({
      date: dateKey,
      time: new Date(dateKey).getTime(),
      value: stateRecord[dateKey],
    }));
    const sorted = objList.sort((a, b) => a.time - b.time);
    const dateStr = sorted[sorted.length - 1].date;
    if (!dateStr) {
      throw new Error(
        `Could not find latest date and state has ${objList.length} entries`
      );
    }
    const newValue = sorted[sorted.length - 1]?.value;
    const oldValue = sorted[sorted.length - 2]?.value;
    const changeObj = {
      date: dateStr,
      value: newValue,
      lastDate: oldDataStr ? oldDataStr : undefined,
      lastValue: oldValue || undefined,
      interval: oldTime && newTime ? newTime - oldTime : undefined,
    };
    const isMatchingRef = newValue === oldValue;
    if (isMatchingRef) {
      continue;
    }
    const isMatchingJson = isMatchingRef
      ? undefined
      : JSON.stringify(newValue) === JSON.stringify(oldValue);
    if (!skipObjComparation) {
      const isObj = typeof newValue === "object";
      if (isObj && isMatchingJson) {
        continue;
      }
    }
    actions.push({
      filePath,
      text: JSON.stringify(changeObj) + ",\n",
      first: isInit,
      varName: fileStateRecord[filePath].varName,
      value: newValue,
      lastValue: oldValue || undefined,
    });
  }
  return actions;
}

async function saveLatestDataState(type = "status", list, record, date) {
  await saveRootDataFile(
    `latest-${type}.json`,
    JSON.stringify(
      {
        list,
        record,
        date: date.toISOString(),
      },
      null,
      "  "
    )
  );
}

async function loadLatestDataState(type = "status") {
  const text = await loadRootDataFile(`latest-${type}.json`);
  if (!text || text[0] !== "{") {
    return null;
  }
  const result = JSON.parse(text);
  const date = new Date(result.date.trim());
  if (!result.record["time"]) {
    result.record["time"] = date.getTime();
  }
  return {
    list: result.list,
    record: result.record,
    date: date,
  };
}

export default async function executeExtractionLoop(isLoopMode = true) {
  let sessionId = await loadRootDataFile("session-id.txt");
  const result = await login(sessionId);
  if (result.sessionId !== sessionId) {
    sessionId = result.sessionId;
    await saveRootDataFile("session-id.txt", sessionId);
  }
  const cached = getPreviousRequestData();
  const hasStatusCache =
    cached &&
    cached.url &&
    !cached.isRedirect &&
    !cached.isUnauthenticated &&
    cached.url.includes(endpointRecord.status);
  // First Status
  let status = await getStatusVars(
    sessionId,
    null,
    hasStatusCache ? cached : undefined
  );
  if (status.sessionId !== sessionId) {
    sessionId = status.sessionId;
    await saveRootDataFile("session-id.txt", sessionId);
  }
  let rec = generateStateRecordFromVarList(status.list, status.date);
  const diskStatus = await loadLatestDataState("status");
  latestStatusRecord = diskStatus ? diskStatus.record : null;
  if (latestStatusRecord) {
    const extra = createStatesFromComparation(latestStatusRecord, rec);
    // console.log('Augmented first status:', extra);
    for (const key in extra) {
      if (rec[key] === extra[key]) {
        continue;
      }
      if (rec[key]) {
        // throw new Error(`Adding duplicated key "${key}" that already exists to new record (${JSON.stringify(rec[key])} vs ${JSON.stringify(extra[key])})`);
      }
      rec[key] = extra[key];
    }
  }
  await persistVarRecord(latestStatusRecord, rec);
  latestStatusRecord = rec;
  await saveLatestDataState(
    "status",
    status.list,
    latestStatusRecord,
    status.date
  );
  await sleep(1000);

  // First Statistics
  let statistics = null;
  statistics = await getStatisticsVars(sessionId);
  if (statistics.sessionId !== sessionId) {
    sessionId = statistics.sessionId;
    await saveRootDataFile("session-id.txt", sessionId);
  }
  rec = generateStateRecordFromVarList(statistics.list, statistics.date);
  const diskStatistics = await loadLatestDataState("statistics");
  latestStatisticsRecord = diskStatistics ? diskStatistics.record : null;
  if (latestStatisticsRecord) {
    const extra = createStatesFromComparation(latestStatisticsRecord, rec);
    for (const key in extra) {
      if (rec[key] === extra[key]) {
        continue;
      }
      if (rec[key]) {
        // throw new Error(`Adding duplicated key "${key}" that already exists to new record (${JSON.stringify(rec[key])} vs ${JSON.stringify(extra[key])})`);
      }
      rec[key] = extra[key];
    }
  }
  await persistVarRecord(latestStatisticsRecord, rec);
  latestStatisticsRecord = rec;
  await saveLatestDataState(
    "statistics",
    statistics.list,
    latestStatisticsRecord,
    statistics.date
  );

  if (!isLoopMode) {
    console.log("Extraction process finished");
    return;
  }
  console.log("Extraction loop starting (interval timer is enabled)");
  // Start timer
  let isNextStatus = true;
  let inProgress = false;
  setInterval(() => {
    if (inProgress) {
      return;
    }
    inProgress = true;
    tick()
      .then(() => {
        inProgress = false;
      })
      .catch((err) => {
        inProgress = false;
        console.log("tick failed");
        console.log(err);
      });
    isNextStatus = !isNextStatus;
  }, 10_000);

  async function updateStatusData() {
    const resp = await getStatusVars(sessionId);
    const newRec = generateStateRecordFromVarList(resp.list, resp.date);
    const prevRec = latestStatusRecord;
    const extra = createStatesFromComparation(prevRec, newRec);
    for (const key in extra) {
      if (newRec[key] === extra[key]) {
        continue;
      }
      newRec[key] = extra[key];
    }
    latestStatusRecord = newRec;
    await saveLatestDataState(
      "status",
      resp.list,
      latestStatusRecord,
      resp.date
    );
    await persistVarRecord(prevRec, newRec, true);
  }
  async function updateStatisticsData() {
    const resp = await getStatisticsVars(sessionId);
    const newRec = generateStateRecordFromVarList(resp.list, resp.date);
    const prevRec = latestStatisticsRecord;
    const extra = createStatesFromComparation(prevRec, newRec);
    for (const key in extra) {
      if (newRec[key] === extra[key]) {
        continue;
      }
      newRec[key] = extra[key];
    }
    latestStatisticsRecord = newRec;
    await saveLatestDataState(
      "statistics",
      resp.list,
      latestStatisticsRecord,
      resp.date
    );
    await persistVarRecord(prevRec, newRec, true);
    // console.log(newRec);
  }
  async function tick() {
    console.log("Fetching", isNextStatus ? "status" : "statistics");
    if (isNextStatus) {
      await updateStatusData();
    } else {
      await updateStatisticsData();
    }
  }
}
