export function parseOrgLanHostList(varName, content) {
  const state = {};
  const entries = JSON.parse(
    content.substring(1, content.length - 1).replace(/\'/g, '"')
  );
  for (const list of entries) {
    const name = list[1];
    const ip = list[3];
    const src = list[4];
    const mac = list[6].toUpperCase();
    const extra = list.filter((_, i) => ![1, 3, 4, 6].includes(i)).join(' ');
    if (!state[varName]) {
      state[varName] = {};
    }
    state[varName][mac] = { name, ip, src, extra };
  }
  return state;
}
