import path from "node:path";
import fs from "node:fs";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";
import { loadVarDataFileAt } from "./loadVarDataFileAt.js";
import { config } from "../../settings.js";
import { getNormalizedVarName } from "../extract/getNormalizedVarName.js";

const debug = false;

/**
 * @param {string | string[]} [varSrc]
 * @param {string | string[]} [varType]
 * @param {string | string[]} [varName]
 * @returns 
 */
export async function listVarDataFiles(varSrc = [], varType = [], varName = []) {
  if (varSrc && typeof varSrc === 'string') {
    varSrc = varSrc.length ? [varSrc] : [];
  }
  if (varType && typeof varType === 'string') {
    varType = varType.length ? [varType] : [];
  }
  if (varName && typeof varName === 'string') {
    varName = varName.length ? [varName] : [];
  }
  const result = [];
  const rootFolder = path.resolve(config.dataPath);
  const rootList = await asyncTryCatchNull(fs.promises.readdir(rootFolder));
  if (!(rootList instanceof Array)) {
    return [];
  }
  for (const rootName of rootList) {
    if (varType && varType instanceof Array && varType.length && !varType.find(v => v.substring(0, 3) === rootName.substring(0, 3))) {
      debug && console.log('Skipping', rootName);
      continue;
    }
    if (!rootName.startsWith('obj-') && !rootName.startsWith('arr-') && !rootName.startsWith('val-')) {
      debug && console.log('Skipping', rootName);
      continue;
    }
    const rootSrc = rootName.substring(rootName.indexOf('-')+1);
    if (varSrc && varSrc instanceof Array && varSrc.length && !varSrc.find(v => v.substring(0, 6) === rootSrc.substring(0, 6))) {
      debug && console.log('Skipping', rootName, rootSrc, rootSrc.substring(0, 6), varSrc.map(v => v.substring(0, 6))[0]);
      continue;
    }
    const typeSrcList = await asyncTryCatchNull(fs.promises.readdir(path.resolve(rootFolder, rootName)));
    if (!(typeSrcList instanceof Array)) {
      debug && console.log('Skipping', rootName, rootSrc);
      continue;
    }
    for (const name of typeSrcList) {
      if (varName && varName instanceof Array && varName.length && !varName.find(v => getNormalizedVarName(v) === name)) {
        debug && console.log('Skipping by name', rootName, rootSrc, name);
        continue;
      }
      const varFolderPath = path.resolve(rootFolder, rootName, name);
      const times = await asyncTryCatchNull(fs.promises.readdir(varFolderPath));
      if (!(times instanceof Array)) {
        debug && console.log('Skipping', rootName, rootSrc, name);
        continue;
      }
      for (const fileName of times) {
        const fileTime = fileName.substring(0, fileName.lastIndexOf("."));
        const fileTimePath = path.resolve(varFolderPath, fileName);
        const stat = await asyncTryCatchNull(fs.promises.stat(fileTimePath));
        if (!(stat instanceof fs.Stats)) {
          console.debug(`Failed while reading "${fileTimePath}":`, stat);
          continue;
        }
        const yyyymmdd = fileTime.substring(0, 10);
        if (!yyyymmdd.startsWith('2')) {
          debug && console.log('Skipping', rootName, rootSrc, name, yyyymmdd);
          continue;
        }
        const hh = fileTime.substring(11, 13);
        const [from, to] = ["00:00:00.000", "00:59:59.999"].map((sufix) => new Date(
          `${yyyymmdd} ${hh}${sufix.substring(2)}`
        ).getTime()
        );
        /** @type {()=>ReturnType<typeof loadVarDataFileAt>} */
        const load = loadVarDataFileAt.bind(null, fileTimePath);
        result.push({
          fileName,
          filePath: fileTimePath,
          varName: name,
          varSrc: rootSrc,
          varType: rootName.startsWith('obj-') ? 'object' : rootName.startsWith('arr-') ? 'array' : 'value',
          stat,
          from,
          to,
          load,
        });
      }
    }
  }
  return result.sort((a, b) => a.from - b.from);
}

