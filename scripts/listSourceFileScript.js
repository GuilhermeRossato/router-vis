// @ts-check

const fs = require('fs');
const path = require('path');
const dataFolderPath = ('' || '/home/backend/dev/router-vis/data/');

const children = getChildren(dataFolderPath);
const folderList = children.filter(f => f.stat.isDirectory());

const variableFolderList = folderList.map(a => ({
  path: a.path,
  stat: a.stat,
  fileList: getChildren(a.path).filter(a => a.path.endsWith('.jsonl'))
}));

const variableFileList = variableFolderList.map(a => a.fileList.map(b => ({
  folderName: path.basename(a.path),
  fileName: path.basename(b.path),
  path: b.path,
  stat: b.stat,
}))).flat();

const finalFileList = variableFileList.map(a => ({
  dataFolderPath,
  folderName: a.folderName,
  fileName: a.fileName,
  size: a.stat.size,
  mtimeMs: a.stat.mtime,
}));

process.stdout.write(JSON.stringify(finalFileList));

function getChildren(folderPath) {
  return fs.readdirSync(folderPath).map(f => ({
    path: path.resolve(folderPath, f),
    stat: fs.statSync(path.resolve(folderPath, f)),
  }));
}

