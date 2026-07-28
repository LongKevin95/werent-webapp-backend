import { Readable } from "node:stream";
import ApiError from "../common/ApiError.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

function uploadBuffer(file, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? "werent",
        resource_type: options.resourceType ?? "image",
        public_id: options.publicId,
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

export async function uploadFiles(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (!isCloudinaryConfigured) {
    throw new ApiError(500, "Cloudinary chưa được cấu hình.");
  }

  const results = await Promise.all(
    files.map((file) => uploadBuffer(file, options)),
  );

  return results.map((result) => ({
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  }));
}

export async function deleteAsset(publicId, resourceType = "image") {
  if (!publicId || !isCloudinaryConfigured) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}
