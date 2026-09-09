import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const optionalPositiveNumber = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().positive().optional(),
);
const optionalPositiveInteger = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const searchCriteriaSchema = z
  .object({
    amenities: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    city: z.string().trim().max(80).optional(),
    districts: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    maxArea: optionalPositiveNumber,
    maxPrice: optionalPositiveNumber,
    minArea: optionalPositiveNumber,
    minBathrooms: optionalPositiveInteger,
    minBedrooms: optionalPositiveInteger,
    minPrice: optionalPositiveNumber,
    nearbyPlaces: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    noAmenityPreference: z.boolean().optional(),
    propertyTypes: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
    requiredAmenities: z
      .array(z.string().trim().min(1).max(80))
      .max(12)
      .optional(),
  })
  .partial();

export const supportChatSchema = z.object({
  context: z
    .object({
      currentView: z.string().trim().max(80).optional(),
      isAuthenticated: z.boolean().optional(),
      kycStatus: z.string().trim().max(80).optional(),
      quickAction: z.string().trim().max(80).optional(),
    })
    .optional()
    .default({}),
  message: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập câu hỏi.")
    .max(1200, "Câu hỏi quá dài. Vui lòng rút gọn còn dưới 1200 ký tự."),
  messages: z.array(chatMessageSchema).max(12).optional().default([]),
});

export const propertySearchChatSchema = z.object({
  limit: z.coerce.number().int().min(1).max(5).optional().default(5),
  message: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nhu cầu tìm nhà.")
    .max(
      1200,
      "Nhu cầu tìm kiếm quá dài. Vui lòng rút gọn còn dưới 1200 ký tự.",
    ),
  offset: z.coerce.number().int().min(0).optional().default(0),
  previousCriteria: searchCriteriaSchema.optional().default({}),
});

const optionalShortString = z.string().trim().max(160).optional().default("");

export const listingContentSchema = z.object({
  address: z
    .object({
      addressLine: optionalShortString,
      city: optionalShortString,
      district: optionalShortString,
      projectName: optionalShortString,
      street: optionalShortString,
      ward: optionalShortString,
    })
    .optional()
    .default({}),
  amenities: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .optional()
    .default([]),
  mode: z.enum(["title", "description"]),
  property: z
    .object({
      area: optionalShortString,
      bathrooms: optionalShortString,
      bedrooms: optionalShortString,
      floor: optionalShortString,
      furnishing: optionalShortString,
      moveInDays: optionalShortString,
      orientation: optionalShortString,
      propertyType: z
        .string()
        .trim()
        .min(1, "Vui lòng chọn loại bất động sản trước khi dùng AI.")
        .max(80),
      rentPrice: optionalShortString,
      totalFloors: optionalShortString,
    })
    .refine((value) => value.propertyType, {
      message: "Vui lòng chọn loại bất động sản trước khi dùng AI.",
    }),
  locationNote: z.string().trim().max(300).optional().default(""),
  tone: z
    .enum(["Lịch sự", "Trẻ trung", "Nhiệt tình"])
    .optional()
    .default("Lịch sự"),
  variation: z.coerce.number().int().min(0).max(1000).optional().default(0),
});
