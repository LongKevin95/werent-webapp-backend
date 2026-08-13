import multer from "multer";
import ApiError from "../common/ApiError.js";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(
        new ApiError(
          415,
          "Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG, WEBP hoặc GIF.",
        ),
      );
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

export default upload;

const ALLOWED_VERIFICATION_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
]);

export const verificationUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, callback) {
    if (!ALLOWED_VERIFICATION_TYPES.has(file.mimetype)) {
      callback(
        new ApiError(
          415,
          "Giấy tờ xác thực chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.",
        ),
      );
      return;
    }

    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});
