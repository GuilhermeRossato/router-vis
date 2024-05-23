import { enetStatus as parseEnetStatus } from "./enetStatus.js";
import { opticalPower as parseOpticalPower } from "./opticalPower.js";
import { parseIntfSts } from "./parseIntfSts.js";
import { parseLanHostList } from "./parseLanHostList.js";
import { parseOrgLanHostList } from "./parseOrgLanHostList.js";
import { parseWlanAssociatedList } from "./parseWlanAssociatedList.js";
import { parseWlanSimpleAssociatedList } from "./parseWlanSimpleAssociatedList.js";
import { parsePppUptime } from "./parsePppUptime.js";
import { parseStaList } from "./parseStaList.js";
import { parseMacList } from "./parseMacList.js";

const varParserRecord = {
  orgLanHostList: parseOrgLanHostList,
  lanHostList: parseLanHostList,
  ethIntfSts: parseIntfSts,
  wlanIntfSts: parseIntfSts,
  wlan5GAssociatedList: parseWlanAssociatedList,
  wlan2dot4GAssociatedList: parseWlanSimpleAssociatedList,
  opticalPower: parseOpticalPower,
  staList: parseStaList,
  staList5: parseStaList,
  portMacList: parseMacList,
  ipv6MacList: parseMacList,
  pppUptime: parsePppUptime,
  enetStatus: parseEnetStatus,
};

function defaultParser(varName, content) {
  const state = {};
  if (content.startsWith("'") && content.endsWith("'")) {
    content = content.substring(1, content.length - 1);
  }
  state[varName] = content;
  return state;
}

export default function generateStateRecordFromVarList(varList) {
  /** @type {Record<string, any>[]} */
  const list = []
  for (const { name, content } of varList) {
    const parser = varParserRecord[name] || defaultParser;
    const parsed = parser(name, content);
    list.push(parsed);
  }
  /** @type {Record<string, any>} */
  const state = {};
  for (const record of list) {
    for (const key in record) {
      state[key] = record[key];
    }
  }
  return state;
};
