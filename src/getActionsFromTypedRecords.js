import fs from "fs";
import { ignoredKeyList } from "./data/constants.js";
import getUpdatesFromObjectRecordPair from "./data/getUpdatesFromRecordPair.js";
import { getVarDataFilePath } from "./data/varFileStorage.js";
import asyncTryCatchNull from "./utils/asyncTryCatchNull.js";
import getDateTimeString from "./utils/getDateTimeString.js";

/**
 *    @param {Record<string, any>} rec
 *    @param {Record<string, any>} newRec
 *    @param {string} stageName
 *    @param {string} recordType
 *    @param {any} filterFunc
 *    @param {any} separateFunc
 */
export async function getActionsFromTypedRecords(
  rec,
  newRec,
  stageName,
  recordType,
  filterFunc,
  separateFunc
) {
  const [oldTypedRec, newTypedRec] = [rec, newRec].map((rec) => {
    const keys = Object.keys(rec).filter(
      (key) => !ignoredKeyList.includes(key) && filterFunc(rec, key)
    );
    const entries = keys.map((key) => [key, rec[key]]);
    const filtered = Object.fromEntries(entries);
    filtered.time = rec && rec.time ? rec.time : null;
    return filtered;
  });
  const updateList = await getUpdatesFromObjectRecordPair(
    oldTypedRec,
    newTypedRec,
    separateFunc,
    stageName
  );
  /**
   * @type {{type: 'filler-file' | 'create-file' | 'update-file'; varName: string; stageName: string; recordType: string; filePath: string; update: UpdateEntry}[]}
   */
  const actionList = [];
  for (const varName in newTypedRec) {
    if (ignoredKeyList.includes(varName)) {
      continue;
    }
    const filePath = getVarDataFilePath(
      stageName,
      recordType,
      varName,
      newTypedRec.time
    );
    const stat = await asyncTryCatchNull(fs.promises.stat(filePath));
    const existingUpdate = updateList.find((u) => u.varName === varName);
    if (existingUpdate) {
      actionList.push({
        type: !stat || stat instanceof Error ? "create-file" : "update-file",
        varName,
        stageName,
        recordType,
        update: existingUpdate,
        filePath,
      });
      continue;
    }
    // @ts-ignore
    if (stat?.size) {
      continue;
    }
    const dateStr = getDateTimeString(newTypedRec.time).substring(0, 19);
    const startDateStr =
      dateStr.substring(0, "2024-05-16 10".length) + ":00:00 -03:00";
    actionList.push({
      type: "filler-file",
      varName,
      stageName,
      recordType,
      update: {
        varName,
        time: new Date(startDateStr).getTime(),
        type: "maintained",
        value: newTypedRec[varName],
      },
      filePath,
    });
  }
  return actionList;
}
