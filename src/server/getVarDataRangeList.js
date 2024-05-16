import getDateTimeString from "../utils/getDateTimeString.js";
import config from "../../config.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";
import fs from "node:fs";
import path from "node:path";
import { camelCaseToDash } from "../camelCaseToDash.js";

export async function getVarDataRangeList(varName = '') {
  const dataFolderPath = path.resolve(config.projectPath, "data");
  const list = [];
  const rootList = await getChildFileNodeList(dataFolderPath);
  for (const name of rootList) {
    if (varName && varName !== '*' && varName.toLowerCase() !== name.toLowerCase()) {
      continue;
    }
    const fileList = await getVariableFileList(name);
    if (fileList.length === 0) {
      continue;
    }
    list.push({
      name,
      ranges: fileList.map(a => ({fileName: a.fileName, start: a.fileStartDate, end: a.fileEndDate}))
    });
  }
  return list;
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

  /**
   * @returns {Promise<string[]>}
   */
  async function getChildFileNodeList(folderFilePath) {
    if (typeof folderFilePath !== "string") {
      throw new Error("Invalid argument");
    }
    const fileList = await asyncTryCatchNull(fs.promises.readdir(folderFilePath));
    return fileList instanceof Array ? fileList : [];
  }

  async function getVariableFileList(varName = "eth-intf-sts") {
    const folderFilePath = getTargetFolderPathForVariable(varName);
    const fileList = await getChildFileNodeList(folderFilePath);
    return fileList
      .filter(
        (f) => typeof f === "string" &&
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

}
