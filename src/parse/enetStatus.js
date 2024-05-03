export function enetStatus(varName, content) {
  const state = {};
  const entries = content
    .split(".")[0]
    .replace(/\'/g, "")
    .replace(/\"/g, "")
    .split("|")
    .filter((a) => a.trim().length)
    .map((a) => a.trim().split(","));
  for (const list of entries) {
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][list[0]] = list.slice(1).join(" ");
  }
  return state;
}
