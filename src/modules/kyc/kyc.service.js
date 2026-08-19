import mongoose from "mongoose";
import ApiError from "../../common/ApiError.js";
import {
  KYC_STATUS,
  LISTING_VERIFICATION_STATUS,
} from "../../common/constants.js";
import { normalizeVietnamPhone } from "../../common/phone.js";
import { deleteAsset, uploadFiles } from "../../services/cloudinary.service.js";
import Notification from "../notifications/notification.model.js";
import {
  sendAccountKycReviewNotification,
  sendListingVerificationReviewNotification,
} from "../notifications/notification.service.js";
import Property from "../properties/property.model.js";
import User from "../users/user.model.js";
import { KYCRequest, ListingVerificationRequest } from "./kyc.model.js";

function assertObjectId(value, message = "Không tìm thấy hồ sơ xác thực.") {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(404, message);
}

function mapUpload(file, uploaded, kind) {
  return {
    kind,
    url: uploaded.secureUrl,
    publicId: uploaded.publicId,
    originalName: file.originalname ?? "",
    mimeType: file.mimetype ?? "",
  };
}

async function uploadVerificationFiles(entries, folder) {
  const files = entries.map((entry) => entry.file);
  const uploaded = await uploadFiles(files, { folder, resourceType: "auto" });
  return uploaded.map((item, index) =>
    mapUpload(files[index], item, entries[index].kind),
  );
}

async function cleanupDocuments(documents) {
  await Promise.all(
    documents.map((document) =>
      deleteAsset(document.publicId, "image").catch(() => null),
    ),
  );
}

function pagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 10, 1),
    100,
  );
  return { page, limit };
}

export async function submitAccountKyc(userId, payload, files = {}) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Không tìm thấy người dùng.");
  if (user.kycStatus === KYC_STATUS.VERIFIED) {
    throw new ApiError(409, "Tài khoản đã được xác thực.");
  }

  const pending = await KYCRequest.exists({
    user: userId,
    status: KYC_STATUS.PENDING,
  });
  if (pending) throw new ApiError(409, "Bạn đang có một hồ sơ chờ duyệt.");

  const requiredFiles = [
    { kind: "identity_front", file: files.identityFront?.[0] },
    { kind: "identity_back", file: files.identityBack?.[0] },
    { kind: "selfie", file: files.selfie?.[0] },
  ];
  if (requiredFiles.some((entry) => !entry.file)) {
    throw new ApiError(
      400,
      "Vui lòng tải đủ CCCD mặt trước, mặt sau và ảnh selfie.",
    );
  }
  if (
    requiredFiles.some((entry) => !entry.file.mimetype?.startsWith("image/"))
  ) {
    throw new ApiError(
      415,
      "CCCD và selfie phải là tệp ảnh JPG, PNG hoặc WEBP.",
    );
  }

  const email = user.email;
  const phone = normalizeVietnamPhone(user.phone);
  if (!email || !phone) {
    throw new ApiError(
      400,
      "Tài khoản cần có đầy đủ email và số điện thoại trước khi KYC.",
    );
  }
  if (!phone) throw new ApiError(400, "Số điện thoại không hợp lệ.");
  const address = (payload.address ?? user.address ?? "").trim();
  const duplicateContact = await User.findOne({
    _id: { $ne: user._id },
    $or: [{ email }, { phone }],
  });
  if (duplicateContact) {
    throw new ApiError(
      409,
      "Email hoặc số điện thoại đã được tài khoản khác sử dụng.",
    );
  }
  const duplicateIdentity = await KYCRequest.findOne({
    user: { $ne: user._id },
    identityNumber: payload.identityNumber,
    status: { $in: [KYC_STATUS.PENDING, KYC_STATUS.VERIFIED] },
  });
  if (duplicateIdentity) {
    throw new ApiError(409, "Số CCCD đã được dùng trong hồ sơ xác thực khác.");
  }

  const documents = await uploadVerificationFiles(
    requiredFiles,
    `werent/kyc/accounts/${userId}`,
  );
  try {
    const request = await KYCRequest.create({
      ...payload,
      address,
      email,
      phone,
      user: userId,
      documents,
    });
    user.kycStatus = KYC_STATUS.PENDING;
    user.canPostListing = false;
    await user.save();
    return request;
  } catch (error) {
    await cleanupDocuments(documents);
    throw error;
  }
}

