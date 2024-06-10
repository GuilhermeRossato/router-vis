import fs from "node:fs";
import getDateTimeString from "../utils/getDateTimeString.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";
import { getVarFileDataPath } from "./getVarFileDataPath.js";

export async function loadVarDataFileAt(filePath) {
  const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
  if (!stat) {
    return null;
  }
  if (stat instanceof Error) {
    throw stat;
  }
  const result = await asyncTryCatchNull(fs.promises.readFile(filePath, "utf-8"));
  if (result instanceof Error) {
    throw result;
  }
  if (!result || !result[0]) {
    throw new Error(`Invalid content at "${filePath}"`);
  }
  let list = [];
  try {
    const content = `[${result.substring(result.indexOf("{"), result.lastIndexOf("}") + 1)}]`;
    list = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed interpreting data file at "${filePath}": ${err.message}`);
  }
  list = list.filter((e) => {
    if (!e || (!e.time && !e.date)) {
      return false;
    }
    if (!e.date && e.time && typeof e.time === 'number') {
      e.date = getDateTimeString(e.time);
    }
    return true;
  });
  return {
    entries: list,
    fileSize: stat.size,
    fileMtime: stat.mtime,
  };
}
export async function loadVarDataFile(varSrc, varType, varName, time) {
  const filePath = getVarFileDataPath(varSrc, varType, varName, time);
  return await loadVarDataFileAt(filePath);
}
