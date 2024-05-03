export function parseIntfSts(varName, content) {
  const state = {};
  const entries = content
    .replace(/\'/g, "")
    .split("/")
    .map((e) => e.split(","));
  for (const list of entries) {
    if (list[1] === "0" && list[2] === "0" && list[3] === "0") {
      continue;
    }
    const name = list[0];
    if (!state[varName]) {
      state[varName] = {};
    }
    // Include everything: Byte, Packets, Errors, and Failures
    state[varName][name] = {
      recv: list.slice(1, 5),
      sent: list.slice(5, 9),
    };
  }
  return state;
}