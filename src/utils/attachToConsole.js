import fs from "node:fs";
import getDateTimeString from "./getDateTimeString.js";
import path from "node:path";
import { config } from "../../settings.js";

let addSource = false;
let addPid = true;
let addDate = true;
let addHour = true;

export default function attachToConsole(method = "log", logFileName, ...extra) {
  if (!logFileName && config.debug) {
    logFileName = `./router-vis-${method}.log`;
  }
  const logFilePath = logFileName ? path.resolve(config.dataPath, logFileName) : null;

  const originalMethod = console[method].bind(console);

  let inside = false;
  const handleCall = (...args) => {
    if (inside) {
      return originalMethod(...args);
    }
    inside = true;
    try {
      const stackFileList = new Error("a").stack
        .split("\n")
        .map((a) =>
          a
            .substring(Math.max(a.lastIndexOf("\\"), a.lastIndexOf("/")) + 1, a.lastIndexOf(":"))
            .replace(")", "")
            .trim(),
        )
        .filter((a) => a.includes(".js:") && !a.includes(attachToConsole.name));
      let src = stackFileList.slice(0, 1).reverse().join(" -> ");
      if (!src) {
        src = "?";
      }
      if (extra.length) {
        args.unshift(...extra);
      }
      if (addPid) {
        args.unshift(`${process.pid} -`);
      }
      if (addSource) {
        args.unshift(`- ${src} -`);
      }
      const [date, hour] = getDateTimeString().substring(0, 23).split(" ");
      if (addHour) {
        args.unshift(hour);
      }
      if (addDate) {
        args.unshift(date);
      }
      if (logFilePath) {
        let text;
        try {
          text = args
            .map((a) =>
              typeof a === "string" ? a : a instanceof Error ? a.stack : JSON.stringify(a),
            )
            .join(" ");
        } catch (err) {
          text = args
            .map((a) => {
              try {
                typeof a === "string" ? a : a instanceof Error ? a.stack : JSON.stringify(a);
              } catch (err) {
                return "(failed to stringify)";
              }
            })
            .join(" ");
        }
        fs.appendFileSync(logFilePath, `${text}\n`, "utf-8");
      }
      originalMethod(...args);
      inside = false;
    } catch (err) {
      originalMethod(`\n\nLogging failed:\n${err.stack}\n\n`);
      inside = false;
    }
  };

  console[method] = handleCall;

  return originalMethod;
}
