import { z } from "zod";
import {
  INVALID_PHONE_MESSAGE,
  normalizeVietnamPhone,
} from "../../common/phone.js";

const optionalDateValue = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return value;
}, z.coerce.date().nullable());

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Họ và tên không được để trống")
      .optional(),
    dateOfBirth: optionalDateValue.optional(),
    email: z.string().trim().email("Email không hợp lệ").optional(),
    phone: z.union([z.string(), z.number()]).optional(),
    address: z.string().trim().max(500).optional(),
    identityNumber: z.string().trim().max(20).optional(),
    passportNumber: z.string().trim().max(30).optional(),
    taxCode: z.string().trim().max(30).optional(),
  })
  .superRefine((data, context) => {
    const updateableFields = [
      "fullName",
      "dateOfBirth",
      "email",
      "phone",
      "address",
      "identityNumber",
      "passportNumber",
      "taxCode",
    ];

    if (
      updateableFields.every((field) => data[field] === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần ít nhất một trường để cập nhật.",
        path: ["body"],
      });
    }

    if (
      data.phone !== undefined &&
      data.phone !== null &&
      String(data.phone).trim().length > 0 &&
      normalizeVietnamPhone(data.phone) === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: INVALID_PHONE_MESSAGE,
        path: ["phone"],
      });
    }

    if (data.dateOfBirth instanceof Date && data.dateOfBirth >= new Date()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ngày sinh không hợp lệ.",
        path: ["dateOfBirth"],
      });
    }
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại là bắt buộc"),
  newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự"),
});
