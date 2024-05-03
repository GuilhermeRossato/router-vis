import { getIntervalStringFromSeconds } from "../utils/intervalStringTranslation.js";

export function parseWlanAssociatedList(varName, content) {
  const state = {};
  const entries = content
    .replace(/\'/g, "")
    .split("/")
    .map((v) => v.split(","));
  for (const list of entries) {
    if (entries.length === 1 && (list.length === 0 || list[0] === "")) {
      continue;
    }
    const mac = list[0].toUpperCase();
    const seconds = parseInt(list[1]);
    const interval = getIntervalStringFromSeconds(seconds);
    const extra = list.slice(2);
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][mac] = { seconds, interval, extra };
  }
  return state;
}
