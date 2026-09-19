export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function isHttpError(err) {
  return err instanceof HttpError;
}
