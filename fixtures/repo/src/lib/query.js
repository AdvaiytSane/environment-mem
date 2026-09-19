export function parseQuery(url) {
  const parsed = new URL(url, 'http://localhost');
  return Object.fromEntries(parsed.searchParams.entries());
}

export function toQueryString(params) {
  const search = new URLSearchParams(params);
  return search.toString();
}
