import login from "../extract/login.js";
import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";
import {
  loadRootTextFile,
  saveRootTextFile,
} from "../data/rootTextFileStorage.js";
import getExtractionServerLogs from "./getExtractionServerLogs.js";
import sleep from "../utils/sleep.js";
import { getJoinedStateRecord, waitForJoinedStateUpdate } from "../executeExtraction.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { getVarDataRangeList } from "./getVarDataRangeList.js";
import { getVarListStateAtDate } from "./getVarListStateAtDate.js";
import routerRequest from "../extract/routerRequest.js";
import isolateVarList from "../extract/isolateVarList.js";
import generateStateRecordFromVarList from "../parse/generateStateRecordFromVarList.js";
import { endpointRecord } from "../extract/endpoints.js";

export const responseHandlerTypeRecord = {
  "read": readRequestHandler,
  "list": listRequestHandler,
  "next": nextRequestHandler,
  "logs": logsRequestHandler,
  "info": infoRequestHandler,
  "login": loginRequestHandler,
  "status": statusRequestHandler,
  "statistics": statisticsRequestHandler,
  "exit": exitRequestHandler,
}


async function readRequestHandler(read) {
  const rec = getJoinedStateRecord();
  return {
    record: rec,
  }
}

async function listRequestHandler(data) {
  const list = await getVarDataRangeList(data.name || '');

  return {
    list,
  }
}

async function nextRequestHandler(data) {

  const rec = await waitForJoinedStateUpdate(data.name);
  return {
    record: rec,
  }
}

async function logsRequestHandler(data) {

  let logList = await getExtractionServerLogs(data.cursor);
  while (logList.length === 0 && data.wait) {
    await sleep(400);
    logList = await getExtractionServerLogs(data.cursor);
  }
  if (logList.length === 0) {
    return {
      logs: [],
      cursor: undefined,
    }
  }
  if (logList.length >= 40) {
    logList = logList.slice(0, 40);
  }
  let cursor = null;
  if (logList[logList.length - 1] && logList[logList.length - 1].date) {
    cursor = (logList[logList.length - 1].date instanceof Date) ? logList[logList.length - 1].date.getTime() : (typeof logList[logList.length - 1].date === 'number' ? logList[logList.length - 1].date : -1);
  } else if (logList[logList.length - 2] && logList[logList.length - 2].date) {
    cursor = (logList[logList.length - 2].date instanceof Date) ? logList[logList.length - 2].date.getTime() : (typeof logList[logList.length - 2].date === 'number' ? logList[logList.length - 2].date : -1);
  }
  return { cursor, logs: logList };


}

async function infoRequestHandler() {
  const now = new Date().getTime();
  const data = getJoinedStateRecord();
  return {
    pid: process.pid,
    ppid: process.ppid,
    cwd: process.cwd(),
    argv: process.argv,
    uptime: getIntervalTimeBetweenDates(now - process.uptime() * 1000, now),
    extraction: {
      varCount: Object.keys(data).length,
      hostCount: Object.keys(data['hosts'] || {}).length,
      lastTime: data['time'] ? data['time'] : null,
      lastDate: data['time'] ? getDateTimeString(data['time']) : null,
    }
  };
}

async function loginRequestHandler(data) {
  const sessionId = await loadRootTextFile("session-id.txt");
  const result = await login(sessionId);
  if (result.sessionId !== sessionId) {
    await saveRootTextFile("session-id.txt", result.sessionId);
  }
  return result;
}

async function statusRequestHandler(data) {
  return await performExtractionHandler(endpointRecord.status, data);
}

async function statisticsRequestHandler(data) {
  return await performExtractionHandler(endpointRecord.statistics, data);
}

async function performExtractionHandler(endpoint, data) {
  let sessionId = await loadRootTextFile("session-id.txt");
  const routerResponse = await routerRequest(
    endpoint,
    sessionId
  );
  if (routerResponse.sessionId !== sessionId) {
    sessionId = routerResponse.sessionId;
    await saveRootTextFile("session-id.txt", sessionId);
  }
  const list = isolateVarList(routerResponse);
  const rec = generateStateRecordFromVarList(list);
  const filtered = {
    date: getDateTimeString(routerResponse.date),
    ...applyArgumentFilterOnRecord(data, rec)
  }
  return filtered;
}

async function applyArgumentFilterOnRecord(data, rec) {
  return rec;
}

async function exitRequestHandler(data) {
  console.log("Processing exit request");
  setTimeout(() => {
    process.exit(0);
  }, 100);
  return {
    success: true,
    message: "Exiting",
  };
}

/**
 * Process a client request
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(data) {
  const handler = responseHandlerTypeRecord[data?.type];
  if (!handler) {
    return {
      request: data,
      error: 'Unhandled request',

      serverPid: process.pid,
      serverUptimeMs: Math.floor(1000 * process.uptime()),
    }
  }
  return await handler(data);
}
