import getDateTimeString from "../utils/getDateTimeString.js";
import { isValidStateRecord } from "./isValidStateRecord.js";
import separateUpdatedObjectKeys from "./separateUpdatedObjectKeys.js";
import separateUpdatedValueKeys from "./separateUpdatedValueKeys.js";

export default function getUpdatesFromRecordPair(oldRec, newRec, varSrc) {
  /** @type {UpdateEntry[]} */
  const updateList = [];
  if (!isValidStateRecord(newRec)) {
    throw new Error("New record is invaild");
  }
  if (oldRec && (!oldRec["time"] || typeof newRec["time"] !== "number")) {
    console.debug("Warning: Previous record exist but is missing time");
  }
  const newLength = Object.keys(newRec).length;
  if (newRec && newLength <= 5) {
    console.debug("Warning: Unusually small new record:", newRec);
  }
  const oldLength = oldRec ? Object.keys(oldRec).length : 0;
  if (oldRec && newLength > 5 && oldLength <= 5) {
    console.debug("Warning: Unusually small old record size:", oldRec);
  } else if (oldRec && Math.abs(newLength - oldLength) > 20) {
    console.debug(
      `Warning: Unusually large difference between old record key count (${oldLength}) and new (${newLength})`
    );
  }
  const separated = separateUpdatedKeys(
    oldRec,
    newRec
  );
  for (const varType in separated) {
    for (const type of ['created', 'updated', 'removed']) {
      const keyList = separated[varType][type + 'Keys'];
      for (const varName of keyList) {
        if (updateList.find((a) => a.varName === varName)) {
          throw new Error(`Duplicated update on "${varName}" (at ${type})`);
        }
        updateList.push({
          type: type[0] === 'c' ? 'created' : type[0] === 'r' ? 'removed' : 'updated',
          varName,
          varType: varType === 'object' ? 'object' : varType === 'array' ? 'array' : 'value',
          time: newRec["time"],
          value: newRec[varName],
          lastTime: oldRec ? oldRec["time"] : undefined,
          lastValue: oldRec ? oldRec[varName] : undefined,
          fileName: getDateTimeString(newRec['time']).substring(0, 13).replace(' ', '-') + '.csv',
          varSrc,
        });
      }
    }
  }
  return updateList;
}

function separateUpdatedKeys(oldRec, newRec) {
  const varTypeRecord = {
    object: {
      removedKeys: [],
      createdKeys: [],
      updatedKeys: [],
    },
    array: {
      removedKeys: [],
      createdKeys: [],
      updatedKeys: [],
    },
    value: {
      removedKeys: [],
      createdKeys: [],
      updatedKeys: [],
    },
  };
  for (const varType in varTypeRecord) {
    const [filteredOld, filteredNew] = [oldRec, newRec].map((rec) => {
      const updated = Object.fromEntries(Object.entries(rec).filter(([key, value]) => {
        if (value === null || value === undefined) {
          return false;
        }
        if (varType === 'array' && typeof key === 'object' && value instanceof Array) {
          return true;
        }
        if (typeof value === key) {
          return true;
        }
        return false;
      }));
      return updated;
    });
    let separated;
    if (varType === 'value') {
      separated = separateUpdatedValueKeys(filteredOld, filteredNew);
    } else {
      separated = separateUpdatedObjectKeys(filteredOld, filteredNew);
    }
    for (const keyListName in varTypeRecord[varType]) {
      for (const key of separated[varType]) {
        if (!varTypeRecord[varType][keyListName].includes(key)) {
          varTypeRecord[varType][keyListName].push(key)
        }
      }
    }
  }
  return varTypeRecord;
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
