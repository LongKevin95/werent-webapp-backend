import { z } from "zod";
import {
  PROPERTY_PACKAGE_TIER_LIST,
  PROPERTY_STATUS,
  PROPERTY_STATUS_LIST,
} from "../../common/constants.js";

const propertyCoordinatesSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

const propertyPackageSchema = z.object({
  tier: z.enum(PROPERTY_PACKAGE_TIER_LIST).optional(),
  durationKey: z.string().trim().optional(),
  durationDays: z.coerce.number().int().min(0).optional(),
  pricePerDay: z.coerce.number().min(0).optional(),
  totalPrice: z.coerce.number().min(0).optional(),
});

export const createPropertySchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề là bắt buộc"),
  propertyType: z.string().trim().min(1, "Loại hình là bắt buộc"),
  description: z.string().trim().optional(),
  address: z.string().trim().min(1, "Địa chỉ là bắt buộc"),
  city: z.string().trim().optional(),
  district: z.string().trim().optional(),
  ward: z.string().trim().optional(),
  street: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
  locationNote: z.string().trim().optional(),
  coordinates: propertyCoordinatesSchema.optional(),
  price: z.coerce.number().min(0, "Giá phải lớn hơn hoặc bằng 0"),
  depositAmount: z.coerce.number().min(0).optional(),
  area: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  furnishing: z.string().trim().optional(),
  orientation: z.string().trim().optional(),
  floor: z.string().trim().optional(),
  totalFloors: z.coerce.number().int().min(0).optional(),
  frontage: z.coerce.number().min(0).optional(),
  accessRoad: z.coerce.number().min(0).optional(),
  moveInDays: z.coerce.number().int().min(0).optional(),
  waterPrice: z.string().trim().optional(),
  electricityPrice: z.string().trim().optional(),
  availableFrom: z.string().trim().optional(),
  minimumStayMonths: z.coerce.number().int().min(0).optional(),
  maxOccupants: z.coerce.number().int().min(0).optional(),
  amenities: z.array(z.string().trim()).optional(),
  nearbyPlaces: z.array(z.string().trim()).optional(),
  houseRules: z.array(z.string().trim()).optional(),
  package: propertyPackageSchema.optional(),
  videoUrl: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  contactEmail: z.string().trim().email().optional(),
  isFeatured: z.coerce.boolean().optional(),
  status: z.enum(PROPERTY_STATUS_LIST).optional(),
});

export const updatePropertySchema = createPropertySchema
  .partial()
  .superRefine((data, context) => {
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

export const updatePropertyStatusSchema = z
  .object({
    status: z.enum(PROPERTY_STATUS_LIST),
    rejectionReason: z.string().trim().optional(),
  })
  .superRefine((data, context) => {
    if (
      data.status === PROPERTY_STATUS.REJECTED &&
      !data.rejectionReason?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Cần nhập lý do từ chối khi chuyển tin sang trạng thái vi phạm.",
        path: ["rejectionReason"],
      });
    }
  });
