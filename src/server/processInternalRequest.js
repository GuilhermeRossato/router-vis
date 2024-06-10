import fs from "fs";
import path from "path";
import login from "../extract/getValidSession.js";
import getIntervalTimeBetweenDates from "../utils/getIntervalTimeBetweenDates.js";
import { readRootTextFile, saveRootTextFile } from "../storage/rootTextFileStorage.js";
import getExtractionServerLogs from "../storage/getExtractionServerLogs.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import { config, dataFileName, env } from "../../settings.js";
import { listVarDataFiles } from "../storage/listVarDataFiles.js";
import { getNormalizedVarName } from "../extract/getNormalizedVarName.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

export const ResponseHandlerTypeRecord = {
  index: indexRequestHandler,
  data: readRequestHandler,
  status: statusRequestHandler,
  logs: logsRequestHandler,
  shutdown: shutdownRequestHandler,
  login: loginRequestHandler,
};

export default async function processInternalRequest(type, data) {
  if (type.length <= 3 || ["help", "index", "routes", "usage"].includes(type)) {
    type = "index";
  }
  const handler = ResponseHandlerTypeRecord[type];
  if (!handler) {
    return {
      error: `Unhandled request: Could not find a request handler for "${type}"`,
      options: Object.keys(ResponseHandlerTypeRecord),
      data,
      pid: process.pid,
    };
  }
  return await handler(type, data);
}

async function indexRequestHandler(type, data) {
  return {
    name: "Router Vis Extractor JSON API",
    purpose: "Provides extraction status and router variable data",
    routes: Object.keys(ResponseHandlerTypeRecord).map(
      (k) => `/api/${k}${k === type ? " (this one)" : ""}`,
    ),
    hint: "Parameters can be defined at the query string or at the POST payload",
    params: Object.keys(data).length === 0 ? undefined : data,
  };
}

async function readRequestHandler(_type, data) {
  const varType = data.type || data.varType || data.vartype || data.typeof || data.kind;
  const varSrc = data.source || data.src || data.varSrc || data.varsrc;
  if (!varType && !varSrc) {
    return {
      error: 'Missing "type" and "src" parameter',
      options: {
        type: ["object", "array", "value"],
        src: ["status", "statistics"],
      },
      example: "/api/data?type=object&src=statistics",
    };
  }
  if (!varType || !["obj", "arr", "val"].includes(varType.substring(0, 3).toLowerCase())) {
    return {
      error: 'Missing or invalid "type" parameter',
      type: varType,
      src: varSrc,
      options: {
        type: ["object", "array", "value"],
      },
      example: `/api/data?type=object&src=${varSrc}`,
    };
  }
  if (
    !varSrc ||
    varSrc.length < 6 ||
    !["status", "statis"].includes(varSrc.substring(0, 6).toLowerCase())
  ) {
    return {
      error: 'Missing or invalid "src" parameter',
      type: varType,
      src: varSrc,
      options: {
        src: ["status", "statistics"],
      },
      example: `/api/data?type=${varType}&src=statistics`,
    };
  }
  const files = await listVarDataFiles(varSrc, varType, undefined);
  const varNameList = [...new Set(files.map((file) => getNormalizedVarName(file.varName)))];
  const randomVarName = varNameList[Math.floor(varNameList.length * Math.random())];
  if (!files.length) {
    return {
      error: `There are no variables matching type "${varType}" at source "${varSrc}"`,
      src: varSrc,
      type: varType,
      options: {
        name: varNameList,
        type: ["object", "array", "value"],
        src: ["status", "statistics"],
      },
      example: `/api/data?type=${
        varType.startsWith("arr") ? "object" : varType.startsWith("obj") ? "value" : "object"
      }&src=${varSrc}&name=${randomVarName}`,
    };
  }
  const rawVarName =
    data.name || data.varname || data.var || data.variable || data.key || data.param;
  if (!rawVarName || rawVarName.length <= 2) {
    return {
      error: 'Missing or invalid "name" parameter',
      name: rawVarName,
      src: varSrc,
      type: varType,
      options: {
        name: varNameList,
        type: ["object", "array", "value"],
        src: ["status", "statistics"],
      },
      example: `/api/data?type=${varType}&src=${varSrc}&name=${randomVarName}`,
    };
  }
  let varName = getNormalizedVarName(rawVarName || "");
  const varNameMatchList = varNameList.filter((f) => f.startsWith(varName));
  if (!varName || varName.length <= 2 || varNameMatchList.length !== 1) {
    return {
      error:
        varNameMatchList.length <= 0
          ? 'Could not find any matching data for the specified "name" parameter'
          : `Could not find a single unique variable for the specified "name" parameter (Got ${varNameMatchList.length} matches)`,
      name: varName,
      src: varSrc,
      type: varType,
      options: {
        name: varNameList,
        type: ["object", "array", "value"],
        src: ["status", "statistics"],
      },
    };
  }
  const sectionOptionList = files.filter(
    (file) => getNormalizedVarName(file.varName) === varNameMatchList[0],
  );
  const sections = sectionOptionList.map((f) =>
    f.fileName.substring(0, f.fileName.lastIndexOf(".")),
  );
  let rawVarSection = data.section || data.date || data.time || data.at || data.moment || data.file;
  if (!rawVarSection) {
    rawVarSection = sections[sections.length - 1];
  }
  if (!rawVarSection || typeof rawVarSection !== "string" || rawVarSection.length < 10) {
    return {
      error: 'Invalid "section" parameter',
      section: rawVarSection,
      name: varName,
      src: varSrc,
      type: varType,
      options: {
        section: sections,
      },
    };
  }
  const matchingSections = sectionOptionList.filter((f) =>
    getDateTimeString(f.from).replace(/\D/g, "").startsWith(rawVarSection.replace(/\D/g, "")),
  );
  if (matchingSections.length !== 1) {
    return {
      error:
        matchingSections.length === 0
          ? 'Could not find any match for the "section"'
          : `Could not find a single unique section for the "section" parameter (Got ${matchingSections.length} matches)`,
      section: rawVarSection,
      name: varName,
      src: varSrc,
      type: varType,
      options: {
        section: sections,
      },
    };
  }
  const match = matchingSections[0];
  const loaded = await match.load();
  loaded.entries.forEach((f) => {
    delete f.name;
    delete f.src;
    delete f.type;
    delete f.varName;
    delete f.varSrc;
    delete f.varType;
  });
  return {
    updates: loaded.entries,
    section: match.fileName.substring(0, match.fileName.lastIndexOf(".")),
    name: varName,
    src: varSrc,
    type: varType,
    file: {
      name: match.fileName,
      updatedAt: getDateTimeString(match.stat.mtimeMs),
      size: match.stat.size,
      from: getDateTimeString(match.from),
      to: getDateTimeString(match.to),
    },
    options: {
      section: sections,
    },
  };
}

