import { z } from "zod";
import {
  KYC_STATUS,
  LISTING_VERIFICATION_STATUS,
  VERIFICATION_DOCUMENT_TYPES,
} from "../../common/constants.js";
import {
  INVALID_PHONE_MESSAGE,
  getVietnamPhoneValidationError,
} from "../../common/phone.js";

const dateValue = (message) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim().length === 0) {
        return undefined;
      }

      return value;
    },
    z.coerce.date({ error: message }),
  );

export const submitAccountKycSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập họ và tên.")
      .min(2, "Họ và tên phải có ít nhất 2 ký tự.")
      .max(120, "Họ và tên không được vượt quá 120 ký tự."),
    dateOfBirth: dateValue("Vui lòng chọn ngày sinh."),
    email: z.string().trim().min(1, "Vui lòng cung cấp email.").email("Email không hợp lệ."),
    phone: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập số điện thoại.")
      .max(20, "Số điện thoại không được vượt quá 20 ký tự."),
    address: z.string().trim().min(5).max(500).optional(),
    identityNumber: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập số CCCD.")
      .regex(/^\d+$/, "Số CCCD chỉ được gồm chữ số.")
      .length(12, "Số CCCD phải gồm 12 chữ số."),
    identityIssuedAt: dateValue("Vui lòng chọn ngày cấp CCCD."),
    passportNumber: z.string().trim().max(30).optional(),
    taxCode: z.string().trim().max(30).optional(),
  })
  .superRefine((value, context) => {
    const now = new Date();
    if (value.dateOfBirth >= now) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Ngày sinh không hợp lệ.",
      });
    }
    if (value.identityIssuedAt > now) {
      context.addIssue({
        code: "custom",
        path: ["identityIssuedAt"],
        message: "Ngày cấp CCCD không thể ở tương lai.",
      });
    }
    const phoneError = getVietnamPhoneValidationError(value.phone);
    if (phoneError) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: phoneError || INVALID_PHONE_MESSAGE,
      });
    }
  });

export const submitListingVerificationSchema = z.object({
  documentType: z.enum(VERIFICATION_DOCUMENT_TYPES),
  note: z.string().trim().max(1000).optional(),
});

function reviewSchema(allowedStatuses) {
  return z
    .object({
      status: z.enum(allowedStatuses),
      reason: z.string().trim().max(1000).optional(),
      adminNote: z.string().trim().max(2000).optional(),
    })
    .superRefine((value, context) => {
      if (
        [
          KYC_STATUS.REJECTED,
          KYC_STATUS.NEED_MORE_INFO,
          LISTING_VERIFICATION_STATUS.REJECTED,
          LISTING_VERIFICATION_STATUS.NEED_MORE_INFO,
        ].includes(value.status) &&
        !value.reason
      ) {
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: "Vui lòng nhập lý do cụ thể.",
        });
      }
    });
}

export const reviewAccountKycSchema = reviewSchema([
  KYC_STATUS.VERIFIED,
  KYC_STATUS.REJECTED,
]);

export const reviewListingVerificationSchema = reviewSchema([
  LISTING_VERIFICATION_STATUS.VERIFIED_OWNER,
  LISTING_VERIFICATION_STATUS.VERIFIED_AUTHORIZED,
  LISTING_VERIFICATION_STATUS.REJECTED,
  LISTING_VERIFICATION_STATUS.NEED_MORE_INFO,
]);
