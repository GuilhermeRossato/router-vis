import sleep from "../utils/sleep.js";
import getExtractionServerLogs from "../storage/getExtractionServerLogs.js";
import { streamDatedLine } from "../vis/streamDatedLine.js";

export async function streamExtractionServerLogs(continuous = false) {
  let logs = await getExtractionServerLogs(-4096);
  let offset = 0;
  if (logs.size >= 4096) {
    offset = logs.offset;
    for (let i = 0; offset + i + 1 < logs.size && i < logs.read && i < logs.buffer.length; i++) {
      if (logs.buffer[i] === 10) {
        console.debug('Moved offset by', i);
        offset = offset + i + 1;
        break;
      }
    }
  }
  logs = await getExtractionServerLogs(offset, logs.buffer);
  offset = logs.offset + logs.read;
  for (const {date, text} of logs.list) {
    streamDatedLine('[E]', date, text);
    await sleep(10);
  }
  if (!continuous) {
    return;
  }
  for (let count = 0; count < 999999; count++) {
    await sleep(100);
    logs = await getExtractionServerLogs(logs.size, logs.buffer);
    for (const {date, text} of logs.list) {
      streamDatedLine('[E]', date, text);
      await sleep(30);
    }
  }
}
