import fs from "node:fs";
import path from "node:path";
import {config, dataFileName} from "../../settings.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

function convertLineToTriple(line) {
  const space = line.indexOf(' ');
  const firstSeparator = line.indexOf(' - ', space + 1);
  const startsDate = line[0] === '2' && line[1] === '0' && space !== -1 && firstSeparator !== -1 && firstSeparator > space;
  const date = startsDate ? line.substring(0, firstSeparator) : '';
  const sourceLineSeparator = line.indexOf(':', firstSeparator + 3);
  const d = line.indexOf(' - ', sourceLineSeparator + 1);
  let source = '';
  let text = '';
  if (startsDate && sourceLineSeparator !== -1 && sourceLineSeparator > firstSeparator && d !== -1 && d > sourceLineSeparator) {
    source = line.substring(firstSeparator + 3, d);
    text = line.substring(d + 3);
  } else {
    source = '';
    text = line.substring(startsDate ? firstSeparator + 3 : 0);
  }
  return {date: date ? new Date(date) : null, source, text};
}

export default async function getExtractionServerLogs(offset = 0, buffer = Buffer.alloc(16384)) {
  let read = 0;
  let size = 0;
  let list = [];
  const logFilePath = path.resolve(config.dataPath, dataFileName.serverLog);
  const stat = await asyncTryCatchNull(fs.promises.stat(logFilePath));
  if (!stat || stat instanceof Error || stat.size === 0 || stat.isDirectory()) {
    return {size, read, list, buffer};
  }
  if (offset && offset === stat.size) {
    return {size, read, list, buffer};
  }
  const f = await asyncTryCatchNull(fs.promises.open(logFilePath, 'r'));
  if (!f || f instanceof Error) {
    return {size, read, list, buffer};
  }
  const result = await f.read({position: Math.max(0, offset-3), buffer});
  read = result.bytesRead;
  const text = buffer.toString('utf-8').trim().replace(/\r/g, '');
  await f.close();
  list = text.substring(Math.max(3, text.indexOf('\n') + 1)).split('\n').map(convertLineToTriple);
  return {size, read, list, buffer};
}
