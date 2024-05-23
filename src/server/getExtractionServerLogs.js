import fs from "node:fs";
import config from "../../config.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

function convertLineToTriple(line) {
  const space = line.indexOf(' ');
  const firstSeparator = line.indexOf(' - ', space + 1);
  const startsDate = line[0] === '2' && line[1] === '0' && space !== -1 && firstSeparator !== -1 && firstSeparator > space;
  const date = startsDate ? line.substring(0, firstSeparator) : '';
  const sourceLineSeparator = line.indexOf(':', firstSeparator + 3);
  const d = line.indexOf(' - ', sourceLineSeparator + 1);
  let source = '';
  let text = '';
  if (startsDate && sourceLineSeparator !== -1 && sourceLineSeparator > firstSeparator && d !== -1 && d > sourceLineSeparator) {
    source = line.substring(firstSeparator + 3, d);
    text = line.substring(d + 3);
  } else {
    source = '';
    text = line.substring(startsDate ? firstSeparator + 3 : 0);
  }
  return {date: date ? new Date(date) : null, source, text};
}

export default async function getExtractionServerLogs(after = null) {
  const logFilePath = `${config.projectPath}\\server.log`;
  const text = await asyncTryCatchNull(fs.promises.readFile(logFilePath, 'utf-8'));
  if (typeof text !== 'string') {
    return [];
  }
  const triples = text.trim().replace(/\r/g, '').split('\n').map(convertLineToTriple);
  if (!after) {
    return triples;
  }
  const afterDate = (after instanceof Date ? after : new Date(after));
  const afterTime = afterDate.getTime();
  let i;
  for (i = triples.length - 1; i >= 0; i--) {
    if (!triples[i].date) {
      continue;
    }
    if (triples[i].date.getTime() <= afterTime) {
      break;
    }
  }
  return triples.slice(i + 1);
}
