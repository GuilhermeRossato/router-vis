import { ignoredKeyList } from "./constants.js";

export default function separateUpdatedObjectKeys(oldRec, newRec) {
  const removedKeys = [];
  if (oldRec) {
    for (const varName in oldRec) {
      if (ignoredKeyList.includes(varName)) {
        continue;
      }
      if ((oldRec[varName] === undefined || oldRec[varName] === null) && oldRec[varName] === newRec[varName]) {
        continue; // same null
      }
      if (newRec[varName] !== undefined && newRec[varName] !== null) {
        continue;
      }
      removedKeys.push(varName);
    }
  }
  const unchangedKeys = [];
  if (oldRec) {
    for (const varName in oldRec) {
      if (ignoredKeyList.includes(varName)) {
        continue;
      }
      if (typeof oldRec[varName] !== "object") {
        continue;
      }
      if (removedKeys.includes(varName)) {
        continue;
      }
      if (['wlanIntfSts', 'ethIntfSts'].includes(varName)) {
        continue;
      }
      const matchinNull = (newRec[varName] === undefined && oldRec[varName] === null) || (newRec[varName] === null && oldRec[varName] === undefined);
      if (!matchinNull && (newRec[varName] !== oldRec[varName])) {
        continue;
      }
      unchangedKeys.push(varName);
    }
  }
  const createdKeys = [];
  for (const varName in newRec) {
    if (ignoredKeyList.includes(varName)) {
      continue;
    }
    if (removedKeys.includes(varName)) {
      continue;
    }
    if (unchangedKeys.includes(varName)) {
      continue;
    }
    if (typeof newRec[varName] !== "object") {
      continue;
    }
    if (!oldRec || oldRec[varName] === undefined) {
      createdKeys.push(varName);
    }
  }
  const updatedKeys = [];
  for (const varName in newRec) {
    if (ignoredKeyList.includes(varName)) {
      continue;
    }
    if (typeof newRec[varName] !== "object") {
      continue;
    }
    if (removedKeys.includes(varName)) {
      continue;
    }
    if (unchangedKeys.includes(varName)) {
      continue;
    }
    if (createdKeys.includes(varName)) {
      continue;
    }
    updatedKeys.push(varName);
  }
  // console.debug({ removedKeys, sameKeys, createdKeys, updatedKeys });
  return { removedKeys, createdKeys, updatedKeys, unchangedKeys };
}
