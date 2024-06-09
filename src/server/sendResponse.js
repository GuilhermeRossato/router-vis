import fs from "fs";
import path from "path";
import login from "../extract/login.js";
import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";
import {
  readRootTextFile,
  saveRootTextFile,
} from "../storage/rootTextFileStorage.js";
import getExtractionServerLogs from "./getExtractionServerLogs.js";
import sleep from "../utils/sleep.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { getVarDataRangeList } from "./getVarDataRangeList.js";
import { getVarListStateAtDate } from "./getVarListStateAtDate.js";
import routerRequest from "../extract/routerRequest.js";
import isolateVarList from "../extract/isolateVarList.js";
import generateStateRecordFromVarList from "../parse/generateStateRecordFromVarList.js";
import { endpointRecord } from "../extract/endpoints.js";
import { loadLatestDataState } from "../storage/latestDataState.js";
import { config, dataFileName, env } from "../../settings.js";
import { applySelectingFiltersToEntries } from "./applySelectingFiltersToEntries.js";
import { getVarDataPath, listVarDataFileTimes } from "../storage/varFileStorage.js";
import { getNormalizedVarName } from "../getNormalizedVarName.js";

export const ResponseHandlerTypeRecord = {
  "index": indexRequestHandler,
  "data": readRequestHandler,
  "list": listRequestHandler,
  "value": readRequestHandler,
  "array": readRequestHandler,
  "object": readRequestHandler,
  "info": infoRequestHandler,
  "login": loginRequestHandler,
  "status": statusRequestHandler,
  "statistics": statisticsRequestHandler,
  "shutdown": shutdownRequestHandler,
}

async function indexRequestHandler(type, data) {
  return {
    name: 'router-vis-extractor',
    description: 'This data server provides extraction status and stored variable data',
    routes: Object.keys(ResponseHandlerTypeRecord).map(k => `/api/${k}`),
  }
}

