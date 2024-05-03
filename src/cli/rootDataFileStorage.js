import path from "node:path";
import fs from "node:fs";
import config from "../../config.js";

const dataFolderPath = `${config.projectPath}/data`;

export async function saveRootDataFile(name, data) {
  await fs.promises.writeFile(path.resolve(dataFolderPath, name), typeof data === 'string' ? data : JSON.stringify(data, null, '\t'), 'utf-8');
}

export async function loadRootDataFile(name) {
  try {
    const text = await fs.promises.readFile(path.resolve(dataFolderPath, name), 'utf-8');
    return text;
  } catch (err) {
    return null;
  }
}