export function getLatestAccountKyc(userId) {
  return KYCRequest.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .populate("reviewedBy", "fullName email");
}

export async function submitListingVerification(
  user,
  propertyId,
  payload,
  files = [],
) {
  assertObjectId(propertyId, "Không tìm thấy tin đăng.");
  if (user.kycStatus !== KYC_STATUS.VERIFIED || !user.canPostListing) {
    throw new ApiError(
      403,
      "Bạn cần xác thực tài khoản trước khi xác thực bất động sản.",
    );
  }
  const property = await Property.findById(propertyId);
  if (!property) throw new ApiError(404, "Không tìm thấy tin đăng.");
  if (!property.owner.equals(user._id)) {
    throw new ApiError(403, "Bạn không thể xác thực tin đăng của người khác.");
  }
  if (!files.length)
    throw new ApiError(400, "Vui lòng tải ít nhất một giấy tờ chứng minh.");

  const pending = await ListingVerificationRequest.exists({
    property: propertyId,
    status: LISTING_VERIFICATION_STATUS.PENDING,
  });
  if (pending)
    throw new ApiError(409, "Tin đăng đang có hồ sơ xác thực chờ duyệt.");

  const entries = files.map((file) => ({ file, kind: payload.documentType }));
  const documents = await uploadVerificationFiles(
    entries,
    `werent/kyc/listings/${propertyId}`,
  );
  try {
    const verificationRequest = await ListingVerificationRequest.create({
      user: user._id,
      property: propertyId,
      documentType: payload.documentType,
      documents,
      note: payload.note ?? "",
    });
    property.verificationStatus = LISTING_VERIFICATION_STATUS.PENDING;
    await property.save();
    return verificationRequest;
  } catch (error) {
    await cleanupDocuments(documents);
    throw error;
  }
}

export function getLatestListingVerification(userId, propertyId) {
  return ListingVerificationRequest.findOne({
    user: userId,
    property: propertyId,
  })
    .sort({ createdAt: -1 })
    .populate("reviewedBy", "fullName email");
}