async function readRequestHandler(requestType, data) {
  let type = requestType === 'data' ? (data.type || data.varType || '') : requestType;
  if (type.substring(0, 3) === 'val') {
    type = 'value';
  } else if (type.substring(0, 3) === 'arr') {
    type = 'array';
  } else if (type.substring(0, 3) === 'obj') {
    type = 'object';
  } else {
    type = '';
  }
  let src = data.src || data.varSrc || data.source || '';
  if (src.includes('status')) {
    src = 'status';
  } else if (src.includes('statistic')) {
    src = 'statistic';
  }
  const folder = config.dataPath;
  const dataNodes = await fs.promises.readdir(folder);
  /** @type {{varSrc: string, varType: string, varName: string, name: string}[]} */
  const allAvailableVars = [];
  for (const varSrcPair of dataNodes) {
    const [varSrc, varType] = varSrcPair.split('-');
    const stat = await fs.promises.stat(path.resolve(folder, varSrcPair));
    if (!varSrc || !varType || !stat.isDirectory()) {
      continue;
    }
    const varNames = await fs.promises.readdir(path.resolve(folder, varSrc));
    for (const varName of varNames) {
      const stat = await fs.promises.stat(path.resolve(folder, varSrcPair, varName));
      if (!stat.isDirectory()) {
        continue;
      }
      const name = getNormalizedVarName(varName);
      if (!allAvailableVars.map(a => a.name).includes(name)) {
        allAvailableVars.push({varSrc, varType, varName, name});
      }
    }
  }

  const specifiedNames = ['name', 'varname', 'var', 'variable', 'id', 'key'].map((k) => (data[k] || data[`${k}s`] || '').split(',').map(t=>t.trim()).filter(t => t.length)).flat();
  const allVarsObjs = specifiedNames.map((varName) => {
    const isPrefix = varName.endsWith('*');
    const isSufix = varName.startsWith('*');
    if (varName.includes('*')) {
      varName = varName.replace(/\*/g, '');
    }
    const name = getNormalizedVarName(varName);
    const matches = allAvailableVars.filter((o) => {
      if (type && o.varType && o.varType !== type) {
        return false;
      }
      if (src && o.varSrc && o.varSrc !== src) {
        return false;
      }
      if (o.name === name || o.varName === varName) {
        return true;
      }
      if (isPrefix && isSufix && (o.name.includes(name) || o.varName.includes(name))) {
        return true;
      }
      if (!isPrefix && isSufix && (o.name.endsWith(name) || o.varName.endsWith(name))) {
        return true;
      }
      if (isPrefix && !isSufix && (o.name.startsWith(name) || o.varName.startsWith(name))) {
        return true;
      }
      return false;
    });
    return {
      name,
      varName,
      matches,
    }
  });
  let varNameObjs = allVarsObjs.filter(n => n.matches.length > 0);
  let varNameMiss = allVarsObjs.filter(n => n.matches.length === 0);
  if (allVarsObjs.length && varNameMiss.length) {
    return {
      error: `Could not find ${allVarsObjs.length === 1?'the variable':'some variables'} specified by name`,
      hint: 'You can use "prefix" or "sufix" arguments to specify parts of the variable names',
      missing: varNameMiss.map(v => v.name),
      matching: varNameObjs.map(v => v.name),
      options: allAvailableVars.map(a => a.name),
    };
  }
  if (!type && varNameObjs.map(a => a.matches[0].varName))) {
    if (name.length) {
      const matches = allAvailableVars.filter(t => name.includes(t[2]));
      const srcs = [...new Set(matches.map(t => t[0]))];
      const types = [...new Set(matches.map(t => t[1]))];
      if (!src && srcs.length === 1) {
        src = srcs[0];
      }
      if (!type && types.length === 1) {
        type = types[0];
      }
    }
  }


  if (!type) {
    return {
      error: 'Specify a "type" parameter with either "value", "array", or "object"',
      missing: 'type',
      options: ['value', 'array', 'object'],
    }
    }
  if (!src) {
    return {
      error: 'Specify a "src" parameter with either "statistics" or "status"',
      missing: 'statistics',
      options: ['statistics', 'status'],
    }
  }
  if (!name) {
    const folder = getVarDataPath(src, type);
    const varNames = await fs.promises.readdir(folder);
    const options = [];
    for (const name of varNames) {
      const stat = await fs.promises.stat(path.resolve(folder, name));
      if (stat.isDirectory()) {
        options.push(name);
      }
    }
    return {
      error: 'Specify one or more variable names in the "name" parameter (comma-separated) to read data',
      names: options,
      name: "Specify the \"name\" parameter to list the dates the variable received updates",
      date: "Specify only the \"date\" parameter to read  data at a specific moment in time",
      range: "Specify the \"start\" and \"end\" parameter to read all variable data at a specific moment in time",
      vars: options,
    }
  }

  if (!start) {
    return {
      error: 'Specify the "date", "start", or "from" parameter with a date'
    }
  }
  if (!data.src) {
    return {
      error: 'Specify the "src" parameter with "statistics" or "status"'
    }
  }
  const names = [data.varName, data.varNames, data.name, data.names].map(a => a instanceof Array ? a : typeof a === 'string' ? a.split(',').map(a => a.trim()) : typeof a === 'object' && typeof (a.varName || a.name) === 'string' ? [a.varName || a.name] : []).filter(a => a.length > 0).flat().filter(a => a.length > 0).map(name => name.replace(/\-/g, '').toLowerCase().trim());
  
  const prefix = (data.prefix || '').toLowerCase().substring(0, 3);
  const varName

  const isUpcoming = !start || (start instanceof Date && start.getTime() >= new Date().getTime());


  
  return {
    record: rec,
  }
}

async function listRequestHandler(data) {
  let [date, start, end] = [[data.date, data.time], [data.after, data.start, data.from], [data.before, data.end, data.finish, data.to, data.until]].map(
    (list) => list.map((v) => {
      v = (v || '').toString().trim().toLowerCase();
      if (!v.length) {
        return;
      }
      let d;
      if (v.startsWith('now') || v === '0') {
        d = new Date();
      } else if (v.startsWith('hour') || v.startsWith('today')) {
        d = new Date();
        // this minute
        d.setTime(d.getTime() - d.getUTCMilliseconds() - d.getUTCSeconds() * 1000);
        // this hour
        d.setTime(d.getTime() - d.getUTCMinutes() * 60 * 1000);
        if (v.startsWith('today')) {
          // this day
          d.setTime(d.getTime() - d.getHours() * 60 * 60 * 1000);
        }
      } else if (v === v.replace(/\D/g, '')) {
        const t = parseInt(v);
        d = [t, t*1000, t/1000].map(t => new Date(t)).find(d => Boolean(!isNaN(d.getTime()) && d.getFullYear() > 1999 && d.getFullYear() < 2100));
      } else {
        d = new Date(getDateTimeString(v, true));
        if (isNaN(d.getTime())) {
          d = new Date(v);
        }
      }
      if (!d || !(d instanceof Date) || isNaN(d.getTime())) {
        return;
      }
      return d;
    }
  ).filter(v => v && v instanceof Date).pop());

  const period = data.period === 'hour' ? 60*60*1000 : data.period === 'day' ? 24*60*60*1000 : 0;
  
  if (period && !(date || start) && !end) {
    start = new Date(new Date().getTime()-period);
    end = new Date(new Date().getTime()+period);
  } else if (period && !start && end) {
    start = new Date(end.getTime()-period);
  } else if (period && (start || date) && !end) {
    end = new Date((start || date).getTime()+period);
  }


  const list = await getVarDataRangeList(data.name || '');

  return {
    list,
  }
}

