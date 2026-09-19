if (process.env.APP_ENV !== 'test') {
  throw new Error('APP_ENV must be test (use ops/check.sh)');
}
