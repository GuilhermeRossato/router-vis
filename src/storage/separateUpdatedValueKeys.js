import { ignoredKeyList } from "./constants.js";

export default function separateUpdatedValueKeys(oldRec, newRec) {
  const removedKeys = [];
  if (oldRec) {
    for (const varName in oldRec) {
      if (ignoredKeyList.includes(varName)) {
        continue;
      }
      if (newRec[varName] !== undefined && newRec[varName] !== null) {
        continue;
      }
      removedKeys.push(varName);
    }
  }
  const sameKeys = [];
  if (oldRec) {
    for (const varName in oldRec) {
      if (ignoredKeyList.includes(varName)) {
        continue;
      }
      if (removedKeys.includes(varName)) {
        continue;
      }
      if (newRec[varName] !== oldRec[varName]) {
        continue;
      }
      sameKeys.push(varName);
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
    if (sameKeys.includes(varName)) {
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
    if (removedKeys.includes(varName) ||
      sameKeys.includes(varName) ||
      createdKeys.includes(varName)) {
      continue;
    }
    if (newRec[varName] && typeof newRec[varName] === "object") {
      continue;
    }
    updatedKeys.push(varName);
  }
  // console.debug({ removedKeys, sameKeys, createdKeys, updatedKeys });
  return { removedKeys, sameKeys, createdKeys, updatedKeys };
}
