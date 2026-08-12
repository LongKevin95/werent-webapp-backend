import ApiError from "../../common/ApiError.js";
import {
  PROPERTY_STATUS,
  PROPERTY_STATUS_LIST,
  ROLES,
} from "../../common/constants.js";
import { deleteAsset, uploadFiles } from "../../services/cloudinary.service.js";
import {
  assertWalletCanSpend,
  spendWalletForListing,
} from "../payments/wallet.service.js";
import Property from "./property.model.js";

function serializePropertyImage(image) {
  return {
    publicId: image.publicId ?? null,
    url: image.url,
  };
}

function getPropertyImageKey(image) {
  if (image.publicId) {
    return `public:${image.publicId}`;
  }

  return image.url ? `url:${image.url}` : "";
}

function getExistingImageFromMap(imageMap, image) {
  const candidates = [
    image.publicId ? `public:${image.publicId}` : "",
    image.url ? `url:${image.url}` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const existingImage = imageMap.get(candidate);

    if (existingImage) {
      return existingImage;
    }
  }

  return null;
}

function mapUploadedImage(image) {
  return {
    url: image.secureUrl,
    publicId: image.publicId,
  };
}

function buildUpdatedPropertyImages(currentImages, uploadedImages, payload) {
  const currentImageMap = new Map();
  const uploadedPropertyImages = uploadedImages.map(mapUploadedImage);

  currentImages.forEach((image) => {
    if (image.publicId) {
      currentImageMap.set(`public:${image.publicId}`, image);
    }

    if (image.url) {
      currentImageMap.set(`url:${image.url}`, image);
    }
  });

  if (Array.isArray(payload.imageOrder)) {
    const usedExistingKeys = new Set();
    const usedUploadIndexes = new Set();
    const orderedImages = [];

    payload.imageOrder.forEach((item) => {
      if (item.source === "existing") {
        const existingImage = getExistingImageFromMap(currentImageMap, item);
        const existingKey = existingImage
          ? getPropertyImageKey(existingImage)
          : "";

        if (
          existingImage &&
          existingKey &&
          !usedExistingKeys.has(existingKey)
        ) {
          orderedImages.push(existingImage);
          usedExistingKeys.add(existingKey);
        }
        return;
      }

      const uploadedImage = uploadedPropertyImages[item.fileIndex];

      if (uploadedImage && !usedUploadIndexes.has(item.fileIndex)) {
        orderedImages.push(uploadedImage);
        usedUploadIndexes.add(item.fileIndex);
      }
    });

    uploadedPropertyImages.forEach((uploadedImage, index) => {
      if (!usedUploadIndexes.has(index)) {
        orderedImages.push(uploadedImage);
      }
    });

    return orderedImages;
  }

  if (Array.isArray(payload.existingImages)) {
    return [
      ...payload.existingImages
        .map((image) => getExistingImageFromMap(currentImageMap, image))
        .filter(Boolean),
      ...uploadedPropertyImages,
    ];
  }

  return [...currentImages, ...uploadedPropertyImages];
}

async function deleteRemovedPropertyImages(currentImages, nextImages) {
  const nextImageKeys = new Set(nextImages.map(getPropertyImageKey));

  await Promise.all(
    currentImages
      .filter((image) => !nextImageKeys.has(getPropertyImageKey(image)))
      .map((image) => image.publicId)
      .filter(Boolean)
      .map((publicId) => deleteAsset(publicId).catch(() => null)),
  );
}

function buildQueryFilters(query) {
  const filters = {
    status: PROPERTY_STATUS.ACTIVE,
  };

  if (query.owner) {
    filters.owner = query.owner;
  }

  if (query.keyword) {
    filters.$or = [
      { title: { $regex: query.keyword, $options: "i" } },
      { address: { $regex: query.keyword, $options: "i" } },
      { projectName: { $regex: query.keyword, $options: "i" } },
      { district: { $regex: query.keyword, $options: "i" } },
      { city: { $regex: query.keyword, $options: "i" } },
    ];
  }

  return filters;
}

