import { listVarDataFileTimes } from "../storage/varFileStorage.js";

/**
 * @typedef {{
 *    filePath: string;
 *    modifiedTime: number;
 *    interfaceName: 'eth' | 'wlan' | string;
 *    interfaceIndex: number;
 *    time: number;
 *    recvKb: number;
 *    sentKb: number;
 *    prevTime?: number,
 *    prevRecvKb?: number,
 *    prevSentKb?: number,
 *    nextTime?: number,
 *    nextRecvKb?: number,
 *    nextSentKb?: number,
 * }} TimeUsageEntry
 */

/**
 * @typedef {{
 *    file: any;
 *    interfaceName: "wlan" | "eth";
 *    variableName: string;
 *    fileTime: string;
 *    filePath: string;
 *    stat: import('node:fs').Stats;
 *    fromTime: number;
 *    toTime: number;
 *    isCurrent: boolean;
 * }} TimeFileFilterInput
 */

/**
 * @param {(array: TimeFileFilterInput[]) => TimeFileFilterInput[]} [selectFileFunc]
 */

export async function loadUsageTimeRecordEntries(selectFileFunc = (list) => list) {
  const nowTime = new Date().getTime();
  /** @type {TimeFileFilterInput[]} */
  const candidates = [];
  for (const interfaceName of ["eth", "wlan"]) {
    const variableName = interfaceName + "-intf-sts";
    const fileTimeList = await listVarDataFileTimes(
      "statistics",
      "objects",
      variableName
    );
    for (let i = 0; i < fileTimeList.length; i++) {
      const file = fileTimeList[i];
      candidates.push({
        file,
        interfaceName: interfaceName === "wlan" ? "wlan" : "eth",
        variableName,
        fileTime: file.id,
        filePath: file.path,
        stat: file.stat,
        fromTime: file.from,
        toTime: file.to,
        isCurrent: file.from >= nowTime && file.to < nowTime,
      });
    }
  }
  const fileList = selectFileFunc ? selectFileFunc(candidates) : candidates;
  if (!(fileList instanceof Array)) {
    throw new Error(
      `Select function returned an invalid value: ${JSON.stringify(fileList)}`
    );
  }
  /** @type {{[time: string]: TimeUsageEntry[]}} */
  const timeRecord = {};
  for (const file of fileList) {
    if (file === undefined) {
      continue;
    }
    const data = await file.file.load();
    for (const update of data.list) {
      const time = update.time;
      for (const interfaceName in update.value) {
        const [recv, sent] = ["recv", "sent"].map((direction) => BigInt(update.value[interfaceName][direction][1])
        );
        const [recvKb, sentKb] = [recv, sent].map(
          (l) => Number(l / BigInt(8)) / 32
        );
        const timeStr = (Math.floor(time / 1000) * 1000).toString();
        if (!timeRecord[timeStr]) {
          timeRecord[timeStr] = [];
        }
        timeRecord[timeStr].push({
          filePath: file.filePath,
          modifiedTime: data.mtime.getTime(),
          interfaceName: interfaceName[0] === "e" ? "eth" : "wlan",
          interfaceIndex: parseInt(interfaceName.replace(/\D/g, "")),
          time,
          recvKb,
          sentKb,
        });
      }
    }
  }
  // Populate previous and next values
  const timeList = Object.keys(timeRecord)
    .map((a) => Number(a))
    .sort();
  for (let i = 0; i < timeList.length; i++) {
    const [prevList, nowList, nextList] = [i - 1, i, i + 1].map(
      (i) => timeRecord[timeList[i]]
    );
    for (const entry of nowList) {
      const prev = prevList?.find(
        (e) => e.interfaceName === entry.interfaceName &&
          e.interfaceIndex === entry.interfaceIndex
      );
      if (prev && prev.time) {
        entry.prevTime = prev.time;
        entry.prevRecvKb = prev.recvKb;
        entry.prevSentKb = prev.sentKb;
      }
      const next = nextList?.find(
        (e) => e.interfaceName === entry.interfaceName &&
          e.interfaceIndex === entry.interfaceIndex
      );
      if (next && next.time) {
        entry.nextTime = next.time;
        entry.nextRecvKb = next.recvKb;
        entry.nextSentKb = next.sentKb;
      }
    }
  }
  return timeRecord;
}


