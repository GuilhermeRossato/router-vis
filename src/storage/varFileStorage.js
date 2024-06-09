import path from "node:path";
import fs from "node:fs";
import { config } from "../../settings.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { getNormalizedVarName } from "../getNormalizedVarName.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

const csvColumns = ["date", "type", "name", "value", "time", "lastTime", "period", "lastValue"];

const csvHeader = `${csvColumns.join(",")}\n`;

export async function appendVarDataUpdate(update) {
  const list = update instanceof Array ? update : [update];
  for (const { type, varSrc, varName, varType, time, value, lastTime, lastValue } of list) {
    const filePath = getVarDataPath(varSrc, varType, varName, time);
    await appendVarDataFileAt(filePath, {
      time,
      type,
      varName,
      value,
      lastTime,
      lastValue,
    });
  }
}

export async function loadVarDataFile(varSrc, varType, varName, time) {
  const filePath = getVarDataPath(varSrc, varType, varName, time);
  return await loadVarDataFileAt(filePath);
}

export async function appendVarDataFileAt(filePath, data) {
  if (!data || typeof data !== "object" || data instanceof Array || Object.keys(data).length <= 1) {
    throw new Error(`Invalid data to save to ${filePath}`);
  }
  const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
  if (stat instanceof Error) {
    throw stat;
  }
  if (!stat) {
    console.debug("Creating new variable file:", JSON.stringify(filePath));
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, csvHeader, "utf-8");
  }
  const values = csvColumns.map((key) => {
    if (key === "name" || key === "var" || key === "varName") {
      key = data["varName"] ? "varName" : "name";
    }
    if (key === "date") {
      return getDateTimeString(data.time || data.date).substring(0, 19);
    }
    if (key === "type") {
      return data.type ? data.type[0] : "?";
    }
    if (key === "period") {
      return data.lastTime && data.time ? ((data.time - data.lastTime) / 1000).toFixed(1) : "";
    }
    if (typeof data[key] === "number") {
      return data[key].toString();
    }
    if (typeof data[key] === "boolean") {
      return data[key] ? "1" : "0";
    }
    if (!data[key] || data[key] === "null" || data[key] === "undefined") {
      return "";
    }
    return typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]);
  });
  const sanitized = values.map((v) => {
    if (v.includes('"')) {
      v = v.replace(/\'/g, "").replace(/\"/g, "'");
    }
    if (v.includes("\r") || v.includes("\n")) {
      v = v.replace(/\r/g, "").replace(/\n/g, "#(lf)");
    }
    if (v.includes(",") || v.startsWith(" ") || v.endsWith(" ")) {
      v = `"${v}"`;
    }
    return v;
  });
  const line = `${sanitized.join(",")}\n`;
  const result = await asyncTryCatchNull(fs.promises.appendFile(filePath, line, "utf-8"));
  if (result instanceof Error) {
    throw result;
  }
  return {
    filePath,
    fileSize: stat ? stat.size + line.length : line.length + csvHeader.length,
  };
}

export async function listVarDataFileTimes(varSrc, varType, varName) {
  const filePath = getVarDataPath(varSrc, varType, varName);
  return await listVarDataFilesAt(filePath);
}

export async function loadUpdatedVarDataFile(varSrc, varType, varName, time, mtime) {
  const filePath = getVarDataPath(varSrc, varType, varName, time);
  return await loadUpdatedVarDataFileAt(filePath, mtime);
}

export function getVarDataPath(varSrc, varType, varName = undefined, time = undefined) {
  varSrc = varSrc === "status" ? "status" : varSrc === "statistics" ? "statistics" : null;
  if (!varSrc) {
    throw new Error("Unexpected source");
  }
  varType =
    varType[0] === "v"
      ? "values"
      : varType[0] === "o"
      ? "objects"
      : varType === "a"
      ? "arrays"
      : null;
  if (!varType) {
    throw new Error("Unexpected record type");
  }
  const varNameFolder = path.resolve(config.dataPath, `${varSrc}-${varType}`);
  if (!varName) {
    return varNameFolder;
  }
  const fileTimeFolderPath = path.resolve(varNameFolder, getNormalizedVarName(varName));
  if (!time) {
    return fileTimeFolderPath;
  }
  if (typeof time === "string" && time[0] === "2" && time.length >= "2024-05-16-10".length) {
    const fileName = `${time.substring(0, 10)}-${time.substring(11, 13)}.csv`;
    return path.resolve(fileTimeFolderPath, fileName);
  }
  const dateStr = getDateTimeString(time).substring(0, 19).replace(/\D/g, "-");
  const yearMonthDayHour = dateStr.substring(0, "2024-05-16-10".length);
  const fileName = yearMonthDayHour + ".csv";
  const filePath = path.resolve(fileTimeFolderPath, fileName);
  return filePath;
}

