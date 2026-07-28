import ApiError from "../common/ApiError.js";

export function notFoundHandler(req, res, next) {
  return next(new ApiError(404, "Route not found"));
}

export default function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode ?? 500;
  const isTrustedError = error instanceof ApiError;

  if (!isTrustedError && statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(error.details ? { errors: error.details } : {}),
    ...(error.code ? { code: error.code } : {}),
  });
}
