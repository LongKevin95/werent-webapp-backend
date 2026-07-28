export default class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = options.code ?? null;
    this.details = options.details ?? null;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}