async function nextRequestHandler(data) {

  const rec = await waitForJoinedStateUpdate(data.name);
  return {
    record: rec,
  }
}

async function logsRequestHandler(data) {

  let logList = await getExtractionServerLogs(data.cursor);
  while (logList.length === 0 && data.wait) {
    await sleep(400);
    logList = await getExtractionServerLogs(data.cursor);
  }
  if (logList.length === 0) {
    return {
      logs: [],
      cursor: undefined,
    }
  }
  if (logList.length >= 40) {
    logList = logList.slice(0, 40);
  }
  let cursor = null;
  if (logList[logList.length - 1] && logList[logList.length - 1].date) {
    cursor = (logList[logList.length - 1].date instanceof Date) ? logList[logList.length - 1].date.getTime() : (typeof logList[logList.length - 1].date === 'number' ? logList[logList.length - 1].date : -1);
  } else if (logList[logList.length - 2] && logList[logList.length - 2].date) {
    cursor = (logList[logList.length - 2].date instanceof Date) ? logList[logList.length - 2].date.getTime() : (typeof logList[logList.length - 2].date === 'number' ? logList[logList.length - 2].date : -1);
  }
  return { cursor, logs: logList };


}

async function infoRequestHandler() {
  const now = new Date().getTime();
  const data = getJoinedStateRecord();
  return {
    pid: process.pid,
    ppid: process.ppid,
    cwd: process.cwd(),
    argv: process.argv,
    uptime: getIntervalTimeBetweenDates(now - process.uptime() * 1000, now),
    extraction: {
      varCount: Object.keys(data).length,
      hostCount: Object.keys(data['hosts'] || {}).length,
      lastTime: data['time'] ? data['time'] : null,
      lastDate: data['time'] ? getDateTimeString(data['time']) : null,
    }
  };
}

async function loginRequestHandler(data) {
  config.user = data.user || data.username || config.user || env.ROUTER_USERNAME;
  config.pass = data.pass || data.passname || config.pass || env.ROUTER_PASSWORD;
  config.session = data.session || data.sessionid || data['session-id'] || config.session;
  if (!config.session) {
    config.session = await readRootTextFile(dataFileName.sessionId);
  }
  const result = await login(config.session);
  if (result.sessionId !== config.session) {
    await saveRootTextFile(dataFileName.sessionId, result.sessionId);
  }
  return result;
}

async function statusRequestHandler(data) {
  return await performExtractionHandler('status', data);
}

async function statisticsRequestHandler(data) {
  return await performExtractionHandler('statistics', data);
}

async function performExtractionHandler(type, data) {
  config.user = data.user || data.username || config.user || env.ROUTER_USERNAME;
  config.pass = data.pass || data.passname || config.pass || env.ROUTER_PASSWORD;
  config.session = data.session || data.sessionid || data['session-id'] || config.session;
  if (!config.session) {
    config.session = await readRootTextFile(dataFileName.sessionId);
  }
  const routerResponse = await routerRequest(
    endpointRecord[type],
    config.session
  );
  if (routerResponse.sessionId !== config.session) {
    config.session = routerResponse.sessionId;
    await saveRootTextFile(dataFileName.sessionId, config.session);
  }
  const list = isolateVarList(routerResponse);
  const rec = generateStateRecordFromVarList(list);
  let entries = Object.entries(rec);
  try {
    entries = applySelectingFiltersToEntries(data, entries)
  } catch (err) {
    entries.push(['error', `Filtering failed: ${err.stack}`]);
  }
  entries = (entries instanceof Array ? entries : []).filter(([key, value]) => (key !== 'date' && key !== 'time'));
  const filteredRec = Object.fromEntries([
    ...entries,
    ['date', getDateTimeString(routerResponse.date)],
  ]);
  return filteredRec;
}

async function shutdownRequestHandler(data) {
  console.log("Processing shutdown request");
  setTimeout(() => {
    process.exit(0);
  }, 100);
  return {
    success: true,
    message: "exiting",
    serverPid: process.pid,
  };
}

/**
 * Process a client request
 * @param {string} type
 * @param {any} data
 * @returns {Promise<any>}
 */
export default async function sendResponse(type, data) {
  const isIndex = type.length <= 2 || ['help', 'index', 'routes', 'usage'].includes(type);
  const handler = ResponseHandlerTypeRecord[isIndex ? 'index' : type];
  if (!handler) {
    return {
      error: 'Unhandled request',
      type,
      data,
      serverPid: process.pid,
      serverUptimeSeconds: Math.floor(process.uptime()),
    }
  }
  return await handler(type, data);
}
