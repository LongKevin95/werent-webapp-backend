import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const searchCriteriaSchema = z
  .object({
    amenities: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    city: z.string().trim().max(80).optional(),
    districts: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    maxArea: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    minArea: z.coerce.number().positive().optional(),
    minBathrooms: z.coerce.number().int().positive().optional(),
    minBedrooms: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().positive().optional(),
    nearbyPlaces: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    propertyTypes: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
    requiredAmenities: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
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
    .max(1200, "Nhu cầu tìm kiếm quá dài. Vui lòng rút gọn còn dưới 1200 ký tự."),
  offset: z.coerce.number().int().min(0).optional().default(0),
  previousCriteria: searchCriteriaSchema.optional().default({}),
});
