const LEVELS = ['debug', 'info', 'warn', 'error'];

export function log(level, message) {
  if (!LEVELS.includes(level)) {
    throw new Error('Unknown log level: ' + level);
  }
  console.log('[' + level + '] ' + message);
}

export function info(message) {
  log('info', message);
}

export function warn(message) {
  log('warn', message);
}

export function error(message) {
  log('error', message);
}
