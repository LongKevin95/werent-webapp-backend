import { z } from "zod";
import {
  INVALID_PHONE_MESSAGE,
  normalizeVietnamPhone,
} from "../../common/phone.js";

export const loginSchema = z
  .object({
    identifier: z.union([z.string(), z.number()]).optional(),
    emailOrPhone: z.union([z.string(), z.number()]).optional(),
    login: z.union([z.string(), z.number()]).optional(),
    email: z.string().trim().optional(),
    phone: z.union([z.string(), z.number()]).optional(),
    password: z.string().min(1, "Mật khẩu là bắt buộc"),
  })
  .superRefine((data, context) => {
    const identifier =
      data.identifier ??
      data.emailOrPhone ??
      data.login ??
      data.email ??
      data.phone;

    if (
      identifier === undefined ||
      identifier === null ||
      String(identifier).trim().length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email hoặc số điện thoại là bắt buộc",
        path: ["identifier"],
      });
    }
  })
  .transform((data) => ({
    identifier: String(
      data.identifier ??
        data.emailOrPhone ??
        data.login ??
        data.email ??
        data.phone,
    ).trim(),
    password: data.password,
  }));

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Họ và tên là bắt buộc"),
    email: z.string().trim().min(1, "Email là bắt buộc").email("Email không hợp lệ"),
    phone: z.union([z.string(), z.number()]),
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
  })
  .superRefine((data, context) => {
    const hasPhone =
      (typeof data.phone === "string" && data.phone.trim().length > 0) ||
      typeof data.phone === "number";

    if (!hasPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Số điện thoại là bắt buộc.",
        path: ["phone"],
      });
    }

    if (hasPhone && normalizeVietnamPhone(data.phone) === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: INVALID_PHONE_MESSAGE,
        path: ["phone"],
      });
    }
  });
