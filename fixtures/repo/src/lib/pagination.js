export function paginate(items, page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCount(total, pageSize = 10) {
  return Math.max(1, Math.ceil(total / pageSize));
}
