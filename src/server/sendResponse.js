import getStatisticsVars from "../extract/getStatisticsVars.js";
import getStatusVars from "../extract/getStatusVars.js";
import login from "../extract/login.js";
import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";
import {
  loadRootDataFile,
  saveRootDataFile,
} from "../cli/rootDataFileStorage.js";
import getExtractionServerLogs from "./getExtractionServerLogs.js";
import sleep from "../utils/sleep.js";
import { getJoinedStateRecord, waitForJoinedStateUpdate } from "../executeExtractionLoop.js";
import getDateTimeString from "../utils/getDateTimeString.js";

/**
 * Process a client request
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(data) {
  if (data.type === "exit") {
    console.log("Processing exit request");
    setTimeout(() => {
      process.exit(0);
    }, 100);
    return {
      success: true,
      message: "Exiting",
    };
  }
  if (data.type === "data") {
    console.log("Responding current data request");
    const rec = getJoinedStateRecord();
    return {
      record: rec,
    }
  }
  if (data.type === "single") {
    console.log("Responding single data request");
    const rec = await waitForJoinedStateUpdate();
    return {
      record: rec,
    }
  }
  if (data.type === "logs") {
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
  if (data.type === "init") {
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
  if (data.type === "login") {
    const sessionId = await loadRootDataFile("session-id.txt");
    const result = await login(sessionId);
    if (result.sessionId !== sessionId) {
      await saveRootDataFile("session-id.txt", result.sessionId);
    }
    return result;
  }
  if (data.type === "statistics") {
    return await getStatisticsVars();
  }
  if (data.type === "status") {
    return await getStatusVars();
  }
  return {
    message: `Unhandled type: "${data.type}"`,
    pid: process.pid,
  };
}
