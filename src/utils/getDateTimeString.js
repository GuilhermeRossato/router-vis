/**
 * Returns the date time string offseted by the local timezone
 * @param {Date | string | number} date
 * @returns {string} "YYYY-MM-DD HH:MM:SS.zzz"
 */
export default function getDateTimeString(date = new Date()) {
  const d = new Date(date instanceof Date ? date.getTime() : date === undefined ? null : date);
  const tzOffset = (- d.getTimezoneOffset() / 60);
  d.setTime(d.getTime() + tzOffset * 60 * 60 * 1000);
  const fullYear = d.getUTCFullYear();
  if (isNaN(fullYear)) { throw new Error(`Invalid date: ${JSON.stringify(date)}`); }
  const year = (fullYear).toString().padStart(4, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = (d.getUTCDate()).toString().padStart(2, "0");
  const hours = (d.getUTCHours()).toString().padStart(2, "0");
  const minutes = (d.getUTCMinutes()).toString().padStart(2, "0");
  const seconds = (d.getUTCSeconds()).toString().padStart(2, "0");
  const milliseconds = d.getUTCMilliseconds().toString().padStart(3, "0").substring(0, 3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}
