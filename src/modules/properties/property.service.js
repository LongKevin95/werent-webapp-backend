import ApiError from "../../common/ApiError.js";
import { PROPERTY_STATUS, ROLES } from "../../common/constants.js";
import { uploadFiles } from "../../services/cloudinary.service.js";
import Property from "./property.model.js";

function buildQueryFilters(query) {
  const filters = {};

  if (query.status) {
    filters.status = query.status;
  }

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
  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });

  const propertyPayload = {
    ...payload,
    owner: ownerId,
    images: uploadedImages.map((image) => ({
      url: image.secureUrl,
      publicId: image.publicId,
    })),
  };

  if (
    propertyPayload.status === PROPERTY_STATUS.ACTIVE &&
    !propertyPayload.publishedAt
  ) {
    propertyPayload.publishedAt = new Date();
  }

  return Property.create(propertyPayload);
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

  const uploadedImages = await uploadFiles(files, {
    folder: "werent/properties",
  });

  Object.assign(property, payload);

  if (property.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  if (uploadedImages.length > 0) {
    property.images = [
      ...property.images,
      ...uploadedImages.map((image) => ({
        url: image.secureUrl,
        publicId: image.publicId,
      })),
    ];
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
  property.rejectionReason =
    payload.status === PROPERTY_STATUS.REJECTED
      ? (payload.rejectionReason ?? null)
      : null;
  property.reviewedBy = reviewerId;
  property.reviewedAt = new Date();

  if (payload.status === PROPERTY_STATUS.ACTIVE && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  await property.save();
  return property;
}
