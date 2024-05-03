import getDateTimeString from "../utils/getDateTimeString.js";
import { getIntervalStringFromSeconds } from "../utils/intervalStringTranslation.js";

function createUsageStatisticStates(oldRec, newRec, state = {}) {
  // Usage
  const speedKeyList = ["ethIntfSts", "wlanIntfSts"];
    for (const vName of speedKeyList) {
      if (!newRec[vName]) {
        continue;
      }
      if (!state["usage"]) {
        state["usage"] = {};
      }
      for (const interfaceName in newRec[vName]) {
        for (const dName of ["recv", "sent"]) {
          const oldList = oldRec[vName] && oldRec[vName][interfaceName] ? oldRec[vName][interfaceName][dName] : newRec[vName][interfaceName][dName];
          const newList = newRec[vName][interfaceName][dName];
          const oldBytes = BigInt(oldList[1]);
          const newBytes = BigInt(newList[1]);
          const oldKb = Number(BigInt(oldBytes) / BigInt(256)) / 4;
          const newKb = Number(BigInt(newBytes) / BigInt(256)) / 4;
          // All
          if (!state["usage"]["all"]) {
            state["usage"]["all"] = {};
          }
          if (!state["usage"]["all"][dName + "Kb"]) {
            state["usage"]["all"][dName + "Kb"] = 0;
          }
          // usage["all"][dName + "Kb"].from.push(oldKb);
          // usage["all"][dName + "Kb"].to.push(newKb);
          state["usage"]["all"][dName + "Kb"] += newKb - oldKb;
          // Interface-specific
          if (!state["usage"][interfaceName]) {
            state["usage"][interfaceName] = {};
          }
          // usage[interfaceName][dName + "OrigOld"] = oldList[1];
          // usage[interfaceName][dName + "OrigNew"] = newList[1];
          state["usage"][interfaceName][dName + "Kb"] = newKb - oldKb;
        }
      }
    }
}

function createTotalStatisticsState(oldRec, newRec, state) {
  if (!state["speed"]) {
    console.log('Could not add total because of missing speed');
    return;
  }
  if (!state["total"]) {
    state["total"] = {};
  }
  for (const key in state["speed"]) {
    for (const dir of ["recv", "sent"]) {
      const speedKbps = state["speed"][key][dir + "Kbps"];
      if (!state["total"][key]) {
        state["total"][key] = {};
      }
      if (!state["total"][key][dir + "Mbps"]) {        
        const hasOldTotalValue = oldRec["total"] &&
        oldRec["total"][key] &&
        oldRec["total"][dir + "Mbps"] &&
        typeof oldRec["total"][dir + "Mbps"] === "number";

        const current =
          hasOldTotalValue
            ? oldRec["total"][dir + "Mbps"]
            : 0;
        state["total"][key][dir + "Mbps"] =
          isNaN(current) || current <= 0 ? 0 : current;
      }
      state["total"][key][dir + "Mbps"] += speedKbps / 1024;
    }
  }
}

function createSpeedStatisticsStates(oldRec, newRec, state) {
  const usage = state['usage'] || newRec['usage'];
  if (!usage) {
    return;
  }
  if (!state["speed"]) {
    state["speed"] = {};
  }
  const elapsedSec = newRec['time'] - oldRec['time'];
  for (const key in state["usage"]) {
    if (key === "period" || typeof state["usage"][key] !== "object") {
      continue;
    }
    for (const dir of ["recv", "sent"]) {
      const v = state["usage"][key][dir + "Kb"];
      const diff =
        typeof v === "object" && typeof v.diff === "number" ? v.diff : v;
      const kbps = elapsedSec < -0.1 || elapsedSec >= 0.1 ? diff / elapsedSec : 0;
      if (!state["speed"]["all"]) {
        state["speed"]["all"] = {};
      }
      if (!state["speed"]["all"][dir + "Kbps"]) {
        state["speed"]["all"][dir + "Kbps"] = 0;
      }
      state["speed"]["all"][dir + "Kbps"] += kbps;
      if (!state["speed"][key]) {
        state["speed"][key] = {};
      }
      state["speed"][key][dir + "Kbps"] = kbps;
    }
  }
}

