import sleep from "../utils/sleep.js";
import getExtractionServerLogs from "../server/getExtractionServerLogs.js";
import getDateTimeString from "../utils/getDateTimeString.js";

export async function streamExtractionServerLogs() {
  let cursor = new Date().getTime() - 15 * 60 * 1000;
  let lastDatePrinted = "";
  for (let count = 0; count < 999999; count++) {
    const logList = await getExtractionServerLogs(cursor);
    let i;
    for (i = logList.length - 1; i >= 0; i--) {
      if (logList[i].date && logList[i].date.getTime() < cursor) {
        break;
      }
    }
    const remaining = logList.slice(i);
    if (remaining.length === 0) {
      await sleep(200);
      continue;
    }
    for (const { date, source, text } of remaining) {
      process.stdout.write(`[E] `);
      if (date) {
        cursor = date.getTime();
        let dateToPrint = getDateTimeString(date).substring(0, 19);
        if (lastDatePrinted.substring(0, 10) === dateToPrint.substring(0, 10)) {
          dateToPrint = " ".repeat(10) + dateToPrint.substring(10);
          lastDatePrinted = lastDatePrinted.substring(
            0,
            lastDatePrinted.length - 1
          );
        } else {
          lastDatePrinted = dateToPrint;
        }
        process.stdout.write(`${dateToPrint} `);
      } else {
        process.stdout.write(`${" ".repeat(19)} `);
      }
      process.stdout.write(`${(source ? source.toString() : "").padStart(5)} `);
      process.stdout.write(text);
      if (!text.endsWith("\n")) {
        process.stdout.write("\n");
      }
    }
  }
}
