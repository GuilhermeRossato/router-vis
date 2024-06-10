import { ignoredKeyList } from "./ignoredKeyList.js";

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
  const unchangedKeys = [];
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
      unchangedKeys.includes(varName) ||
      createdKeys.includes(varName)) {
      continue;
    }
    if (newRec[varName] && typeof newRec[varName] === "object") {
      continue;
    }
    updatedKeys.push(varName);
  }
  return { removedKeys, unchangedKeys, createdKeys, updatedKeys };
}
