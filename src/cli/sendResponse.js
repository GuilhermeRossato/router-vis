import getStatisticsVars from "../extract/getStatisticsVars.js";
import getStatusVars from "../extract/getStatusVars.js";
import login from "../extract/login.js";
import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";
import { loadRootDataFile, saveRootDataFile } from "./storage.js";

/**
 * Process a client request
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(data) {
  if (data.type === "exit") {
    console.log('Processing exit request');
    setTimeout(() => { process.exit(0); }, 100);
    return {
      success: true,
      message: "Exiting"
    }
  }
  if (data.type === "init") {
    const now = new Date().getTime();
    return {
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv,
      uptime: getIntervalTimeBetweenDates(now - process.uptime() * 1000, now),
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
  if (data.type === "load-statistics") {
    return await getStatisticsVars();
  }
  if (data.type === "load-status") {
    return await getStatusVars();
  }
  return {
    message: `Unhandled type: "${data.type}"`,
    pid: process.pid,
  };
}
