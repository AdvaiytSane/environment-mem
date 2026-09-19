import { createHmac } from 'node:crypto';

export function sign(message, secret) {
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function verify(message, secret, signature) {
  return sign(message, secret) === signature;
}
