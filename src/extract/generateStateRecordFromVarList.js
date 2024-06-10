import { enetStatus as parseEnetStatus } from "../parse/enetStatus.js";
import { opticalPower as parseOpticalPower } from "../parse/opticalPower.js";
import { parseIntfSts } from "../parse/parseIntfSts.js";
import { parseLanHostList } from "../parse/parseLanHostList.js";
import { parseOrgLanHostList } from "../parse/parseOrgLanHostList.js";
import { parseWlanAssociatedList } from "../parse/parseWlanAssociatedList.js";
import { parseWlanSimpleAssociatedList } from "../parse/parseWlanSimpleAssociatedList.js";
import { parsePppUptime } from "../parse/parsePppUptime.js";
import { parseStaList } from "../parse/parseStaList.js";
import { parseMacList } from "../parse/parseMacList.js";
import getDateTimeString from "../utils/getDateTimeString.js";

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

export default function generateStateRecordFromVarList(varList, time) {
  /** @type {Record<string, any>[]} */
  const list = []
  for (const { name, content } of varList) {
    const parser = varParserRecord[name] || defaultParser;
    const parsed = parser(name, content);
    list.push(parsed);
  }
  /** @type {Record<string, any>} */
  const rec = {};
  if (time) {
    rec.date = getDateTimeString(time);
  }
  for (const record of list) {
    for (const key in record) {
      rec[key] = record[key];
    }
  }
  if (time) {
    rec.date = getDateTimeString(time);
    rec.time = time;
  }
  return rec;
};
