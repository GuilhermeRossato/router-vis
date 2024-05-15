const g = ((x = 0, y = 0, txt = '', w = 2.5, h = 2.5) => {
  if (!txt) { txt = `${x.toString().padEnd(9, " ")}, ${y.toString()}`; }
  const d = document.createElement('div');
  d.onclick = () => document.body.querySelectorAll('._g_graph').forEach(f => f.remove());
  d.onmouseenter = () => {d.style.overflow = 'visible'; d.style.maxWidth = 'auto'};
  d.onmouseleave = () => d.style.overflow = 'hidden';
  d.setAttribute('class', '_g_graph');
  d.setAttribute('alt', encodeURIComponent(txt));
  d.setAttribute('title', encodeURIComponent(txt));
  d.setAttribute('tooltip', encodeURIComponent(txt));
  d.setAttribute('style', `position: fixed; top: ${x}px; left: ${y}px; width: ${w}px; height: ${h}px; min-width: ${w}px; min-height: ${h}px; max-width: ${w}px; max-height: ${h}px; background-color: red; cursor: text; overflow: hidden; box-sizing: border-box;`);
  d.textContent = txt;
  document.body.appendChild(d);
})

import attachLogToConsole from "./utils/attachLogToConsole.js";
import config from "../config.js";
import listenForClientRequests from "./server/listenForClientRequests.js";
import sendResponse from "./server/sendResponse.js";
import executeExtractionLoop from "./executeExtractionLoop.js";

if (typeof config.projectPath !== 'string') {
  throw new Error('Invalid project path');
}

const logFilePath = `${config.projectPath}\\server.log`;
attachLogToConsole(logFilePath);

async function init() {
  console.log('Server process started');
  await listenForClientRequests(sendResponse);
  console.log('Server process listening');
  await executeExtractionLoop();
}

init().catch(err => { console.log('Failed'); console.log(err); process.exit(1); });