async function logsRequestHandler(_type, data) {
  const result = await getExtractionServerLogs(data.offset);
  return {
    logs: data.text ? undefined : result.list,
    text: data.text ? result.text : undefined,
    size: result.size,
    read: result.read,
    offset: result.offset,
  };
}

async function statusRequestHandler() {
  const endpoint = `http://${env.INTERNAL_DATA_SERVER_HOST}:${env.INTERNAL_DATA_SERVER_PORT}/api/`;
  const now = new Date().getTime();
  const stat0 = await asyncTryCatchNull(
    fs.promises.stat(path.resolve(config.dataPath, "latest-status.json")),
  );
  const stat1 = await asyncTryCatchNull(
    fs.promises.stat(path.resolve(config.dataPath, "latest-statistics.json")),
  );
  const updateTimeList = [stat0, stat1].map((s) =>
    s && s instanceof fs.Stats && s.size && s.isFile() ? [s.mtimeMs, s.size] : [0, 0],
  );
  const elapsedList = updateTimeList.map(([mtimeMs, size]) => [
    mtimeMs,
    mtimeMs ? (new Date().getTime() - mtimeMs) / 1000 : NaN,
    size ? size : NaN,
  ]);
  return {
    endpoint,
    pid: process.pid,
    ppid: process.ppid,
    cwd: process.cwd(),
    script: process.argv[1],
    args: process.argv.slice(2),
    uptime: getIntervalTimeBetweenDates(now - process.uptime() * 1000, now, false, true),
    statusExtraction: {
      updatedAt: getDateTimeString(elapsedList[0][0]),
      secondsSince: parseFloat(elapsedList[0][1].toFixed(2)),
      size: elapsedList[0][2],
    },
    statisticsExtraction: {
      updatedAt: getDateTimeString(elapsedList[1][0]),
      secondsSince: parseFloat(elapsedList[1][1].toFixed(2)),
      size: elapsedList[1][2],
    },
  };
}

async function loginRequestHandler(data) {
  let origin = "";
  config.user = data.user || data.username || config.user || env.ROUTER_USERNAME;
  config.pass = data.pass || data.passname || config.pass || env.ROUTER_PASSWORD;
  const paramSession = data.session || data.sessionid || data["session-id"];
  if (paramSession) {
    config.session = paramSession;
    origin = "parameter";
  }
  if (!config.session) {
    const fileSession = await readRootTextFile(dataFileName.sessionId);
    if (fileSession) {
      config.session = fileSession;
      origin = "cached-file";
    }
  }
  const result = await login(config.session);
  if (result.sessionId !== config.session) {
    if (origin) {
      origin = `${origin}-then-login`;
    } else {
      origin = "login";
    }
    await saveRootTextFile(dataFileName.sessionId, result.sessionId);
  }
  result["origin"] = origin;
  delete result.body;
  delete result.headers;
  return result;
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
