import { z } from "zod";
import { PROPERTY_STATUS_LIST, ROLE_LIST } from "../../common/constants.js";
import {
  INVALID_PHONE_MESSAGE,
  normalizeVietnamPhone,
} from "../../common/phone.js";

const contactFields = {
  email: z
    .union([z.string().trim().email("Email không hợp lệ"), z.literal("")])
    .optional(),
  phone: z.union([z.string(), z.number()]).optional(),
};

function validateContactFields(data, context, { requireContact = false } = {}) {
  const hasEmail = typeof data.email === "string" && data.email.trim().length > 0;
  const hasPhone =
    (typeof data.phone === "string" && data.phone.trim().length > 0) ||
    typeof data.phone === "number";

  if (requireContact && !hasEmail && !hasPhone) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần cung cấp email hoặc số điện thoại.",
      path: ["email"],
    });
  }

  if (hasPhone && normalizeVietnamPhone(data.phone) === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: INVALID_PHONE_MESSAGE,
      path: ["phone"],
    });
  }
}

export const reviewPropertySchema = z.object({
  status: z.enum(PROPERTY_STATUS_LIST),
  rejectionReason: z.string().trim().optional(),
});

export const createAdminUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Họ và tên là bắt buộc"),
    ...contactFields,
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
    roles: z.array(z.enum(ROLE_LIST)).min(1).default(["user"]),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, context) =>
    validateContactFields(data, context, { requireContact: true }),
  );

export const updateAdminUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Họ và tên không được để trống").optional(),
    ...contactFields,
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").optional(),
    roles: z.array(z.enum(ROLE_LIST)).min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, context) => validateContactFields(data, context));