export async function listAccountKycRequests(query = {}) {
  const { page, limit } = pagination(query);
  const filter = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    KYCRequest.find(filter)
      .populate(
        "user",
        "fullName email phone avatarUrl kycStatus canPostListing",
      )
      .populate("reviewedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    KYCRequest.countDocuments(filter),
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

export async function getAccountKycRequest(requestId) {
  assertObjectId(requestId);
  const item = await KYCRequest.findById(requestId)
    .populate(
      "user",
      "fullName email phone avatarUrl kycStatus canPostListing verifiedAt",
    )
    .populate("reviewedBy", "fullName email");
  if (!item) throw new ApiError(404, "Không tìm thấy hồ sơ xác thực.");
  return item;
}

export async function reviewAccountKyc(requestId, adminId, payload) {
  const item = await getAccountKycRequest(requestId);
  if (item.status !== KYC_STATUS.PENDING) {
    throw new ApiError(409, "Hồ sơ KYC này đã được xử lý.");
  }
  const user = await User.findById(item.user._id);
  if (!user) throw new ApiError(404, "Không tìm thấy người dùng.");

  item.status = payload.status;
  item.rejectionReason = payload.reason ?? null;
  item.adminNote = payload.adminNote ?? null;
  item.reviewedBy = adminId;
  item.reviewedAt = new Date();

  if (payload.status === KYC_STATUS.VERIFIED) {
    Object.assign(user, {
      fullName: item.fullName,
      email: item.email,
      phone: item.phone,
      address: item.address || user.address,
      dateOfBirth: item.dateOfBirth,
      identityNumber: item.identityNumber,
      identityIssuedAt: item.identityIssuedAt,
      passportNumber: item.passportNumber ?? "",
      taxCode: item.taxCode ?? "",
      kycStatus: KYC_STATUS.VERIFIED,
      canPostListing: true,
      verifiedAt: new Date(),
      verifiedBy: adminId,
    });
  } else {
    user.kycStatus = payload.status;
    user.canPostListing = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
  }

  await Promise.all([item.save(), user.save()]);
  await Notification.create({
    user: user._id,
    type: "account_kyc_reviewed",
    title:
      payload.status === KYC_STATUS.VERIFIED
        ? "Tài khoản đã được xác thực"
        : "Cập nhật hồ sơ xác thực",
    message:
      payload.status === KYC_STATUS.VERIFIED
        ? "Hồ sơ KYC đã được duyệt. Bạn có thể đăng tin."
        : payload.reason,
    metadata: { requestId: item._id, status: payload.status },
  });
  await sendAccountKycReviewNotification(user, item).catch(() => null);
  return item;
}

export async function listListingVerificationRequests(query = {}) {
  const { page, limit } = pagination(query);
  const filter = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    ListingVerificationRequest.find(filter)
      .populate("user", "fullName email phone identityNumber kycStatus")
      .populate(
        "property",
        "title propertyType address area bedrooms bathrooms projectName status verificationStatus",
      )
      .populate("reviewedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ListingVerificationRequest.countDocuments(filter),
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

export async function getListingVerificationRequest(requestId) {
  assertObjectId(requestId);
  const item = await ListingVerificationRequest.findById(requestId)
    .populate(
      "user",
      "fullName email phone identityNumber address dateOfBirth kycStatus verifiedAt",
    )
    .populate("property")
    .populate("reviewedBy", "fullName email");
  if (!item) throw new ApiError(404, "Không tìm thấy hồ sơ xác thực tin đăng.");
  return item;
}

export async function reviewListingVerification(requestId, adminId, payload) {
  const item = await getListingVerificationRequest(requestId);
  if (item.status !== LISTING_VERIFICATION_STATUS.PENDING) {
    throw new ApiError(409, "Hồ sơ xác thực tin đăng này đã được xử lý.");
  }
  const property = await Property.findById(item.property._id);
  if (!property) throw new ApiError(404, "Không tìm thấy tin đăng.");
  const wasVerified = [
    LISTING_VERIFICATION_STATUS.VERIFIED_OWNER,
    LISTING_VERIFICATION_STATUS.VERIFIED_AUTHORIZED,
  ].includes(property.verificationStatus);

  item.status = payload.status;
  item.rejectionReason = payload.reason ?? null;
  item.adminNote = payload.adminNote ?? null;
  item.reviewedBy = adminId;
  item.reviewedAt = new Date();
  property.verificationStatus = payload.status;
  property.verifiedBy = adminId;
  property.verifiedAt = [
    LISTING_VERIFICATION_STATUS.VERIFIED_OWNER,
    LISTING_VERIFICATION_STATUS.VERIFIED_AUTHORIZED,
  ].includes(payload.status)
    ? new Date()
    : null;
  if (property.verifiedAt && !wasVerified) property.qualityScore += 15;

  await Promise.all([item.save(), property.save()]);
  await Notification.create({
    user: item.user._id,
    type: "listing_verification_reviewed",
    title: property.verifiedAt
      ? "Bất động sản đã được xác thực"
      : "Cập nhật xác thực bất động sản",
    message: property.verifiedAt
      ? "Tin đăng đã nhận badge Xác thực."
      : payload.reason,
    metadata: {
      requestId: item._id,
      propertyId: property._id,
      status: payload.status,
    },
  });
  await sendListingVerificationReviewNotification(
    item.user,
    property,
    item,
  ).catch(() => null);
  return item;
}
