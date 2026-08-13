import ApiError from "../common/ApiError.js";

export function notFoundHandler(req, res, next) {
  return next(new ApiError(404, "Route not found"));
}

export default function errorHandler(error, req, res, next) {
  let normalizedError = error;

  if (error?.code === "LIMIT_FILE_SIZE") {
    normalizedError = new ApiError(
      413,
      req.originalUrl?.includes("/kyc/")
        ? "Giấy tờ tải lên không được vượt quá 10 MB."
        : "Ảnh tải lên không được vượt quá 5 MB.",
    );
  } else if (error?.name === "MulterError") {
    normalizedError = new ApiError(400, "Không thể xử lý tệp tải lên.");
  } else if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0];
    const duplicateMessages = {
      code: "Mã khuyến mãi đã tồn tại.",
      email: "Email đã được sử dụng.",
      phone: "Số điện thoại đã được sử dụng.",
      providerTransactionId: "Giao dịch từ cổng thanh toán đã được ghi nhận trước đó.",
    };
    normalizedError = new ApiError(
      409,
      duplicateMessages[duplicateField] ?? "Dữ liệu bị trùng lặp.",
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
