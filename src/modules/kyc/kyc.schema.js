import { z } from "zod";
import {
  KYC_STATUS,
  LISTING_VERIFICATION_STATUS,
  VERIFICATION_DOCUMENT_TYPES,
} from "../../common/constants.js";

const dateValue = z.coerce.date();

export const submitAccountKycSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: dateValue,
  email: z.string().trim().email(),
  phone: z.string().trim().min(9).max(20),
  address: z.string().trim().min(5).max(500),
  identityNumber: z.string().trim().min(9).max(20),
  identityIssuedAt: dateValue,
}).superRefine((value, context) => {
  const now = new Date();
  if (value.dateOfBirth >= now) {
    context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Ngày sinh không hợp lệ." });
  }
  if (value.identityIssuedAt > now) {
    context.addIssue({ code: "custom", path: ["identityIssuedAt"], message: "Ngày cấp CCCD không thể ở tương lai." });
  }
});

export const submitListingVerificationSchema = z.object({
  documentType: z.enum(VERIFICATION_DOCUMENT_TYPES),
  note: z.string().trim().max(1000).optional(),
});

function reviewSchema(allowedStatuses) {
  return z.object({
    status: z.enum(allowedStatuses),
    reason: z.string().trim().max(1000).optional(),
    adminNote: z.string().trim().max(2000).optional(),
  }).superRefine((value, context) => {
    if ([KYC_STATUS.REJECTED, KYC_STATUS.NEED_MORE_INFO,
      LISTING_VERIFICATION_STATUS.REJECTED,
      LISTING_VERIFICATION_STATUS.NEED_MORE_INFO].includes(value.status) && !value.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Vui lòng nhập lý do cụ thể." });
    }
  });
}

export const reviewAccountKycSchema = reviewSchema([
  KYC_STATUS.VERIFIED,
  KYC_STATUS.REJECTED,
  KYC_STATUS.NEED_MORE_INFO,
]);

export const reviewListingVerificationSchema = reviewSchema([
  LISTING_VERIFICATION_STATUS.VERIFIED_OWNER,
  LISTING_VERIFICATION_STATUS.VERIFIED_AUTHORIZED,
  LISTING_VERIFICATION_STATUS.REJECTED,
  LISTING_VERIFICATION_STATUS.NEED_MORE_INFO,
]);
