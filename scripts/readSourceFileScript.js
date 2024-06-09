// @ts-check

const fs = require('fs');
const path = require('path');

const dataFolderPath = ('' || '/home/backend/dev/router-vis/data/');
const folderName = ('' || 'eth-intf-sts');
const fileName = ('' || '2024-05-03-15.jsonl');
const full = path.resolve(dataFolderPath, folderName, fileName);
const content = fs.readFileSync(full, 'utf-8');
const text = '[' + content.substring(0, content.lastIndexOf(',')) + ']';

process.stdout.write(JSON.stringify(text));
