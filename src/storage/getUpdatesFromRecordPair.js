import getDateTimeString from "../utils/getDateTimeString.js";
import { ignoredKeyList } from "./ignoredKeyList.js";
import separateUpdatedObjectKeys from "./separateUpdatedObjectKeys.js";
import separateUpdatedValueKeys from "./separateUpdatedValueKeys.js";

export default function getUpdatesFromRecordPair(oldRec, newRec, varSrc) {
  /** @type {UpdateEntry[]} */
  const updateList = [];
  if (!newRec || !newRec.time) {
    throw new Error(
      `Key list from new record does not have valid time: ${JSON.stringify(
        Object.keys(newRec ? newRec : {}),
      )}`,
    );
  }
  if (oldRec && (!oldRec["time"] || typeof newRec["time"] !== "number")) {
    console.debug("Warning: Previous record exist but is missing time");
  }
  if (typeof varSrc !== "string") {
    throw new Error("Invalid source");
  }
  const newLength = Object.keys(newRec).length;
  const oldLength = oldRec ? Object.keys(oldRec).length : 0;
  if (newRec && newLength <= 5) {
    console.log("Warning: Unusually small new record with only", newLength, "keys");
    console.debug("New keys", Object.keys(newRec));
  }
  if (oldRec && oldLength <= 5) {
    console.log("Warning: Unusually small old record with only", oldLength, "keys");
    console.debug("Old keys", Object.keys(oldLength));
  }
  if (oldRec && oldLength - 10 > newLength) {
    console.debug(
      "Warning: Old record has",
      oldLength - newLength,
      "more keys than new record (with",
      newLength,
      "keys)",
    );
  }
  const separated = separateUpdatedKeys(oldRec, newRec);
  for (const varType in separated) {
    for (const typeKey in separated[varType]) {
      const type = typeKey.replace("Keys", "");
      const keyList = separated[varType][typeKey];
      if (type === "unchanged" || keyList === "unchangedKeys") {
        continue;
      }
      for (const varName of keyList) {
        if (updateList.find((a) => a.varName === varName)) {
          throw new Error(`Duplicated update on "${varName}" (at ${type})`);
        }
        updateList.push({
          updateType:
            type[0] === "c"
              ? "created"
              : type[0] === "r"
              ? "removed"
              : type[0] === "u" && type[1] === "p"
              ? "updated"
              : "unchanged",
          varName,
          varType: varType[0] === "o" ? "object" : varType[0] === "a" ? "array" : "value",
          varSrc,
          time: newRec["time"],
          value: newRec[varName],
          lastTime: oldRec ? oldRec["time"] : undefined,
          lastValue: oldRec ? oldRec[varName] : undefined,
          fileName: getDateTimeString(newRec["time"]).substring(0, 13).replace(" ", "-") + ".csv",
        });
      }
    }
  }
  return updateList;
}

function getVarType(name, val) {
  if (typeof val === "object" && val instanceof Array) {
    console.log(name);
    return "array";
  }
  if (typeof val === "object" && (val !== null && val !== undefined)) {
    return "object";
  }
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return "value";
  }
  if (name.toLowerCase().includes('intf')) {
    return 'object';
  }
  if (name.toLowerCase().includes('list')) {
    return 'object';
  }
  return "";
}

function separateUpdatedKeys(oldRec, newRec) {
  /** @type {Record<string, 'object' | 'array' | 'value'>} */
  const varTypeRecord = {};
  Object.entries(newRec).forEach(([key, val]) => {
    if (val === null || val === undefined || varTypeRecord[key] || ignoredKeyList.includes(key)) {
      return;
    }
    const varType = getVarType(key, val);
    if (!varType) {
      return;
    }
    varTypeRecord[key] = varType;
  });
  const uniqueVarTypeList = [...new Set(Object.values(varTypeRecord))];
  /** @type {{[varType: string]: {removedKeys: string[], createdKeys: string[], updatedKeys: string[], unchangedKeys: string[]}}} */
  const typeSeparatedKeys = {};
  for (const varType of uniqueVarTypeList) {
    if (!typeSeparatedKeys[varType]) {
      typeSeparatedKeys[varType] = {
        removedKeys: [],
        createdKeys: [],
        updatedKeys: [],
        unchangedKeys: [],
      };
    }
    const [fOld, fNew] = [oldRec, newRec].map((rec) =>
      Object.fromEntries(
        Object.entries(rec).filter(
          ([key, value]) => value !== null && value !== undefined && varTypeRecord[key] === varType,
        ),
      ),
    );
    let separated;
    if (varType === "value") {
      separated = separateUpdatedValueKeys(fOld, fNew);
    } else if (varType === "array") {
      separated = separateUpdatedObjectKeys(fOld, fNew);
    } else {
      separated = separateUpdatedObjectKeys(fOld, fNew);
    }
    for (const key of separated.createdKeys) {
      typeSeparatedKeys[varType].createdKeys.push(key);
    }
    for (const key of separated.updatedKeys) {
      typeSeparatedKeys[varType].updatedKeys.push(key);
    }
    for (const key of separated.removedKeys) {
      typeSeparatedKeys[varType].removedKeys.push(key);
    }
    for (const key of separated.unchangedKeys) {
      typeSeparatedKeys[varType].unchangedKeys.push(key);
    }
  }
  return typeSeparatedKeys;
}

export function applyUpdateListToRecord(updateList, rec) {
  for (const { type, varName, value } of updateList) {
    if (value === undefined || value === null || (type && type[0] === "r")) {
      delete rec[varName];
      continue;
    }
    rec[varName] = value;
  }
  return rec;
}
