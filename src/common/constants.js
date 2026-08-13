export const ROLES = Object.freeze({
  ADMIN: "admin",
  USER: "user",
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

export const PROPERTY_STATUS = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
  HIDDEN: "hidden",
});

export const PROPERTY_STATUS_LIST = Object.freeze(
  Object.values(PROPERTY_STATUS),
);

export const PROPERTY_PACKAGE_TIER = Object.freeze({
  STANDARD: "standard",
  VIP_SILVER: "vipSilver",
  VIP_GOLD: "vipGold",
  VIP_DIAMOND: "vipDiamond",
});

export const PROPERTY_PACKAGE_TIER_LIST = Object.freeze(
  Object.values(PROPERTY_PACKAGE_TIER),
);

export const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELED: "canceled",
});

export const ORDER_STATUS_LIST = Object.freeze(Object.values(ORDER_STATUS));

export const KYC_STATUS = Object.freeze({
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  NEED_MORE_INFO: "need_more_info",
});

export const KYC_STATUS_LIST = Object.freeze(Object.values(KYC_STATUS));

export const LISTING_VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED_OWNER: "verified_owner",
  VERIFIED_AUTHORIZED: "verified_authorized",
  REJECTED: "rejected",
  NEED_MORE_INFO: "need_more_info",
});

export const LISTING_VERIFICATION_STATUS_LIST = Object.freeze(
  Object.values(LISTING_VERIFICATION_STATUS),
);

export const VERIFICATION_DOCUMENT_TYPES = Object.freeze([
  "ownership_certificate",
  "sale_contract",
  "sublease_contract",
  "authorization_letter",
]);

export const REPORT_STATUS = Object.freeze({
  PENDING: "pending",
  REVIEWED: "reviewed",
  RESOLVED: "resolved",
  REJECTED: "rejected",
});

export const REPORT_STATUS_LIST = Object.freeze(Object.values(REPORT_STATUS));
