import getDateTimeString from "../utils/getDateTimeString.js";
import fs from "node:fs";

export async function readJsonlDataFile(filePath) {
  if (typeof filePath !== "string") {
    throw new Error("Invalid file path: " + JSON.stringify(filePath));
  }
  const content = await fs.promises.readFile(filePath, "utf-8");
  const text = "[" + content.substring(0, content.lastIndexOf(",")) + "]";
  /** @type {any[]} */
  const entries = JSON.parse(text);
  const parsed = entries.map((e) => ({
    date: new Date(
      e.date + (e.date.includes("Z") || e.date.includes(" -") ? "" : " -03:00")
    ),
    value: e.value,
    lastDate: e.lastDate
      ? new Date(
        e.lastDate +
        (e.lastDate.includes("Z") || e.lastDate.includes(" -")
          ? ""
          : " -03:00")
      )
      : null,
    lastValue: e.lastValue || null,
    interval: e.interval,
  }));
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0 && parsed[i - 1].date.getTime() >= parsed[i].date.getTime()) {
      throw new Error(
        `Date ${getDateTimeString(
          parsed[i].date
        )} is out of order at index ${i} of ${filePath}`
      );
    }
  }
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0 && parsed[i].lastDate && parsed[i].interval) {
      const approx20_000 = parsed[i].date.getTime() - parsed[i].lastDate.getTime();
      if (Math.abs(approx20_000 - parsed[i].interval) > 1000) {
        console.warn(
          "[Warning]",
          `Distance from interval is ${approx20_000 - parsed[i].interval} of date ${getDateTimeString(
            parsed[i].date
          )} at index ${i} of ${filePath}`
        );
      }
    }
  }
  return parsed;
}
