import { getSecondsFromIntervalString, getIntervalStringFromSeconds } from "../utils/intervalStringTranslation.js";

export function parseStaList(varName, content) {
  const state = {};
  const entries = content
    .replace(/\'/g, "")
    .replace(/\"/g, "")
    .split("/")
    .filter((a) => a.trim().length)
    .map((e) => e.split(","));
  for (const list of entries) {
    if (list.length !== 2) {
      throw new Error(`Unexpected length ${list.length}`);
    }
    const mac = list[0].toUpperCase();
    const time = list[1].toUpperCase();
    const isTimeSeconds = time.length && !time.includes(":");

    const seconds = isTimeSeconds
      ? parseInt(time)
      : getSecondsFromIntervalString(time);
    const interval = getIntervalStringFromSeconds(seconds);
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][mac] = { seconds, interval };
  }
  return state;
}
