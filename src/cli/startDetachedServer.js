import fs from "node:fs";
import child_process from "node:child_process";
import path from "node:path";
import config from "../../config.js"

export default function startDetachedServer() {
  const projectPath = config.projectPath;
  const serverFilePath = path.resolve(projectPath, "src", "server.js");
  if (!fs.existsSync(serverFilePath)) {
    throw new Error(`Could not find server script at "${serverFilePath}"`);
  }
  const child = child_process.spawn(process.argv[0], [serverFilePath], {
    stdio: "ignore",
    detached: true,
    cwd: projectPath,
  });
  child.unref();
}

