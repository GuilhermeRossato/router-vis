import {
  readRootTextFile,
  saveRootTextFile
} from "./rootTextFileStorage.js";

export async function saveLatestDataState(dataStateKey = "status-values", rec) {
  const date = new Date(rec.date ? (rec.date + (rec.date.includes('Z') ? '' : ' -03:00')) : rec.time);
  if (!rec.time) {
    rec.time = date.getTime();
  }
  if (!rec || (!rec.time && !rec.date)) {
    throw new Error('Invalid latest data state');
  }
  await saveRootTextFile(
    `latest-${dataStateKey}.json`,
    JSON.stringify(
      rec,
      null,
      "  "
    )
  );
}

export async function loadLatestDataState(dataStateKey = "statistic-values") {
  const text = await readRootTextFile(`latest-${dataStateKey}.json`);
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
  const date = new Date(rec.date ? (rec.date + (rec.date.includes('Z') ? '' : ' -03:00')) : rec.time);
  if (!rec.time) {
    rec.time = date.getTime();
  }
  return rec;
}
