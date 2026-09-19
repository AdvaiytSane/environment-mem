const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateToken(length = 24) {
  let token = '';
  for (let i = 0; i < length; i++) {
    token += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return token;
}
