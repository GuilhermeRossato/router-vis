import path from "node:path";
import fs from "node:fs";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";
import { getVarFileDataPath } from "./getVarFileDataPath.js";
import getDateTimeString from "../utils/getDateTimeString.js";

async function primitivePersistData(filePath, data, isNew = false) {
  const { time, varType, varName, varSrc, value, lastTime, lastValue } = data;
  const obj = {
    time,
    type: varType,
    name: varName,
    src: varSrc,
    value,
    lastTime,
    lastValue,
  };
  const line = `${JSON.stringify(obj)},\n`;
  if (isNew) {
    await fs.promises.writeFile(filePath, line, "utf-8");
  } else {
    await fs.promises.appendFile(filePath, line, "utf-8");
  }
  return line.length;
}

/**
 * @param {UpdateEntry[] | UpdateEntry} updates
 */
export async function persistVarUpdateEntries(updates) {
  if (typeof updates === 'object' && !(updates instanceof Array)) {
    updates = [updates];
  }
  let written = 0;
  for (const update of updates) {
    const filePath = getVarFileDataPath(update.varSrc, update.varType, update.varName, update.time);
    const result = await persistVarUpdateEntryInFile(filePath, update);
    written += result.written;
  }
  return written;
}

export async function persistVarUpdateEntryInFile(filePath, data) {
  if (!data || typeof data !== "object" || data instanceof Array || Object.keys(data).length <= 1) {
    throw new Error(`Invalid data to save to ${filePath}`);
  }
  if (!data.date && !data.time) {
    throw new Error('Update is missing "date" and "time"');
  }
  if (data.date && !data.time) {
    data.time = new Date(getDateTimeString(data.date, true)).getTime();
  }
  if (!data.date && data.time) {
    data.date = getDateTimeString(data.time, false);
  }
  if (data.lastTime && data.lastTime > data.time) {
    throw new Error(`Invalid lastTime (${data.lastTime}) at ${data.date} (${data.time}) of "${data.varName}" from "${data.varSrc}" (type is ${data.varType})`);
  }
  const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
  if (stat instanceof Error) {
    throw stat;
  }
  if (!stat) {
    console.debug("Creating new variable file:", JSON.stringify(filePath));
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  }
  let result;
  try {
    result = await primitivePersistData(filePath, data, !stat);
  } catch (err) {
    console.debug('Failed to write file:', JSON.stringify(filePath));
    result = err;
  }
  if (result instanceof Error) {
    throw result;
  }
  return {
    filePath,
    fileSize: (stat ? stat.size : 0) + result,
    written: result,
  };
}

