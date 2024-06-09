import { getVarDataRangeList } from "./getVarDataRangeList.js";
import path from "node:path";
import config from "../../settings.js";
import { readJsonlDataFile } from "./readJsonlDataFile.js";

export async function getVarListStateAtDate(time, nameFilter) {
  const dataFolderPath = path.resolve(config.projectPath, "data");
  const list = await getVarDataRangeList(nameFilter || '');
  const groups = list.map(
    (entry) => entry.ranges.map(({ fileName, start, end }) => ({
      name: entry.name,
      fileName,
      isTargetInside: time >= start.getTime() &&
        time < end.getTime(),
    })));
  const latestVarList = groups.map(g => {
    const indexAfterFileList = g.findIndex(
      (a) => a.isTargetInside
    );
    const indexFileList = indexAfterFileList === -1
      ? g.length - 1
      : indexAfterFileList;
    return g[indexFileList];
  });
  const result = [];
  for (const { fileName, name } of latestVarList) {
    const entries = await readJsonlDataFile(path.resolve(dataFolderPath, name, fileName));
    result.push({ name, entries });
  }
  return result;
}
