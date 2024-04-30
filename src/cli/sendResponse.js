import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";

/**
 * Process a client request
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(data) {
  if (data.type === "status") {
    const now = new Date().getTime();
    return {
      message: "ok",
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv,
      uptime: getIntervalTimeBetweenDates(now + process.uptime() * 1000, now),
    };
  }
  return {
    message: "unhandled",
  };
}
