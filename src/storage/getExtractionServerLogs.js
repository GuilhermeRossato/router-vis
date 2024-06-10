import fs from "node:fs";
import path from "node:path";
import {config, dataFileName} from "../../settings.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

function convertLineToTriple(line) {
  if (!line.trim().length) {
    return null;
  }
  const dateTimeSep = line.indexOf(' ');
  const dateSrcSep = dateTimeSep === -1 ? -1 : line.indexOf(' - ', dateTimeSep + 1);
  if (dateSrcSep === -1) {
    return {date: '', text: line.trim()};
  }
  const srcPidSep = line.indexOf(' - ', dateSrcSep + 3);
  if (dateSrcSep < 15 || srcPidSep === -1) {
    return {date: '', text: line.trim()};
  }
  const dateStr = line.substring(0, dateTimeSep);
  const timeStr = line.substring(dateTimeSep+1, dateSrcSep);
  return {date: `${dateStr} ${timeStr}`.trim(), text: line.substring(dateSrcSep+3).trim()};
}

export default async function getExtractionServerLogs(offset, buffer) {
  const result = {
    size: 0,
    read: 0,
    list: [].map(convertLineToTriple),
    buffer,
    offset,
    time: new Date().getTime(),
    text: '',
    mtimeMs: 0,
  };
  const logFilePath = path.resolve(config.dataPath, dataFileName.serverLog);
  const stat = await asyncTryCatchNull(fs.promises.stat(logFilePath));
  if (!stat || stat instanceof Error || stat.size === 0 || !stat.isFile()) {
    return result;
  }
  result.size = stat.size;
  result.mtimeMs = stat.mtimeMs;
  if (offset && offset >= stat.size) {
    result.offset = stat.size;
    return result;
  }
  const f = await asyncTryCatchNull(fs.promises.open(logFilePath, 'r'));
  if (!f || f instanceof Error) {
    return result;
  }
  try {
    if (!buffer) {
      buffer = result.buffer = Buffer.alloc(16384);
    }
    if (typeof offset === 'number' && offset < 0) {
      offset = Math.max(0, result.size+offset);
    }
    if (buffer.byteLength && (offset === undefined || offset === null || typeof offset !== 'number' || offset < 0 || isNaN(offset))) {
      offset = Math.max(0, stat.size - buffer.byteLength);
    }
    const readResult = await f.read({position: offset, buffer});
    result.read = readResult.bytesRead;
  } catch (err) {
    await f.close();
    console.log('Failed reading extraction logs:');
    console.log(err);
    return result;
  }
  await f.close();
  try {
    result.text = buffer.slice(0, result.read).toString('utf-8').trim().replace(/\r/g, '');
    const nl = result.text.indexOf('\n');
    if (nl !== -1 && nl < 20) {
      result.text = result.text.substring(result.text.indexOf('\n')+1);
    }
    result.list = result.text.split('\n').map(convertLineToTriple).filter(Boolean);
  } catch (err) {
    console.debug(err);
  }
  result.offset = offset;
  return result;
}
