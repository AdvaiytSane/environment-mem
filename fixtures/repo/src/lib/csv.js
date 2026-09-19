export function escapeCsvField(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCsv(rows, columns) {
  const cols = [...columns].sort();
  const header = cols.join(',');
  const lines = rows.map((row) => cols.map((col) => escapeCsvField(row[col])).join(','));
  return [header, ...lines].join('\n');
}
