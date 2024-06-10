import child_process from "node:child_process";
import { config, modes } from "../../settings.js";
import getExtractionServerLogs from "../storage/getExtractionServerLogs.js";
import sleep from "../utils/sleep.js";

const debug = false;

export default async function startDetachedServer(wait = true) {
  if (modes.server) {
    throw new Error('Tried to start server process detached but "server" mode is active');
  }
  if (config.standalone) {
    throw new Error('Tried to start server process detached but "standalone" config is active');
  }
  let log;
  if (wait) {
    // Wait for server logs to become idle
    for (let i = 0; i < 10; i++) {
      await sleep(100);
      const newLog = await getExtractionServerLogs(log ? log.size : undefined, log ? log.buffer : undefined);
      let elapsed = parseFloat((((log ? log.time : new Date().getTime()) - newLog.mtimeMs)/1000).toFixed(2));
      if (i === 0) {
        debug && console.log('Server log file was updated', elapsed, 'seconds ago');
      }
      if (elapsed > (i < 10 ? 3 : 1.5)) {
        break;
      }
      if (!log || (log && log.size !== newLog.size)) {
        debug && console.log('Server logs updated at', i, 'from:', log ? log.size : '(unitialized)', 'to', newLog.size, 'read', newLog.read);
        log = newLog;
        continue;
      }
    }
  }
  const exec = process.argv[0];
  const script = process.argv[1];
  const serverExcludedArgs = ['--server', '--standalone', '--restart', '--start', '--shutdown', '--status'];
  const scriptArgs = process.argv.slice(2).filter(a => !serverExcludedArgs.includes(a));
  scriptArgs.unshift('--server');
  console.debug('Starting detached server with:', scriptArgs);
  const child = child_process.spawn(exec, [script, ...scriptArgs], {
    stdio: "ignore",
    detached: true,
    cwd: config.projectPath,
  });
  child.unref();
  
  if (!wait) {
    return;
  }

  log = await getExtractionServerLogs(log ? log.size : undefined, log ? log.buffer : undefined);
  debug && console.log('Waiting for server log update from', JSON.stringify({size: log.size, read: log.read}));
  for (let i = 0; i < 250; i++) {
    await sleep(200);
    const newLog = await getExtractionServerLogs(log.size, log.buffer);
    if (newLog.read !== 0) {
      await sleep(200);
      log = await getExtractionServerLogs(log.size, log.buffer);
      debug && console.log('Log updated by', JSON.stringify({size: log.size, read: log.read}));
      break;
    }
    const elapsed = parseFloat(((newLog.time - log.time)/1000).toFixed(2))
    if (elapsed > 6) {
      throw new Error(`Server log file did not update after ${elapsed} s`);
    }
  }
  const text = log.text.split('\n').map(l => '[D] ' + l.trim()).join('\n');
  const lines = text.split('\n');
  
  debug && console.log('Updated logs after starting server:', `(${lines.length} lines)`);
  await sleep(200);
  console.log(lines);
  await sleep(200);
}