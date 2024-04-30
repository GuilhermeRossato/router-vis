import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";

/**
 * Process a client request
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(data) {
  if (data.type === "init" && (data.argv.includes('--restart') || data.argv.includes('--exit') || data.argv.includes('--stop'))) {
    console.log('Processing exit request');
    setTimeout(() => { process.exit(0); }, 10);
    return {
      message: "exit request"
    }
  }
  if (data.type === "status" || data.type === "init") {
    const now = new Date().getTime();
    return {
      message: "ok",
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv,
      uptime: getIntervalTimeBetweenDates(now - process.uptime() * 1000, now),
    };
  }
  return {
    message: `unhandled "${data.type}"`,
    pid: process.pid,
  };
}
