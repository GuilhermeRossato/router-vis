export function getFullAndRawDisplayTextParts(parts) {
  const list = [];
  for (const part of parts) {
    const color = [part.green ? "\x1b[32m" : "", part.yellow ? "\x1b[33m" : ""].join("");
    const reset = color ? "\x1b[0m" : "";
    let pad = part.pad instanceof Array ? part.pad : [0.5, 0.5];
    const obj = {
      size: 0,
      raw: "",
      full: "",
    };
    for (const isRaw of [false, true]) {
      const text = [
        part.prefix === undefined || part.prefix === null ? "" : part.prefix.toString(),
        isRaw ? "" : color,
        part.text.toString(),
        isRaw ? "" : reset,
        part.sufix === undefined || part.sufix === null ? "" : part.sufix.toString(),
      ].join("");
      if (isRaw) {
        obj.raw = text;
      } else {
        obj.full = text;
      }
      if (isRaw && part.size && part.size > obj.raw.length) {
        const missing = part.size - obj.raw.length;
        pad = pad.map((v) => Math.floor(typeof v === "number" ? v * missing : 0));
        if (pad[0] + pad[1] + obj.raw.length < part.size) {
          pad[pad[0] > 0 ? 0 : 1]++;
        }
      }
    }
    if (pad[0] > 0) {
      obj.raw = ' '.repeat(pad[0]) + obj.raw;
      obj.full = ' '.repeat(pad[0]) + obj.full;
    }
    if (pad[1] > 0) {
      obj.raw = obj.raw + ' '.repeat(pad[1]);
      obj.full = obj.full + ' '.repeat(pad[1]);
    }
    obj.size = obj.raw.length;
    list.push(obj);
  }
  return list;
}
