import config from "../config.js";
import { camelCaseToDash } from "./camelCaseToDash.js";
import { loadRootDataFile, saveRootDataFile } from "./cli/storage.js";
import { endpointRecord } from "./extract/endpoints.js";
import getStatisticsVars from "./extract/getStatisticsVars.js";
import getStatusVars from "./extract/getStatusVars.js";
import login from "./extract/login.js";
import { getPreviousRequestData } from "./extract/routerRequest.js";
import createStatesFromComparation from "./parse/createStatesFromComparation.js";
import generateStateRecordFromVarList from "./parse/generateStateRecordFromVarList.js";
import getDateTimeString from "./utils/getDateTimeString.js";
import fs, { stat } from "node:fs";
import path from "node:path";
import sleep from "./utils/sleep.js";

let latestStatusRecord = null;
export function getLatestStatusRecord() {
  return latestStatusRecord;
}

let latestStatisticsRecord = null;
export function getLatestStatisticsRecord() {
  return latestStatisticsRecord;
}

function getTargetFilePathForVariable(varName, dateStr) {
  const rawFolder = camelCaseToDash(varName.replace(/\W/, "-"))
    .replace(/\"/, "-")
    .replace(/(\d)/g, "$1-")
    .replace(/\-\-+/g, "-");
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

async function persistVarRecord(oldRec, newRec, skipComparation = false) {
  const actions = await getPersistVarRecordActions(
    oldRec,
    newRec,
    skipComparation
  );
  if (actions.length === 0) {
    return;
  }
  console.log(
    "Persisting changes:",
    actions.map((a) => a.varName)
  );
  for (const act of actions) {
    if (act.first) {
      await fs.promises.mkdir(path.dirname(act.filePath), { recursive: true });
    }
    await fs.promises.appendFile(act.filePath, act.text, "utf-8");
  }
}
async function getPersistVarRecordActions(
  oldRec,
  newRec,
  skipComparation = false
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
    if (varName === "date" || varName === "time") {
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
   * @type {{ filePath: string; text: string; varName: string; first: boolean;}[]}
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
    const isMatchingJson = isMatchingRef
      ? undefined
      : JSON.stringify(newValue) === JSON.stringify(oldValue);

    if (!skipComparation) {
      const isObj = typeof newValue === "object";
      if (isMatchingRef) {
        continue;
      }
      if (isObj && isMatchingJson) {
        continue;
      }
    }
    actions.push({
      filePath,
      text: JSON.stringify(changeObj) + ",\n",
      first: isInit,
      varName: fileStateRecord[filePath].varName,
    });
  }
  return actions;
}

async function saveLatestDataState(type = "status", list, record, date) {
  await saveRootDataFile(
    `latest-${type}.json`,
    JSON.stringify({
      list: list.map((a) => a),
      record,
      date: date.toISOString(),
    })
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

export default async function initExtractionLoop(isStartTimer = true) {
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
    console.log("Augmented first statistics:", extra);
    for (const key in extra) {
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

  if (!isStartTimer) {
    console.log("Extraction process finished");
    return;
  }
  console.log("Extraction loop starting because interval timer is enabled");
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

  async function tick() {
    console.log("Fetching", isNextStatus ? "status" : "statistics");
    let list;
    if (isNextStatus) {
      list = await getStatusVars(sessionId);
    } else {
      list = await getStatisticsVars(sessionId);
    }
    const newRec = generateStateRecordFromVarList(list.list, list.date);
    const prevRec = isNextStatus ? latestStatusRecord : latestStatisticsRecord;
    const extra = createStatesFromComparation(prevRec, newRec);
    console.log(
      isNextStatus ? "Status" : "Statistics",
      "augment:",
      Object.keys(extra)
    );
    for (const key in extra) {
      rec[key] = extra[key];
    }
    if (isNextStatus) {
      latestStatusRecord = newRec;
    } else {
      latestStatisticsRecord = newRec;
    }
    await persistVarRecord(prevRec, newRec);
  }
}
