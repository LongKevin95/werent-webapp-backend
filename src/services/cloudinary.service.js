import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import ApiError from "../common/ApiError.js";
import env from "../config/env.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function uploadBuffer(file, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? "werent",
        public_id: options.publicId,
        resource_type: options.resourceType ?? "image",
        transformation: options.transformation,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
}

function getUploadExtension(file) {
  const extensionFromName = path.extname(file.originalname ?? "").toLowerCase();

  if (extensionFromName) {
    return extensionFromName;
  }

  return (
    {
      "image/gif": ".gif",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    }[file.mimetype] ?? ".jpg"
  );
}

function normalizeUploadFolder(folder = "werent") {
  return (
    folder
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part.replace(/[^a-z0-9_-]/gi, ""))
      .filter(Boolean)
      .join("/") || "werent"
  );
}

async function saveFileLocally(file, options = {}) {
  const folder = normalizeUploadFolder(options.folder);
  const extension = getUploadExtension(file);
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const targetDirectory = path.join(LOCAL_UPLOAD_ROOT, folder);
  const targetPath = path.join(targetDirectory, fileName);
  const publicPath = `/api/uploads/${folder}/${fileName}`;

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(targetPath, file.buffer);

  return {
    bytes: file.size,
    format: extension.replace(/^\./, ""),
    height: null,
    publicId: `local/${folder}/${fileName}`,
    secureUrl: publicPath,
    width: null,
  };
}

export async function uploadFiles(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (!isCloudinaryConfigured) {
    if (env.NODE_ENV === "production") {
      throw new ApiError(
        503,
        "Máy chủ chưa được cấu hình lưu trữ ảnh/video production. Vui lòng cấu hình Cloudinary rồi thử lại.",
      );
    }

    return Promise.all(files.map((file) => saveFileLocally(file, options)));
  }

  const results = await Promise.all(
    files.map((file) => uploadBuffer(file, options)),
  );

  return results.map((result) => ({
    bytes: result.bytes,
    format: result.format,
    height: result.height,
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
  }));
}

export async function deleteAsset(publicId, resourceType = "image") {
  if (publicId?.startsWith("local/")) {
    const relativePath = publicId.replace(/^local\//, "");
    const targetPath = path.resolve(LOCAL_UPLOAD_ROOT, relativePath);

    if (!targetPath.startsWith(LOCAL_UPLOAD_ROOT)) {
      throw new ApiError(400, "Đường dẫn tệp upload không hợp lệ.");
    }

    await unlink(targetPath).catch(() => null);
    return { result: "ok" };
  }

  if (!publicId || !isCloudinaryConfigured) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}
