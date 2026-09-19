export function renderTable(rows, columns) {
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => String(row[col] ?? '').length))
  );
  const header = columns.map((col, i) => col.padEnd(widths[i])).join('  ');
  const lines = rows.map((row) =>
    columns.map((col, i) => String(row[col] ?? '').padEnd(widths[i])).join('  ')
  );
  return [header, ...lines].join('\n');
}
