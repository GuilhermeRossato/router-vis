import fs from "node:fs";
import getDateTimeString from "./getDateTimeString.js";

export default function attachLogToConsole(logFilePath = '', showLogSource = true) {
  const log = console.log.bind(console);
  let inside = false;
  const handleLog = (...args) => {
      if (inside) {
          return log(...args);
      }
      inside = true;
      try {
          const stackFileList = new Error('a').stack.split('\n').map(
              a => a.substring(Math.max(a.lastIndexOf('\\'), a.lastIndexOf('/')) + 1, a.lastIndexOf(':')).replace(')', '').trim()
          ).filter(
              a => a.includes('.js:') && !a.includes('attachLogToConsole')
          );
          let src = stackFileList.slice(0, 1).reverse().join(' -> ');
          if (!src) {
              src = '?';
          }
          if (showLogSource) {
            args.unshift(`- ${src} -`);
            args.unshift(getDateTimeString().substring(0, 23));
          }
          if (logFilePath) {
            fs.appendFileSync(logFilePath, `${args.map(a => typeof a === 'string' ? a : (a instanceof Error ? a.stack : JSON.stringify(a))).join(' ')}\n`, 'utf-8');
          }
          log(...args);
          inside = false;
      } catch (err) {
          log(err.stack);
          inside = false;
      }
  };

  console.log = handleLog;
  
  return log;
}