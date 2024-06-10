import getDateTimeString from "../utils/getDateTimeString.js";

/**
 * @param {{
 *    time: number,
 *    type: string,
 *    name: string,
 *    varName: string,
 *    src: string,
 *    value: {[interfaceName: string]: {recv: string[], sent: string[]}},
 *    lastTime?: number,
 *    lastValue?: any
 * }[]} updates
 */
export function getUsageEntriesFromUpdates(updates) {
  /**
   * @type {{
   *  [timeKey: string]: {
   *    name: string,
   *    index: number,
   *    timeKey: string,
   *    currRecv: number[],
   *    currSent: number[],
   *    currTime: number,
   *    diffRecv: number[],
   *    diffSent: number[],
   *    diffTime: number,
   *    lastRecv: number[],
   *    lastSent: number[],
   *    lastTime: number
   *  }[]
   * }}
   */
  const usageRecord = {};
  for (let i = 0; i < updates.length; i++) {
    const varName = updates[i].varName;
    let value = updates[i].value;
    let lastValue = updates[i].lastValue;
    let currTime = updates[i].time;
    let lastTime = updates[i].lastTime || 0;

    if (updates[i].lastTime && updates[i].lastTime > currTime) {
      if (i <= 1) {
        continue;
      }
      const near = updates.filter(
        (u, j) =>
          u.varName === varName &&
          i !== j &&
          Math.abs(u.time - currTime) < 120_000 &&
          u.time < currTime,
      );
      const sorted = near.sort((a, b) => a.time - currTime - (b.time - currTime));
      const prev = sorted.pop();
      const dateStr = getDateTimeString(updates[i].time);
      if (prev && currTime > prev.time) {
        console.log(
          `[Fixed] Replaced "${updates[i].varName}" at ${dateStr} (${currTime}) last time from ${lastTime} to ${prev.time}`,
        );
        lastTime = prev.time;
        lastValue = prev.value;
      } else {
        const lastDateStr = getDateTimeString(updates[i].lastTime);
        console.log(
          `[Warning] Var time of "${updates[i].varName}" at (${dateStr}, time: ${currTime}) is before previous: ${lastDateStr}`,
        );
        continue;
      }
    }
    for (const key in value) {
      const usage = {
        name: key.replace(/\d/g, ""),
        index: parseInt(key.replace(/\D/g, "")),
        timeKey: Math.floor(currTime / 30000).toString(),
        currRecv: [],
        currSent: [],
        currTime: currTime,
        diffRecv: [],
        diffSent: [],
        diffTime: lastTime ? currTime - lastTime : 0,
        lastRecv: [],
        lastSent: [],
        lastTime: lastTime,
      };
      const currRec = value[key];

      const lastRec = lastValue ? lastValue[key] : {};
      for (const dir of ["recv", "sent"]) {
        const list = [
          currRec[dir][1],
          lastRec && lastRec[dir] && lastRec[dir][1] ? lastRec[dir][1] : "0",
        ];
        const bytes = list.map((v) => BigInt(v));
        const kb = bytes.map((v) => Number(v / BigInt(32)) / 32);
        const mb = bytes.map((v) => Number(v / BigInt(4 * 1024)) / (1024 / 4));
        const gb = bytes.map((v) => Number(v / BigInt(1024 * 1024)) / 1024);
        const curr = [kb[0], mb[0], gb[0]];
        usage[dir === "recv" ? "currRecv" : "currSent"] = curr;
        const last = [kb[1], mb[1], gb[1]];
        usage[dir === "recv" ? "lastRecv" : "lastSent"] = last;
        const diff = last.map((_, i) => (last[i] ? curr[i] - last[i] : 0));
        usage[dir === "recv" ? "diffRecv" : "diffSent"] = diff;
      }
      if (!usageRecord[usage.timeKey]) {
        usageRecord[usage.timeKey] = [];
      }
      usageRecord[usage.timeKey].push(usage);
    }
  }
  const timeKeyList = Object.keys(usageRecord)
    .map((k) => parseInt(k))
    .sort();
  return timeKeyList.map((k) => usageRecord[k]);
}
