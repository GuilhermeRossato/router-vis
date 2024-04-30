
/** @returns {string} '[d.]hh:mm:ss[.zzz]' format ('d.hh:mm:ss.zzz' || 'd.hh:mm:ss' || 'hh:mm:ss.zzz' || 'hh:mm:ss') */
export default function getIntervalTimeBetweenDates(pastDate, futureDate, includeMs = false, includeDayOnZero = false) {
  pastDate = typeof pastDate === 'string' || pastDate === null || pastDate === undefined ? new Date(pastDate === undefined ? null : pastDate).getTime() : pastDate instanceof Date ? pastDate.getTime() : typeof pastDate === 'number' ? pastDate : 0;
  futureDate = typeof futureDate === 'string' || pastDate === null || pastDate === undefined ? new Date(futureDate === undefined ? null : futureDate).getTime() : futureDate instanceof Date ? futureDate.getTime() : typeof futureDate === 'number' ? futureDate : 0;
  
  const ms = Math.abs(futureDate - pastDate);
  const s = ms / 1000;
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;
  
  const parts = [h, m, s, ms].map(
    v => Math.floor(v)
  ).map(
    (v, i) => v % [24, 60, 60, 1000][i]
  ).map(
    (v, i) => v.toString().padStart(i === 3 ? 3 : 2, '0')
  );
  
  const sign = (pastDate > futureDate) ? '-' : '';
  
  const dayPart = (includeDayOnZero || d >= 1) ? `${Math.floor(d)}.` : '';
  const timePart = parts.slice(0, parts.length-1).join(':');
  const msPart = (includeMs ? `.${parts[parts.length-1]}` : '');

  return [sign, dayPart, timePart, msPart].join('');
}
