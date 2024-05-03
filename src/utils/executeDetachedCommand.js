import child_process from "child_process";

export default function executeDetachedCommand(command, workingDir = "") {
  if (!workingDir || typeof workingDir !== "string" || workingDir.length <= 0) {
    workingDir = process.cwd();
  }

  const child = child_process.spawn(command, {
    shell: true,
    stdio: "ignore",
    detached: true,
    cwd: workingDir,
  });

  child.unref();

  return true;
}