export default function createStatesFromComparation(oldRec, newRec) {
  if (typeof oldRec !== "object" || oldRec.list instanceof Array) {
    throw new Error("Invalid first state parameter record");
  }
  if (typeof newRec !== "object" || newRec.list instanceof Array) {
    throw new Error("Invalid second state parameter record");
  }
  if (
    typeof newRec["time"] !== "number" ||
    isNaN(newRec["time"]) ||
    typeof oldRec["time"] !== "number" ||
    isNaN(oldRec["time"])
  ) {
    throw new Error("Missing or invalid time at state record");
  }
  const isStatistics = newRec["ethIntfSts"] || newRec["wlanIntfSts"];
  /** @type {Record<string, any>} */
  const state = {};
  const oldTime = oldRec["time"];
  const newTime = newRec["time"];
  const elapsedSec = (newTime - oldTime) / 1000;
  state["extractionPeriod" + (isStatistics ? '2' : '1')] = elapsedSec;
  state["extractionInterval" + (isStatistics ? '2' : '1')] = getIntervalStringFromSeconds(elapsedSec);
  if (newRec["uptime"]) {
    state["uptimeInterval"] = getIntervalStringFromSeconds(newRec["uptime"]);
  }
  if (isStatistics && elapsedSec >= 1 && elapsedSec <= 180_000) {
    createUsageStatisticStates(oldRec, newRec, state);
    if (!state["usage"]) {
      throw new Error('Unexpectedly empty usage');
    }
    createSpeedStatisticsStates(oldRec, newRec, state);
    if (!state["speed"]) {
      throw new Error('Unexpectedly empty speed');
    }
    createTotalStatisticsState(oldRec, newRec, state);
    if (!state["total"]) {
      throw new Error('Unexpectedly empty total');
    }
  }
  
  // Host grouping
  createHostsVars(oldRec, newRec, state, isStatistics);
  return state;
}

function createHostsVars(oldState, newState, state = {}, isStatistics) {
  const knownMac = {};
  if (oldState) {
    for (const key in oldState) {
      if (typeof oldState[key] !== "object") {
        continue;
      }
      for (const mac in oldState[key]) {
        const sample = "00:00:00:00:00:00";
        if (
          mac.length === sample.length &&
          mac.replace(/\:/g, "").length === sample.replace(/\:/g, "").length &&
          mac !== sample &&
          !knownMac[mac]
        ) {
          knownMac[mac] = true;
        }
      }
    }
  }
  for (const key in newState) {
    if (typeof newState[key] !== "object") {
      continue;
    }
    for (const mac in newState[key]) {
      const sample = "00:00:00:00:00:00";
      const hostKey = `hosts${isStatistics ? '2' : '1'}`;
      if (
        mac.length === sample.length &&
        mac.replace(/\:/g, "").length === sample.replace(/\:/g, "").length &&
        mac !== sample
      ) {
        if (key === "lanHostList" && newState[key][mac].seconds === 0) {
          continue;
        }
        if (!state[hostKey]) {
          state[hostKey] = {};
        }
        if (!state[hostKey][mac]) {
          state[hostKey][mac] = {};
        }
        const lookup = {
          orgLanHostList: "orglan",
          wlan5GAssociatedList: "wlan5",
          lanHostList: "lanhost",
          portMacList: "port",
          ipv6MacList: "ipv6",
          staList5: "stal5",
          staList: "stal",
        };
        const newKey = lookup[key] || key;
        state[hostKey][mac][newKey] = newState[key][mac];
      }
      if (
        state[hostKey] &&
        state[hostKey][mac] &&
        !knownMac[mac] &&
        (!oldState || !oldState[key] || !oldState[key][mac])
       ) {
        state[hostKey][mac]["new"] = true;
      }
    }
  }
  return state;
}

function getNumberWithSignificance(v) {
  if (v === 0 || v === Math.floor(v)) {
    return v.toString();
  }
  if (Math.abs(v) > 1) {
    return v.toFixed(Math.abs(v) > 10 ? 0 : 1).replace(".0", "");
  }
  if (Math.abs(v) < 0.0001) {
    return "0";
  }
  if (Math.abs(v) < 0.001) {
    return v.toFixed(4);
  }
  if (Math.abs(v) < 0.01) {
    return v.toFixed(3);
  }
  if (Math.abs(v) < 0.1) {
    return v.toFixed(2);
  }
  return v.toFixed(1);
}
