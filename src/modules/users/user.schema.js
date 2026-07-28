import { z } from "zod";
import {
  INVALID_PHONE_MESSAGE,
  normalizeVietnamPhone,
} from "../../common/phone.js";

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Họ và tên không được để trống")
      .optional(),
    email: z.string().trim().email("Email không hợp lệ").optional(),
    phone: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine((data, context) => {
    if (
      data.fullName === undefined &&
      data.email === undefined &&
      data.phone === undefined
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
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại là bắt buộc"),
  newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự"),
});
