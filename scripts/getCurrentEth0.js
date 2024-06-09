import * as readline from "node:readline/promises";

import { stdin as input, stdout as output } from "node:process";
import { camelCaseToDash } from "../src/camelCaseToDash.js";
import getDateTimeString from "../src/utils/getDateTimeString.js";
import fs from "node:fs";
import path from "node:path";
import config from "../settings.js";
import asyncTryCatchNull from "../src/utils/asyncTryCatchNull.js";

const remoteProjectPath = "/home/backend/dev/router-vis";

async function sendCodeToServer(code) {
  const response = await fetch("https://grossato.com.br/personal-api/eval/", {
    method: "POST",
    body: code,
  });
  const text = await response.text();
  return text.trim();
}

/**
 * @returns {Promise<string[]>}
 */
async function getFolderFileList(folderFilePath) {
  if (typeof folderFilePath !== "string") {
    throw new Error("Invalid argument");
  }
  if (remoteProjectPath) {
    const result = await sendCodeToServer(
      'require("fs").promises.readdir(' +
        JSON.stringify(folderFilePath.replace(config.projectPath, remoteProjectPath).replace(/\\/g, '/')) +
        ').then(r => console.log(JSON.stringify(r))).catch(e => console.log("[]"))'
    );
    if (result[0] !== '{' && result[0] !== '[') {
      throw new Error("Server: " + result);
    }
    try {
      return JSON.parse(result);
    } catch (err) {
      throw new Error(`Could not interpret result from server: ${JSON.stringify(result)}`);
    }
  }

  const fileList = await asyncTryCatchNull(fs.promises.readdir(folderFilePath));
  return fileList instanceof Array ? fileList : [];
}

/**
 * @returns {Promise<string | null>}
 */
async function getFileContent(filePath) {
  if (typeof filePath !== "string") {
    throw new Error("Invalid argument");
  }
  if (remoteProjectPath) {
    const remoteFilePath = filePath.replace(/\\/g, '/').replace(config.projectPath.replace(/\\/g, '/'), remoteProjectPath.replace(/\\/g, '/')).replace(/\\/g, '/');
    const result = await sendCodeToServer(
      'const targetFilePath = ' + JSON.stringify(remoteFilePath) + ';\nrequire("fs").promises.readFile(targetFilePath, "utf-8").then(r => console.log(JSON.stringify(r))).catch(e => console.log("null"))'
    );
    try {
      return JSON.parse(result);
    } catch (err) {
      throw new Error(`Could not interpret result from server: ${JSON.stringify(result)}`);
    }
  }
  const text = await asyncTryCatchNull(fs.promises.readFile(filePath, "utf-8"));
  if (typeof text !== 'string') {
    return null;
  }
  return text;
}

function getTargetFolderPathForVariable(varName, fileDateStr = null) {
  const rawFolder = camelCaseToDash(varName.replace(/\W/, "-"))
    .replace(/\"/, "-")
    .replace(/(\d)/g, "$1-")
    .replace(/\-\-+/g, "-");
  const folder = rawFolder.endsWith("-")
    ? rawFolder.substring(0, rawFolder.length - 1)
    : rawFolder;
  if (!fileDateStr) {
    return path.resolve(config.projectPath, "data", folder);
  }
  if (typeof fileDateStr !== "string") {
    fileDateStr = getDateTimeString(fileDateStr);
  }
  const file = fileDateStr.substring(0, 13).replace(/\D/g, "-") + ".jsonl";
  const rawFilePath = path.resolve(config.projectPath, "data", folder, file);
  return rawFilePath.replace(/\\/g, "/");
}

function createEntryDate(value, date) {
  return {
    value,
    date,
  };
}

async function getVariableFileList(varName = "eth-intf-sts") {
  const folderFilePath = getTargetFolderPathForVariable(varName);
  const fileList = await getFolderFileList(folderFilePath);
  return fileList
    .filter(
      (f) =>
        typeof f === "string" &&
        f.length === "2020-01-01-01.jsonl".length &&
        f.endsWith(".jsonl")
    )
    .sort()
    .map((f) => ({
      filePath: path.resolve(folderFilePath, f).replace(/\\/g, "/"),
      fileName: f,
      fileStartDate: new Date(
        `${f.substring(0, 10)} ${f.substring(11, 13)}:00:00 -03:00`
      ),
    }))
    .map((a) => ({
      fileEndDate: new Date(a.fileStartDate.getTime() + 60 * 60 * 1000),
      ...a,
    }));
}

async function readJsonlDataFile(filePath, skipCache = false) {
  if (typeof filePath === "object" && typeof filePath.filePath === "string") {
    filePath = filePath.filePath;
  }
  if (typeof filePath !== "string") {
    throw new Error("Invalid file path: " + JSON.stringify(filePath));
  }
  if (readJsonlDataFile[filePath] && !skipCache) {
    /** @type {typeof parsed} */
    const cached = readJsonlDataFile[filePath];
    return cached;
  }
  const content = await getFileContent(filePath);
  const text = "[" + content.substring(0, content.lastIndexOf(",")) + "]";
  /** @type {any[]} */
  const entries = JSON.parse(text);
  const parsed = entries.map((e) => ({
    date: new Date(
      e.date + (e.date.includes("Z") || e.date.includes(" -") ? "" : " -03:00")
    ),
    value: e.value,
    lastDate: e.lastDate
      ? new Date(
          e.lastDate +
            (e.lastDate.includes("Z") || e.lastDate.includes(" -")
              ? ""
              : " -03:00")
        )
      : null,
    lastValue: e.lastValue || null,
    interval: e.interval,
  }));
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0 && parsed[i - 1].date.getTime() >= parsed[i].date.getTime()) {
      throw new Error(
        `Date ${getDateTimeString(
          parsed[i].date
        )} is out of order at index ${i} of ${filePath}`
      );
    }
  }
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0 && parsed[i].lastDate && parsed[i].interval) {
      const approx20_000 =
        parsed[i].date.getTime() - parsed[i].lastDate.getTime();
      if (Math.abs(approx20_000 - parsed[i].interval) > 1000) {
        console.warn(
          "[Warning]",
          `Distance from interval is ${
            approx20_000 - parsed[i].interval
          } of date ${getDateTimeString(
            parsed[i].date
          )} at index ${i} of ${filePath}`
        );
      }
    }
  }
  readJsonlDataFile[filePath] = parsed;
  return parsed;
}

