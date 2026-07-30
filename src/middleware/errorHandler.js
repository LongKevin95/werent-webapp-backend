import ApiError from "../common/ApiError.js";

export function notFoundHandler(req, res, next) {
  return next(new ApiError(404, "Route not found"));
}

export default function errorHandler(error, req, res, next) {
  let normalizedError = error;

  if (error?.code === "LIMIT_FILE_SIZE") {
    normalizedError = new ApiError(413, "Ảnh tải lên không được vượt quá 5 MB.");
  } else if (error?.name === "MulterError") {
    normalizedError = new ApiError(400, "Không thể xử lý tệp tải lên.");
  } else if (error?.code === 11000) {
    normalizedError = new ApiError(
      409,
      "Email hoặc số điện thoại đã được sử dụng.",
    );
  }

  const statusCode = normalizedError.statusCode ?? 500;
  const isTrustedError = normalizedError instanceof ApiError;

  if (!isTrustedError && statusCode >= 500) {
    console.error(normalizedError);
  }

  return res.status(statusCode).json({
    success: false,
    message: normalizedError.message || "Internal server error",
    ...(normalizedError.details ? { errors: normalizedError.details } : {}),
    ...(normalizedError.code ? { code: normalizedError.code } : {}),
  });
}
