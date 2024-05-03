import { getIntervalStringFromSeconds } from "../utils/intervalStringTranslation.js";

export function parseLanHostList(varName, content) {
  const state = {};
  const text = content.replace(/\'/g, "");
  const entries = text.length <= 4 ? [] : text.split("|").map((entry) => entry.split("/"));
  for (const list of entries) {
    const name = list[1];
    const mac = list[2].toUpperCase();
    const ip = list[3];
    const seconds = parseInt(list[4] || "0");
    const interval = getIntervalStringFromSeconds(seconds);
    const extra = list.filter((_, i) => ![1, 2, 3, 4].includes(i));
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][mac] = { name, ip, seconds, interval, extra };
  }
  return state;
}