function getDateObj(date) {
  if (date instanceof Date) {
    return date;
  }
  if (!date) {
    date = new Date();
  }
  if (typeof date === "number") {
    date = new Date(date);
  }
  date = date + (date.includes("Z") || date.includes(" -") ? "" : " -03:00");
  return new Date(date);
}

async function getVariableAtDate(
  varName = "eth-intf-sts",
  date,
  skipCache = false
) {
  if (!date) {
    date = new Date();
  }
  date = getDateObj(date);
  const varFileList = await getVariableFileList(varName);
  const augmentedFileList = varFileList.map((entry) => ({
    filePath: entry.filePath,
    fileName: entry.fileName,
    fileStartDate: entry.fileStartDate,
    fileEndDate: entry.fileEndDate,
    timeUntilTarget: entry.fileStartDate.getTime() - date.getTime(),
    timeSinceTarget: date.getTime() - entry.fileEndDate.getTime(),
    isTargetInside: date.getTime() >= entry.fileStartDate.getTime() && date.getTime() < entry.fileEndDate.getTime(),
  }))
  const firstDate = augmentedFileList[0].fileStartDate;
  const endDate = augmentedFileList[0].fileEndDate;
  const indexAfterFileList = augmentedFileList.findIndex((a) => a.isTargetInside);
  const indexFileList = indexAfterFileList === -1 ? augmentedFileList.length - 1 : indexAfterFileList;
  const splitFileList = indexFileList === -1 ? [] : augmentedFileList.slice(indexFileList - 1, indexFileList + 2);
  const lastFileList = splitFileList[0];
  const currFileList = splitFileList[1];
  const nextFileList = splitFileList[2];
  const targetFileList = currFileList ? currFileList : lastFileList;
  
  const entries = targetFileList ? await readJsonlDataFile(targetFileList, skipCache) : [];
  
  if (!(entries instanceof Array)) {
    throw new Error(
      `[readJsonlDataFile] returned invalid object: ${typeof entries}`
    );
  }
  const augmented = entries.map((entry) => ({
    date: entry.date,
    //target: getDateTimeString(date),
    value: entry.value,
    lastDate: entry.lastDate,
    lastValue: entry.lastValue,
    timeUntilTarget: entry.date.getTime() - date.getTime(),
    timeSinceTarget: date.getTime() - entry.date.getTime(),
    isTargetInside: date.getTime() >= entry.date.getTime() && date.getTime() < entry.date.getTime() + 20_000,
  }));
  const indexAfterEntries = augmented.findIndex((a) => a.timeSinceTarget <= 0);
  const indexEntries = indexAfterEntries === -1 ? augmented.length - 1 : indexAfterEntries - 1;
  const splitEntries = indexEntries === -1 ? [] : augmented.slice(indexEntries - 1, indexEntries + 2);
  const lastEntry = splitEntries[0];
  const currEntry = splitEntries[1];
  const nextEntry = splitEntries[2];
  return { lastEntry, currEntry, nextEntry, date };
}

const rl = readline.createInterface({ input, output });
console.log(
  await getVariableAtDate(
    "eth-intf-sts",
    process.argv[2]
  )
);
rl.close();
