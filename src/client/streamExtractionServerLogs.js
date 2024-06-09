import sleep from "../utils/sleep.js";
import getExtractionServerLogs from "../server/getExtractionServerLogs.js";
import getDateTimeString from "../utils/getDateTimeString.js";

let lastDatePrinted = "";
function streamLine(prefix, date, ...args) {
  let dateStr = '';
  if (date instanceof Date) {
    let [yyyymmdd, hhmmss] = getDateTimeString(date).substring(0, 19).replace('T', ' ').split(' ');
    if (lastDatePrinted && yyyymmdd === lastDatePrinted) {
      dateStr = hhmmss;
      lastDatePrinted = lastDatePrinted.substring(0, lastDatePrinted.length - 1);
    } else {
      dateStr = `${yyyymmdd} ${hhmmss}`;
      lastDatePrinted = dateStr; 
    }
  }
  if (dateStr.length !== 19) {
    dateStr = dateStr.substring(0, 19).padStart(19, '');
  }
  const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  process.stdout.write(`${prefix + dateStr} ${text}\n`);
}

export async function streamExtractionServerLogs() {
  let logs = await getExtractionServerLogs();
  let cursor = Math.max(0, logs.size - logs.buffer.length + 16);
  for (let count = 0; count < 999999; count++) {
    const logs = await getExtractionServerLogs(cursor);
    for (const { date, source, text } of logs.list) {
      streamLine('[E]', date, (source||0).toString().padStart(5), text);
    }
  }
}
