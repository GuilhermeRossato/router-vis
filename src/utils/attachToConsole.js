import fs from "node:fs";
import getDateTimeString from "./getDateTimeString.js";

export default function attachToConsole(method = 'log', logFilePath = '', showLogSource = true, showPid = true) {
  const originalMethod = console[method].bind(console);
  let inside = false;
  const handleRequest = (...args) => {
      if (inside) {
          return originalMethod(...args);
      }
      inside = true;
      try {
          const stackFileList = new Error('a').stack.split('\n').map(
              a => a.substring(Math.max(a.lastIndexOf('\\'), a.lastIndexOf('/')) + 1, a.lastIndexOf(':')).replace(')', '').trim()
          ).filter(
              a => a.includes('.js:') && !a.includes(attachToConsole.name)
          );
          let src = stackFileList.slice(0, 1).reverse().join(' -> ');
          if (!src) {
              src = '?';
          }
          if (showPid) {
            args.unshift(`${process.pid} -`);
          }
          if (showLogSource) {
            args.unshift(`- ${src} -`);
          }
          args.unshift(getDateTimeString().substring(0, 23));
          if (logFilePath) {
            fs.appendFileSync(logFilePath, `${args.map(a => typeof a === 'string' ? a : (a instanceof Error ? a.stack : JSON.stringify(a))).join(' ')}\n`, 'utf-8');
          }
          originalMethod(...args);
          inside = false;
      } catch (err) {
          originalMethod(err.stack);
          inside = false;
      }
  };

  console[method] = handleRequest;
  
  return originalMethod;
}