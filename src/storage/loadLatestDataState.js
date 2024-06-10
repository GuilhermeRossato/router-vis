import getDateTimeString from "../utils/getDateTimeString.js";
import { getVarFolderName } from "./getVarFileDataPath.js";
import {
  readRootTextFile} from "./rootTextFileStorage.js";

export async function loadLatestDataState(stateKey = 'unknown') {
  const text = await readRootTextFile(`latest-${stateKey}.json`);
  if (!text || text[0] !== "{") {
    return null;
  }
  let rec;
  try {
    rec = JSON.parse(text);
    if (!rec || (!rec.time && !rec.date)) {
      throw new Error('Invalid latest data state');
    }
  } catch (err) {
    console.warn(`Warning: ${err.message}`);
    return null;
  }
  if (!rec.time && rec.date) {
    const date = new Date(getDateTimeString(rec.date, true));
    rec.time = date.getTime();
  }
  if (rec.time && !rec.date) {
    rec.date = getDateTimeString(new Date(rec.time));
  }
  return rec;
}