async function loadVarDataFileAt(filePath) {
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
  let list = undefined;
  if (
    filePath.endsWith(".json") ||
    filePath.endsWith(".jsonl") ||
    result[0] === "{" ||
    result[0] === "["
  ) {
    try {
      const content = `[${result.substring(result.indexOf("{"), result.lastIndexOf("}") + 1)}]`;
      list = JSON.parse(content);
    } catch (error) {
      console.debug(`${error.message} while trying to read data file as JSON at "${filePath}"`);
    }
  }
  if (list === undefined) {
    const rowList = [];
    try {
      const lines = result.split("\n").map((line) => line.trim().replace(/\r/g, ""));
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.length || !line.includes(",")) {
          continue;
        }
        const values = [];
        let j;
        let str = line;
        for (let k = 0; k < 1000 && str.length; k++) {
          j = str.indexOf('"');
          if (j === -1) {
            values.push(...str.split(","));
            break;
          }
          if (j === 0) {
            const close = str.indexOf('",', 1);
            values.push(str.substring(0, close === -1 ? str.length : close + 1));
            if (close === -1 || close + 2 >= str.length || str[close + 1] !== ",") {
              break;
            }
            str = str.substring(close + 2);
            continue;
          }
          if (j > 0 && str[j] === '"' && str[j + 1] === ",") {
            values.push(...str.substring(0, j + 1).split(","));
            str = str.substring(j + 2);
            continue;
          }
          break;
        }
        rowList.push(values);
      }
      const columns = rowList[0];
      for (let i = 1; i < rowList.length && columns.length; i++) {
        const obj = {};
        for (let j = 0; j < Math.max(columns.length, columns.length); j++) {
          const key = j >= columns.length ? `column${j}` : columns[j];
          const value = j >= columns.length ? "" : columns[j];
          obj[key] = value;
        }
        list.push(obj);
      }
    } catch (err) {
      throw new Error(`Failed interpreting data file at "${filePath}": ${err.message}`);
    }
  }
  const entries = list.map((a) => ({
    ...a,
    time: a.time ? a.time : a.date ? new Date(a.date + " -03:00").getTime() : a.time,
  }));
  return {
    entries,
    fileSize: stat.size,
    fileMtime: stat.mtime,
  };
}

async function listVarDataFilesAt(filePath) {
  const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
  if (stat instanceof Error) {
    throw stat;
  }
  if (!stat) {
    return [];
  }
  const list =
    stat && stat.isDirectory()
      ? await asyncTryCatchNull(fs.promises.readdir(filePath))
      : [path.basename(filePath)];
  if (list instanceof Error) {
    throw list;
  }
  if (!list || !list.length) {
    return [];
  }
  const files = list
    .filter((f) => f.endsWith(".csv") || f.endsWith(".json") || f.endsWith(".jsonl"))
    .sort();
  const result = [];
  for (const fileName of files) {
    try {
      const fileTime = fileName.substring(0, fileName.lastIndexOf("."));
      const fileTimePath = path.resolve(filePath, fileName);
      const stat = await asyncTryCatchNull(fs.promises.stat(fileTimePath));
      if (!(stat instanceof fs.Stats)) {
        console.debug(`Failed while reading "${fileTimePath}":`, stat);
        continue;
      }
      const [from, to] = ["00:00:00.000 -03:00", "00:59:59.999 -03:00"].map((sufix) =>
        new Date(
          `${fileTime.substring(0, 10)} ${fileTime.substring(11, 13)}${sufix.substring(2)}`,
        ).getTime(),
      );
      /** @type {()=>ReturnType<typeof loadVarDataFileAt>} */
      const load = loadVarDataFileAt.bind(null, fileTimePath);
      result.push({
        path: fileTimePath,
        stat,
        from,
        to,
        load,
      });
    } catch (err) {
      console.debug(`Failed while reading file metadata for "${fileName}":`, err);
    }
  }
  return result.sort((a, b) => a.from - b.from);
}

async function loadUpdatedVarDataFileAt(filePath, previousModifiedTime) {
  const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
  if (stat instanceof Error) {
    throw stat;
  }
  if (stat) {
    const mtimeMs =
      typeof previousModifiedTime === "number"
        ? previousModifiedTime
        : new Date(previousModifiedTime).getTime();
    if (stat.mtimeMs === mtimeMs) {
      return null;
    }
  }
  return await loadVarDataFileAt(filePath);
}
