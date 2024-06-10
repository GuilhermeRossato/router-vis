import sleep from "../utils/sleep.js";
import { getNumericDisplayTextParts } from "../vis/getNumericDisplayTextParts.js";
import { listVarDataFiles } from "../storage/listVarDataFiles.js";
import { streamDatedLine } from "../vis/streamDatedLine.js";
import { getUsageEntriesFromUpdates } from "./getUsageEntriesFromUpdates.js";
import { getFullAndRawDisplayTextParts } from "../vis/getFullAndRawDisplayTextParts.js";

export async function streamUsageVariableState(streamType = "usage", unit = "M") {
  /** @type {ReturnType<getUsageEntriesFromUpdates>} */
  let remaining = [];
  let cursor = 0;
  let order = [];
  const streamPrefix = `[${streamType[0].toUpperCase()}]`;
  const isTotalStream = streamType === "usage";

  for (let cycle = 0; true; cycle++) {
    if (remaining.length === 0) {
      let updates = [];
      await sleep(cycle === 0 ? 100 : 1000);
      for (const name of ["eth-intf-sts", "wlan-intf-sts"]) {
        const files = await listVarDataFiles("statistics", "object", name);
        const latest = files.slice(files.length - (cycle === 0 ? 2 : 1));
        for (let i = 0; i < latest.length; i++) {
          const data = await latest[i].load();
          for (const entry of data.entries) {
            entry["varName"] = latest[i].varName;
            updates.push(entry);
          }
        }
        await sleep(100);
      }
      if (updates.length === 0) {
        await sleep(1000);
        continue;
      }
      if (cursor) {
        updates = updates.filter((r) => r.time > cursor);
      } else {
        updates = updates.slice(Math.max(0, updates.length - 1024));
      }
      remaining = getUsageEntriesFromUpdates(updates);
      if (remaining.length === 0) {
        await sleep(1000);
        continue;
      }
      continue;
    }
    const usageList = remaining.shift();
    if (usageList.length === 0) {
      continue;
    }
    const partListList = usageList.map((usage, lineIndex) => {
      const recvList = isTotalStream ? usage.currRecv : usage.diffRecv;
      const sentList = isTotalStream ? usage.currSent : usage.diffSent;
      const i = unit === "K" ? 0 : unit === "G" ? 2 : 1;
      const recvValue = recvList[i] || 0;
      const sentValue = sentList[i] || 0;
      const parts = getNumericDisplayTextParts(
        lineIndex,
        usage.name,
        usage.index,
        recvValue,
        sentValue,
        !isTotalStream,
        unit,
      );
      return getFullAndRawDisplayTextParts(parts);
    });
    if (order.length === 0) {
      order = usageList.map((usage) => `${usage.name}-${usage.index}`);
    }
    const width = Math.max(70, process.stdout?.columns || 70);
    const limit = width - 24 - 5 - 1;
    let size = 0;
    const textParts = [];
    for (const partList of partListList) {
      if (size + 1 >= limit) {
        break;
      }
      for (const part of partList) {
        if (size + part.raw.length + 1 >= limit) {
          size = limit;
          break;
        }
        size += part.raw.length;
        textParts.push(part.full);
      }
      textParts.push(" ");
    }
    const text = textParts.join("");
    streamDatedLine(streamPrefix, usageList[0].currTime, text);
    cursor = usageList[0].currTime;
  }
}
