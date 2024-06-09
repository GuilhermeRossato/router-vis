export function applySelectingFiltersToEntries(data, entries) {
  const names = [data.varName, data.varNames, data.name, data.names].map(a => a instanceof Array ? a : typeof a === 'string' ? a.split(',').map(a => a.trim()) : typeof a === 'object' && typeof (a.varName || a.name) === 'string' ? [a.varName || a.name] : []).filter(a => a.length > 0).flat().filter(a => a.length > 0).map(name => name.replace(/\-/g, '').toLowerCase().trim());
  const type = (data.type || '').toLowerCase().substring(0, 3);
  const prefix = (data.prefix || '').toLowerCase().substring(0, 3);
  if (!names.length && !type && !prefix) {
    return entries;
  }
  const filteredReasons = entries.map(([raw, value]) => {
    const simple = raw.replace(/\-/g, '').replace(/\_/g, '').replace(/\s/g, '').toLowerCase().trim();
    if (names.length && !names.includes(simple)) {
      return '!name';
    }
    if (prefix && simple.startsWith(prefix)) {
      return '!prefix';
    }
    if (type === 'val' && typeof value === 'object') {
      return '!val';
    }
    if (type === 'obj' && typeof value !== 'object') {
      return '!obj';
    }
    if (type === 'arr' && !(value instanceof Array)) {
      return '!arr';
    }
    return;
  });
  return entries.filter((_, i) => !filteredReasons[i]);
}
