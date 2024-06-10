import path from "node:path";
import { config } from "../../settings.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { getNormalizedVarName } from "../extract/getNormalizedVarName.js";

export function getVarFolderName(varSrc, varType) {
  if (varSrc === 'value' && varType === 'status') {
    throw new Error('Switched parameters');
  }
  varSrc = typeof varSrc !== 'string' ? `(${typeof varSrc})` : varSrc === "status" ? "status" : varSrc.startsWith("statistic") ? "statistics" : null;
  if (!varSrc) {
    throw new Error(`Unexpected source: ${JSON.stringify(varSrc)}`);
  }
  varType =
    varType[0] === "v"
      ? "value"
      : varType[0] === "o"
        ? "object"
        : varType === "a"
          ? "array"
          : null;
  if (!varType) {
    throw new Error(`Unexpected type: ${JSON.stringify(varType)}`);
  }
  return `${varType.substring(0, 3)}-${varSrc}`;
}

export function getVarFileDataPath(varSrc, varType, varName = undefined, time = undefined) {
  const varFolderName = getVarFolderName(varSrc, varType);
  const varNameFolder = path.resolve(config.dataPath, varFolderName);
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
  const fileName = yearMonthDayHour + ".jsonl";
  const filePath = path.resolve(fileTimeFolderPath, fileName);
  return filePath;
}
