import sleep from "../utils/sleep.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { loadLatestTimeRecordEntries } from "./loadLatestTimeRecordEntries.js";
import { getUsageEntryDisplayTextParts } from "../vis/getUsageEntryDisplayTextParts.js";
import { getSpeedRecordFromTimeRecord } from "../vis/getSpeedRecordFromTimeRecord.js";

const debug = false;

export function getUsageEntriesFromTimeRecord(timeRecord) {
  const list = Object.keys(timeRecord)
    .map((time) => timeRecord[time])
    .flat();
  for (const entry of list) {
    if (!entry.time) {
      throw new Error("Entry is missing time: " + JSON.stringify(entry));
    }
  }
  return list;
}

export async function streamUsageVariableState(streamType, isMegaByte = false) {
  let cursor = new Date().getTime() - 15 * 60 * 1000;
  let remaining = [];
  let lastDatePrinted = "";
  const columnSizes = [];
  await sleep(200);
  for (let count = 0; count < 999999; count++) {
    await sleep(100);
    if (remaining.length === 0) {
      const timeRec = await loadLatestTimeRecordEntries(count === 0 ? 3 : 2);
      debug && console.log("[D] Time Rec Length:", Object.keys(timeRec).length);
      const newList = streamType === "usage"
        ? getUsageEntriesFromTimeRecord(timeRec)
        : getSpeedRecordFromTimeRecord(timeRec);
      debug && console.log("[D] List Length:", newList.length);
      if (!(newList instanceof Array) || (newList[0] && !newList[0].time)) {
        throw new Error("Retrieved entries");
      }
      remaining = newList.sort((a, b) => a.time - b.time).filter((e) => e?.time > cursor);
      debug && console.log("[D] Remaining Length:", remaining.length);
      if (remaining.length === 0) {
        await sleep(2000);
      }
      continue;
    }
    const surrounding = remaining.filter(
      (e) => Math.abs(e.time - remaining[0].time) < 2000
    );
    let dateToPrint = getDateTimeString(surrounding[0].time).substring(0, 19);
    if (lastDatePrinted.substring(0, 10) === dateToPrint.substring(0, 10)) {
      dateToPrint = " ".repeat(10) + dateToPrint.substring(10);
      lastDatePrinted = lastDatePrinted.substring(
        0,
        lastDatePrinted.length - 1
      );
    } else {
      lastDatePrinted = dateToPrint;
    }
    const linePrefix = `${streamType[0]} ${dateToPrint} `;
    process.stdout.write(linePrefix);
    for (const entry of surrounding) {
      const parts = getUsageEntryDisplayTextParts(entry, isMegaByte)
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const raw = (part.prefix || "") + part.text + (part.sufix || "");
        const size = part.size && part.size > raw.length ? part.size : raw.length;
        if (!columnSizes[i] || columnSizes[i] < size) {
          columnSizes[i] = size;
        }
      }
      let i = dateToPrint.length + 1;
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        const raw = (part.prefix || "") + part.text + (part.sufix || "");
        let t = [
          part.prefix || "",
          part.green ? "\x1b[32m" : "",
          part.yellow ? "\x1b[33m" : "",
          part.text.toString(),
          part.green || part.yellow ? "\x1b[0m" : "",
          part.sufix || "",
        ].join("");
        const missing = columnSizes[j] - raw.length;
        if (missing > 0) {
          const left = part.leftPad ? missing : Math.floor(missing / 2);
          const right = missing - left;
          t = " ".repeat(left) + t + " ".repeat(right);
        }
        const overflow = i + t.length + 1 > process.stdout.columns;
        if (overflow) {
          t = t.substring(0, process.stdout.columns - t.length - i);
        }
        process.stdout.write(t + " ");
        i += t.length + 1;
        if (overflow) {
          break;
        }
      }
      process.stdout.write(" ");
    }
    process.stdout.write("\n");
    cursor = Math.max(...surrounding.map((e) => e.time));
    remaining = remaining.filter((e) => e.time > cursor);
    const isCursorAtPresent = cursor >= new Date().getTime() - 10000;
    if (isCursorAtPresent) {
      await sleep(5000);
    }
  }
}


