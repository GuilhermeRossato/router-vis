import getDateTimeString from "../utils/getDateTimeString.js";

let lastDatePrinted = "";
export function streamDatedLine(prefix, date, ...args) {
  let dateStr = date ? getDateTimeString(date).substring(0, 19) : '';
  const [yyyymmdd, hhmmss] = dateStr.split(' ');
  if (yyyymmdd && hhmmss && lastDatePrinted.startsWith(yyyymmdd)) {
    dateStr = hhmmss;
    lastDatePrinted = lastDatePrinted.substring(0, lastDatePrinted.length - 1);
  } else {
    lastDatePrinted = dateStr;
  }
  if (dateStr.length !== 20) {
    dateStr = dateStr.substring(0, 20).padStart(20, ' ');
  }
  const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  process.stdout.write(`${prefix + dateStr} ${text}\n`);
}
