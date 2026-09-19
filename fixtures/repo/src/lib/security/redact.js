export function redactEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  const visible = name.slice(0, 1);
  return visible + '***@' + domain;
}