export async function listProperties(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filters = buildQueryFilters(query);
  const [items, total] = await Promise.all([
    Property.find(filters)
      .populate("owner", "fullName email phone roles")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Property.countDocuments(filters),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listPropertiesByOwner(ownerId, query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const filters = { owner: ownerId };

  if (query.status) {
    filters.status = query.status;
  }

  const [items, total, statusCountEntries] = await Promise.all([
    Property.find(filters)
      .populate("owner", "fullName email phone roles")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Property.countDocuments(filters),
    Promise.all(
      PROPERTY_STATUS_LIST.map(async (status) => [
        status,
        await Property.countDocuments({ owner: ownerId, status }),
      ]),
    ),
  ]);
  const statusCounts = Object.fromEntries(statusCountEntries);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    statusCounts: {
      all: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      ...statusCounts,
    },
  };
}

export async function getPropertyById(propertyId) {
  const property = await Property.findById(propertyId).populate(
    "owner",
    "fullName email phone roles",
  );

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  return property;
}

export async function createProperty(ownerId, payload, files = []) {
  const requestedStatus =
    payload.status === PROPERTY_STATUS.DRAFT
      ? PROPERTY_STATUS.DRAFT
      : PROPERTY_STATUS.PENDING;
  const listingPackagePrice =
    requestedStatus === PROPERTY_STATUS.DRAFT
      ? 0
      : Number(payload.package?.totalPrice ?? 0);

  await assertWalletCanSpend(ownerId, listingPackagePrice);

  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });
  const { status: _status, ...propertyFields } = payload;

  const propertyPayload = {
    ...propertyFields,
    status: requestedStatus,
    publishedAt: requestedStatus === PROPERTY_STATUS.ACTIVE ? new Date() : null,
    owner: ownerId,
    images: uploadedImages.map((image) => ({
      url: image.secureUrl,
      publicId: image.publicId,
    })),
  };

  const property = await Property.create(propertyPayload);

  try {
    await spendWalletForListing(ownerId, listingPackagePrice, {
      description: "Thanh toán gói đăng tin",
      propertyId: property._id,
      metadata: {
        package: property.package,
        propertyTitle: property.title,
      },
    });
  } catch (error) {
    await property.deleteOne().catch(() => null);
    await Promise.all(
      uploadedImages
        .map((image) => image.publicId)
        .filter(Boolean)
        .map((publicId) => deleteAsset(publicId).catch(() => null)),
    );
    throw error;
  }

  return property;
}

export async function updateProperty(propertyId, actor, payload, files = []) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  const isOwner = property.owner.toString() === actor._id.toString();
  const isAdmin =
    Array.isArray(actor.roles) && actor.roles.includes(ROLES.ADMIN);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Bạn không thể chỉnh sửa tin đăng này.");
  }

  const payloadKeys = Object.keys(payload).filter(
    (key) => !["existingImages", "imageOrder"].includes(key),
  );
  const isStatusOnlyUpdate =
    files.length === 0 &&
    payloadKeys.length === 1 &&
    payloadKeys[0] === "status";

  if (!isAdmin && isStatusOnlyUpdate) {
    const isAllowedVisibilityTransition =
      (property.status === PROPERTY_STATUS.ACTIVE &&
        payload.status === PROPERTY_STATUS.HIDDEN) ||
      (property.status === PROPERTY_STATUS.HIDDEN &&
        payload.status === PROPERTY_STATUS.ACTIVE &&
        !property.moderationReason);

    if (
      !isAllowedVisibilityTransition &&
      payload.status !== PROPERTY_STATUS.DRAFT
    ) {
      throw new ApiError(
        400,
        property.status === PROPERTY_STATUS.HIDDEN && property.moderationReason
          ? "Tin đã bị quản trị viên ẩn. Vui lòng chỉnh sửa và gửi duyệt lại."
          : "Trạng thái tin đăng này chỉ có thể được cập nhật bởi quản trị viên.",
      );
    }
  }

  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });
  const currentImages = property.images.map(serializePropertyImage);
  const { existingImages, imageOrder, ...propertyPayload } = payload;

  Object.assign(property, propertyPayload);

  const hasContentChanges =
    !isAdmin &&
    (files.length > 0 ||
      payloadKeys.some((key) => key !== "status") ||
      Array.isArray(existingImages) ||
      Array.isArray(imageOrder));

  if (hasContentChanges && payload.status !== PROPERTY_STATUS.DRAFT) {
    property.status = PROPERTY_STATUS.PENDING;
    property.publishedAt = null;
    property.rejectionReason = null;
    property.moderationReason = null;
    property.reviewedBy = null;
    property.reviewedAt = null;
  }

  if (property.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  if (property.status === PROPERTY_STATUS.DRAFT) {
    property.publishedAt = null;
  }

  if (
    uploadedImages.length > 0 ||
    Array.isArray(existingImages) ||
    Array.isArray(imageOrder)
  ) {
    const nextImages = buildUpdatedPropertyImages(
      currentImages,
      uploadedImages,
      {
        existingImages,
        imageOrder,
      },
    );

    property.images = nextImages;
    await deleteRemovedPropertyImages(currentImages, nextImages);
  }

  await property.save();
  return property;
}

export async function updatePropertyStatus(propertyId, reviewerId, payload) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  property.status = payload.status;
  const moderationReason = payload.reason ?? payload.rejectionReason ?? null;
  property.moderationReason = [
    PROPERTY_STATUS.REJECTED,
    PROPERTY_STATUS.HIDDEN,
  ].includes(payload.status)
    ? moderationReason
    : null;
  property.rejectionReason =
    payload.status === PROPERTY_STATUS.REJECTED ? moderationReason : null;
  property.reviewedBy = reviewerId;
  property.reviewedAt = new Date();

  if (payload.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  if (payload.status === PROPERTY_STATUS.PENDING) {
    property.publishedAt = null;
  }

  await property.save();
  return property;
}

export async function deleteProperty(propertyId, actor) {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Không tìm thấy tin đăng.");
  }

  const isOwner = property.owner.toString() === actor._id.toString();
  const isAdmin =
    Array.isArray(actor.roles) && actor.roles.includes(ROLES.ADMIN);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Bạn không thể xóa tin đăng này.");
  }

  await property.deleteOne();

  await Promise.all(
    property.images
      .map((image) => image.publicId)
      .filter(Boolean)
      .map((publicId) => deleteAsset(publicId).catch(() => null)),
  );
}
