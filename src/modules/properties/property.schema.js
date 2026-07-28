import { z } from "zod";
import { PROPERTY_STATUS_LIST } from "../../common/constants.js";

export const createPropertySchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề là bắt buộc"),
  description: z.string().trim().optional(),
  address: z.string().trim().min(1, "Địa chỉ là bắt buộc"),
  price: z.coerce.number().min(0, "Giá phải lớn hơn hoặc bằng 0"),
  area: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  status: z.enum(PROPERTY_STATUS_LIST).optional(),
});

export const updatePropertySchema = createPropertySchema.partial().superRefine((data, context) => {
  if (Object.keys(data).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần ít nhất một trường để cập nhật.",
      path: ["body"],
    });
  }
});

export const propertyQuerySchema = z.object({
  status: z.enum(PROPERTY_STATUS_LIST).optional(),
  owner: z.string().trim().optional(),
  keyword: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

export const updatePropertyStatusSchema = z.object({
  status: z.enum(PROPERTY_STATUS_LIST),
  rejectionReason: z.string().trim().optional(),
});
