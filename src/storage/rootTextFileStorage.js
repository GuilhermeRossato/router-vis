import path from "node:path";
import fs from "node:fs";
import { config } from "../../settings.js";

export async function saveRootTextFile(name, data) {
  await fs.promises.writeFile(
    path.resolve(config.dataPath, name),
    typeof data === "string" ? data : JSON.stringify(data, null, "\t"),
    "utf-8",
  );
}

export async function readRootTextFile(name) {
  try {
    const text = await fs.promises.readFile(path.resolve(config.dataPath, name), "utf-8");
    return text;
  } catch (err) {
    return null;
  }
}
