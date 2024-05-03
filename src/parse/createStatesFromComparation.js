import getDateTimeString from "../utils/getDateTimeString.js";
import { getIntervalStringFromSeconds } from "../utils/intervalStringTranslation.js";

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
  /** @type {Record<string, any>} */
  const state = {};
  const oldTime = oldRec["time"];
  const newTime = newRec["time"];
  const elapsedSec = (newTime - oldTime) / 1000;

  state["extractionPeriod"] = elapsedSec;
  state["extractionInterval"] = getIntervalStringFromSeconds(elapsedSec);
  if (newRec["uptime"]) {
    state["uptimeInterval"] = getIntervalStringFromSeconds(newRec["uptime"]);
  }
  // Usage
  const speedKeyList = ["ethIntfSts", "wlanIntfSts"];
  let isResetEntry = false;
  if (elapsedSec >= 2 && elapsedSec <= 10 * 60) {
    for (const vName of speedKeyList) {
      if (isResetEntry) {
        break;
      }
      if (!oldRec[vName] || !newRec[vName]) {
        continue;
      }
      if (!state["usage"]) {
        state["usage"] = {};
      }
      const usage = state["usage"];
      for (const interfaceName in newRec[vName]) {
        if (isResetEntry) {
          break;
        }
        for (const dName of ["recv", "sent"]) {
          const oldList = oldRec[vName][interfaceName][dName];
          const newList = newRec[vName][interfaceName][dName];
          const oldBytes = BigInt(oldList[1]);
          const newBytes = BigInt(newList[1]);
          if (oldBytes > newBytes) {
            state[vName + "Reset"] = `${getDateTimeString(
              newTime
            )} from ${oldBytes.toString()} to ${newBytes.toString()} in ${Math.floor(
              elapsedSec
            )} seconds`;
            isResetEntry = true;
            break;
          }
          const oldKb = Number(BigInt(oldBytes) / BigInt(256)) / 4;
          const newKb = Number(BigInt(newBytes) / BigInt(256)) / 4;
          // All
          if (!usage["all"]) {
            usage["all"] = {};
          }
          if (!usage["all"][dName + "Kb"]) {
            usage["all"][dName + "Kb"] = 0;
          }
          // usage["all"][dName + "Kb"].from.push(oldKb);
          // usage["all"][dName + "Kb"].to.push(newKb);
          usage["all"][dName + "Kb"] += newKb - oldKb;
          // Interface-specific
          if (!usage[interfaceName]) {
            usage[interfaceName] = {};
          }
          // usage[interfaceName][dName + "OrigOld"] = oldList[1];
          // usage[interfaceName][dName + "OrigNew"] = newList[1];
          usage[interfaceName][dName + "Kb"] = newKb - oldKb;
        }
      }
    }
  }
  // Speed
  if (state["usage"]) {
    const speed = (state["speed"] = {});
    for (const key in state["usage"]) {
      if (key === "period" || typeof state["usage"][key] !== "object") {
        continue;
      }
      for (const dir of ["recv", "sent"]) {
        const v = state["usage"][key][dir + "Kb"];
        const diff =
          typeof v === "object" && typeof v.diff === "number" ? v.diff : v;
        const kbps = isResetEntry ? 0 : diff / elapsedSec;
        if (!speed["all"]) {
          speed["all"] = {};
        }
        if (!speed["all"][dir + "Kbps"]) {
          speed["all"][dir + "Kbps"] = 0;
        }
        speed["all"][dir + "Kbps"] += kbps;
        if (!speed[key]) {
          speed[key] = {};
        }
        speed[key][dir + "Kbps"] = kbps;
      }
    }
  }
  // Accumulation
  if (state["speed"]) {
    const total = (state["total"] = {});

    for (const key in state["speed"]) {
      for (const dir of ["recv", "sent"]) {
        const speedKbps = state["speed"][key][dir + "Kbps"];
        if (!state["total"][key]) {
          state["total"][key] = {};
        }
        if (!state["total"][key][dir + "Mbps"]) {
          const current =
            oldRec["total"] &&
            oldRec["total"][key] &&
            oldRec["total"][dir + "Mbps"] &&
            typeof oldRec["total"][dir + "Mbps"] === "number"
              ? oldRec["total"][dir + "Mbps"]
              : 0;
          state["total"][key][dir + "Mbps"] =
            isNaN(current) || current <= 0 ? 0 : current;
        }
        state["total"][key][dir + "Mbps"] += speedKbps / 1024;
      }
    }
  }
  // Rounding
  if (state["speed"]) {
    for (const interfaceName in state["speed"]) {
      for (const dir in state["speed"][interfaceName]) {
        if (typeof state["speed"][interfaceName][dir] === "number") {
          state["speed"][interfaceName][dir] = parseFloat(
            state["speed"][interfaceName][dir].toFixed(3)
          );
        }
      }
    }
  }
  // Host grouping
  createHostVars(oldRec, newRec, state);
  return state;
}

function createHostVars(oldState, newState, state = {}) {
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
      if (
        mac.length === sample.length &&
        mac.replace(/\:/g, "").length === sample.replace(/\:/g, "").length &&
        mac !== sample
      ) {
        if (key === "lanHostList" && newState[key][mac].seconds === 0) {
          continue;
        }
        if (!state["hosts"]) {
          state["hosts"] = {};
        }
        if (!state["hosts"][mac]) {
          state["hosts"][mac] = {};
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
        state["hosts"][mac][newKey] = newState[key][mac];
      }
      if (
        state["hosts"] &&
        state["hosts"][mac] &&
        !knownMac[mac] &&
        (!oldState || !oldState[key] || !oldState[key][mac])
       ) {
        state["hosts"][mac]["new"] = true;
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
