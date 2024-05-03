export function parseMacList(varName, content) {
  const state = {};
  const entries = content
    .replace(/\'/g, "")
    .replace(/\"/g, "")
    .split("|")
    .filter((a) => a.trim().length)
    .map((e) => e.split(","));
  for (const list of entries) {
    const mac = list[1].toUpperCase();
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][mac] = list[0];
  }
  return state;
}
