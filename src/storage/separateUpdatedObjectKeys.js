import { ignoredKeyList } from "./ignoredKeyList.js";

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
      if (matchinNull) {
        continue;
      }
      const oldObj = oldRec ? oldRec[varName] : {};
      const newObj = newRec ? newRec[varName] : {};
      const oldKeys = Object.keys(oldObj).sort();
      const newKeys = Object.keys(newObj).sort();
      let isDifferent = oldKeys.length !== newKeys.length;
      for (let i = 0; i < newKeys.length && !isDifferent; i++) {
        const key = newKeys[i];
        // console.log('key', i, key, typeof newObj[key], typeof newObj[key]);
        // console.log(`key !== oldKeys[i]`, key !== oldKeys[i]);
        if (key !== oldKeys[i]) {
          isDifferent = true;
          break;
        }
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        if ((!oldVal && newVal) || (oldVal && !newVal)) {
          isDifferent = true;
          break;
        }
        if (typeof newVal !== typeof oldVal) {
          isDifferent = true;
          break;
        }
        if ((typeof newVal === 'string' || typeof newVal === 'number' || typeof newVal === 'boolean') && newRec[key] !== oldRec[key]) {
          isDifferent = true;
          break;
        }
        if (typeof newVal === 'object' && newVal instanceof Array && (!(oldVal instanceof Array) || newVal.length !== oldVal.length)) {
          isDifferent = true;
          break;
        }
        if (typeof newVal !== 'object') {
          continue;
        }
        const oldJson = JSON.stringify(newVal instanceof Array ? oldVal : {...oldVal, seconds: undefined, interval: undefined});
        const newJson = JSON.stringify(newVal instanceof Array ? newVal : {...newVal, seconds: undefined, interval: undefined});
        // console.log(key, oldJson !== newJson)
        if (oldJson !== newJson) {
          isDifferent = true;
          break;
        }
      }
      if (isDifferent) {
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
  return { removedKeys, createdKeys, updatedKeys, unchangedKeys };
}
